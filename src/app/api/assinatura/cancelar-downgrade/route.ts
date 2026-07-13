import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/assinatura/cancelar-downgrade
 *
 * MODELO PRÉ-PAGO por validade: não há Subscription Schedule na Stripe pra
 * soltar. O downgrade é só uma marcação (downgrade_para/downgrade_efetivo_em) —
 * cancelar = limpar essas colunas. Volta a valer o limite do plano atual. Só admin.
 */
export async function POST() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Apenas admin pode mudar o plano." }, { status: 403 });
  }

  const admin = criarClienteAdmin();
  const { error } = await admin
    .from("subscriptions")
    .update({ downgrade_para: null, downgrade_efetivo_em: null })
    .eq("workspace_id", r.sessao.workspaceId);
  if (error) {
    return NextResponse.json(
      { erro: error.message ?? "Falha ao cancelar o downgrade." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
