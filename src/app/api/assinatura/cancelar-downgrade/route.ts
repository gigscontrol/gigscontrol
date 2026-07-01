import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { cancelarDowngrade } from "@/lib/services/stripe.service";

/**
 * POST /api/assinatura/cancelar-downgrade
 *
 * Cancela um downgrade agendado (solta o Subscription Schedule na Stripe → a
 * assinatura segue no plano ATUAL, renovando normalmente) e limpa o registro
 * do downgrade pendente no DB. Só admin.
 */
export async function POST() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Apenas admin pode mudar o plano." }, { status: 403 });
  }

  const admin = criarClienteAdmin();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, mp_preference_id, downgrade_para")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      id: string;
      mp_preference_id: string | null;
      downgrade_para: string | null;
    }>();

  if (!sub?.mp_preference_id) {
    return NextResponse.json({ erro: "Sem assinatura na Stripe." }, { status: 409 });
  }

  try {
    await cancelarDowngrade({ subscriptionId: sub.mp_preference_id });
    const { error } = await admin
      .from("subscriptions")
      .update({ downgrade_para: null, downgrade_efetivo_em: null })
      .eq("id", sub.id);
    if (error) {
      console.error("[cancelar-downgrade] falha ao limpar o registro no DB:", error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao cancelar o downgrade." },
      { status: 500 }
    );
  }
}
