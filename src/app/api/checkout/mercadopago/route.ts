import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { criarPreferenceCheckout } from "@/lib/services/mercadopago.service";

/**
 * POST /api/checkout/mercadopago
 *
 * Cria a preference do Checkout Pro pro plano/ciclo escolhido e devolve
 * o `initPoint` (URL do checkout hospedado do Mercado Pago). O cliente é
 * redirecionado pra lá; a ativação da assinatura acontece no webhook
 * quando o pagamento aprova.
 *
 * Guarda `mp_preference_id` + `provider` na subscription (upsert), mas
 * NÃO muda o status — isso é responsabilidade do webhook.
 *
 * Body: { plano, ciclo }
 */

const schema = z.object({
  plano: z.enum([
    "individual",
    "equipe",
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

  const admin = criarClienteAdmin();

  try {
    // 1) Cria a preference no Mercado Pago
    const pref = await criarPreferenceCheckout({
      workspaceId,
      planoId: plano,
      ciclo,
    });

    // 2) Salva o plano escolhido no workspace + referência da preference
    //    na subscription (upsert). Status NÃO muda aqui.
    await admin
      .from("workspaces")
      .update({ plano, ciclo })
      .eq("id", workspaceId);

    const { data: subExistente } = await admin
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (subExistente) {
      await admin
        .from("subscriptions")
        .update({
          plano,
          ciclo,
          provider: "mercadopago",
          mp_preference_id: pref.preferenceId,
          valor: pref.valor,
        })
        .eq("id", subExistente.id);
    } else {
      await admin.from("subscriptions").insert({
        workspace_id: workspaceId,
        plano,
        ciclo,
        status: "trial", // continua trial até o webhook aprovar
        provider: "mercadopago",
        mp_preference_id: pref.preferenceId,
        valor: pref.valor,
        inicio_em: new Date().toISOString().slice(0, 10),
      });
    }

    return NextResponse.json({
      initPoint: pref.initPoint,
      preferenceId: pref.preferenceId,
      valor: pref.valor,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao iniciar o checkout." },
      { status: 500 }
    );
  }
}
