import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  criarCheckoutAssinatura,
  obterOuCriarCustomer,
  valorCobranca,
} from "@/lib/services/stripe.service";

/**
 * POST /api/checkout/stripe
 *
 * Cria a Checkout Session (assinatura recorrente) pro plano/ciclo
 * escolhido e devolve a `url` do checkout hospedado da Stripe. O cliente
 * é redirecionado pra lá; a ATIVAÇÃO da assinatura acontece no webhook
 * (`checkout.session.completed`).
 *
 * Guarda o customer id da Stripe na subscription (reaproveitado em
 * `mp_payment_id`) + provider, mas NÃO muda o status — isso é
 * responsabilidade do webhook.
 *
 * Body: { plano, ciclo }
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
  const { plano, ciclo } = parsed.data;
  const workspaceId = r.sessao.workspaceId;
  const valor = valorCobranca(plano, ciclo);

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

    // 2) Cria a Checkout Session (modo subscription).
    const session = await criarCheckoutAssinatura({
      workspaceId,
      plano,
      ciclo,
      customerId,
    });

    if (!session.url) {
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

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao iniciar o checkout." },
      { status: 500 }
    );
  }
}
