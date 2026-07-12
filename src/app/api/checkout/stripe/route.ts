import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies, headers } from "next/headers";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { regiaoDe, resolverPais } from "@/lib/regiao";
import {
  criarCheckoutAssinatura,
  obterOuCriarCustomer,
  valorCobranca,
} from "@/lib/services/stripe.service";

/**
 * POST /api/checkout/stripe
 *
 * Cria a Checkout Session (assinatura recorrente) pro plano/ciclo
 * escolhido. A ATIVAÇÃO da assinatura acontece no webhook
 * (`checkout.session.completed`) — igual nos dois modos.
 *
 * Resposta depende do modo (`ui` no body):
 *  - sem `ui` (ou `ui:'hosted'`): devolve `{ url }` do checkout hospedado
 *    da Stripe; o cliente é redirecionado pra lá. É o comportamento LEGADO
 *    (os call-sites atuais não passam `ui`, então nada muda pra eles).
 *  - `ui:'embedded'`: devolve `{ clientSecret }` pra montar o Embedded
 *    Checkout (iframe) na nossa página via @stripe/stripe-js.
 *
 * Guarda o customer id da Stripe na subscription (reaproveitado em
 * `mp_payment_id`) + provider, mas NÃO muda o status — isso é
 * responsabilidade do webhook.
 *
 * Body: { plano, ciclo, ui? }
 */

const schema = z.object({
  plano: z.enum([
    "individual",
    "equipe",
    "time",
    "agencia",
    "agencia-plus",
    "agencia-max",
  ]),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  ui: z.enum(["hosted", "embedded"]).default("hosted"),
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
  const { plano, ciclo, ui } = parsed.data;
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
      .select("id, mp_payment_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const customerId = await obterOuCriarCustomer({
      workspaceId,
      email: r.sessao.userEmail,
      customerIdExistente: subExistente?.mp_payment_id ?? null,
    });

    // 2) Cria a Checkout Session (modo subscription) no modo pedido.
    const session = await criarCheckoutAssinatura({
      workspaceId,
      plano,
      ciclo,
      customerId,
      moeda,
      ui,
    });

    // Cada modo entrega um campo diferente. Valida o correspondente.
    if (ui === "embedded") {
      if (!session.client_secret) {
        throw new Error("Stripe não retornou o client_secret do checkout.");
      }
    } else if (!session.url) {
      throw new Error("Stripe não retornou a URL do checkout.");
    }

    // 3) Salva o plano escolhido no workspace + referência do customer na
    //    subscription (upsert). Status NÃO muda aqui.
    await admin
      .from("workspaces")
      .update({ plano, ciclo })
      .eq("id", workspaceId);

    if (subExistente) {
      await admin
        .from("subscriptions")
        .update({
          plano,
          ciclo,
          provider: "stripe",
          valor,
          // reaproveitado: mp_* guarda ids do Stripe (sem migration)
          mp_payment_id: customerId,
        })
        .eq("id", subExistente.id);
    } else {
      await admin.from("subscriptions").insert({
        workspace_id: workspaceId,
        plano,
        ciclo,
        status: "trial", // continua trial até o webhook ativar
        provider: "stripe",
        valor,
        // reaproveitado: mp_* guarda ids do Stripe (sem migration)
        mp_payment_id: customerId,
        inicio_em: new Date().toISOString().slice(0, 10),
      });
    }

    // Embedded → clientSecret (o front monta o iframe); hosted → url (redirect).
    if (ui === "embedded") {
      return NextResponse.json({ clientSecret: session.client_secret });
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao iniciar o checkout." },
      { status: 500 }
    );
  }
}
