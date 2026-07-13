import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies, headers } from "next/headers";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { regiaoDe, resolverPais } from "@/lib/regiao";
import {
  criarCheckoutPagamento,
  criarPaymentIntentPagamento,
  obterOuCriarCustomer,
  valorCobranca,
} from "@/lib/services/stripe.service";
import { PLANOS, PLANO_IDS, ehUpgrade, creditoDiasUpgrade, type PlanoId } from "@/lib/planos";

/**
 * POST /api/checkout/stripe
 *
 * Cria a Checkout Session em modo `payment` (PAGAMENTO ÚNICO) pro plano/ciclo
 * escolhido. Ao ser paga, o webhook (`checkout.session.completed`, mode=payment)
 * ESTENDE a validade (acesso_ate) do workspace via a RPC central — igual nos
 * dois modos de apresentação.
 *
 * Resposta depende do modo (`ui` no body):
 *  - sem `ui` (ou `ui:'hosted'`): devolve `{ url }` do checkout hospedado da
 *    Stripe; o cliente é redirecionado pra lá.
 *  - `ui:'embedded'`: devolve `{ clientSecret }` pra montar o Embedded Checkout
 *    (iframe) na nossa página via @stripe/stripe-js.
 *  - `ui:'payment_element'`: devolve `{ clientSecret }` de um PaymentIntent
 *    (prefixo `pi_..._secret_`) pra montar o Payment Element no checkout próprio.
 *
 * Guarda o customer id da Stripe na subscription (reaproveitado em
 * `mp_payment_id`) + provider, mas NÃO concede acesso — isso é
 * responsabilidade do webhook.
 *
 * Body: { plano, ciclo, ui?, gateway? } — `gateway` fica pra roteamento futuro
 * Stripe×MP; aqui é sempre Stripe.
 */

const schema = z.object({
  plano: z.enum(PLANO_IDS),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  ui: z.enum(["hosted", "embedded", "payment_element"]).default("hosted"),
  gateway: z.enum(["stripe", "mercadopago"]).optional(),
  // Crédito de upgrade em DIAS (modelo pré-pago). O valor do client é SÓ a
  // intenção ("este checkout é um upgrade com crédito"): o valor que vai pro
  // metadata é RECALCULADO server-side abaixo (mesma fórmula do
  // /api/assinatura/upgrade) — o client nunca decide quantos dias ganha.
  creditoDias: z.number().int().min(0).max(365).optional(),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode iniciar o pagamento." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Plano ou ciclo inválido." },
      { status: 400 }
    );
  }
  const { plano, ciclo, ui, creditoDias } = parsed.data;
  const workspaceId = r.sessao.workspaceId;
  // Moeda pela região (mesma regra do display) — cobra USD fora do BR.
  const pais = resolverPais(
    headers().get("x-vercel-ip-country"),
    cookies().get("gc-pais")?.value
  );
  const { moeda } = regiaoDe(pais);
  const valor = valorCobranca(plano, ciclo, moeda);

  const admin = criarClienteAdmin();

  try {
    // 1) Reaproveita o customer da Stripe se já existir pra este workspace.
    //    reaproveitado: mp_* guarda ids do Stripe (sem migration)
    const { data: subExistente } = await admin
      .from("subscriptions")
      .select("id, mp_payment_id, plano, acesso_ate")
      .eq("workspace_id", workspaceId)
      .maybeSingle<{
        id: string;
        mp_payment_id: string | null;
        plano: string | null;
        acesso_ate: string | null;
      }>();

    const customerId = await obterOuCriarCustomer({
      workspaceId,
      email: r.sessao.userEmail,
      customerIdExistente: subExistente?.mp_payment_id ?? null,
    });

    // Crédito de upgrade RECALCULADO server-side (o valor do client é só a
    // intenção — nunca decide quantos dias ganha). Só existe crédito quando o
    // plano pedido é UPGRADE real do plano atual da subscription, e ele deriva
    // da validade restante (mesma fórmula do /api/assinatura/upgrade). Teto no
    // valor do client: nunca concede MAIS do que a UI mostrou ao usuário.
    let creditoDiasReal = 0;
    if (creditoDias && creditoDias > 0 && subExistente) {
      const atualOk = PLANOS.some((p) => p.id === subExistente.plano);
      const atual = (atualOk ? subExistente.plano : "individual") as PlanoId;
      if (ehUpgrade(atual, plano)) {
        const ms = subExistente.acesso_ate
          ? new Date(subExistente.acesso_ate).getTime() - Date.now()
          : 0;
        const diasRestantes = ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
        creditoDiasReal = Math.min(
          creditoDiasUpgrade({ atual, novo: plano, ciclo, moeda, diasRestantes }),
          creditoDias
        );
      }
    }

    // 2) Cria o objeto de pagamento no modo de apresentação pedido.
    //    - payment_element: PaymentIntent avulso (checkout próprio, Payment Element).
    //    - hosted/embedded: Checkout Session (modo payment).
    let clientSecret: string | null = null;
    let checkoutUrl: string | null = null;

    if (ui === "payment_element") {
      const pi = await criarPaymentIntentPagamento({
        workspaceId,
        plano,
        ciclo,
        customerId,
        moeda,
        creditoDias: creditoDiasReal,
      });
      if (!pi.client_secret) {
        throw new Error("Stripe não retornou o client_secret do PaymentIntent.");
      }
      clientSecret = pi.client_secret;
    } else {
      const session = await criarCheckoutPagamento({
        workspaceId,
        plano,
        ciclo,
        customerId,
        moeda,
        email: r.sessao.userEmail,
        embedded: ui === "embedded",
        creditoDias: creditoDiasReal,
      });

      // Cada modo entrega um campo diferente. Valida o correspondente.
      if (ui === "embedded") {
        if (!session.client_secret) {
          throw new Error("Stripe não retornou o client_secret do checkout.");
        }
        clientSecret = session.client_secret;
      } else {
        if (!session.url) {
          throw new Error("Stripe não retornou a URL do checkout.");
        }
        checkoutUrl = session.url;
      }
    }

    // 3) Guarda SÓ a referência do customer da Stripe na subscription (reusada
    //    na retentativa). NÃO grava o plano no workspace nem na subscription
    //    ainda — quem faz isso é o WEBHOOK ao APROVAR o pagamento. Assim um
    //    upgrade ABANDONADO (checkout fechado sem pagar) não deixa o workspace
    //    com os limites do plano novo sem ter pago. No onboarding, o plano já
    //    foi salvo em workspaces por /escolher-plano (e o usuário fica bloqueado
    //    até o webhook estender a validade, então não há o que abusar).
    if (subExistente) {
      await admin
        .from("subscriptions")
        .update({
          provider: "stripe",
          // reaproveitado: mp_* guarda ids do Stripe (sem migration)
          mp_payment_id: customerId,
        })
        .eq("id", subExistente.id);
    } else {
      await admin.from("subscriptions").insert({
        workspace_id: workspaceId,
        plano,
        ciclo,
        status: "trial", // continua trial até o webhook estender a validade
        provider: "stripe",
        valor,
        // reaproveitado: mp_* guarda ids do Stripe (sem migration)
        mp_payment_id: customerId,
        inicio_em: new Date().toISOString().slice(0, 10),
      });
    }

    // embedded/payment_element → clientSecret (o front monta o iframe/Element);
    // hosted → url (redirect).
    if (clientSecret) {
      return NextResponse.json({ clientSecret });
    }
    return NextResponse.json({ url: checkoutUrl });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao iniciar o checkout." },
      { status: 500 }
    );
  }
}
