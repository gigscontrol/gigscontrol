import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { infoSubscription } from "@/lib/services/stripe.service";

/**
 * GET /api/assinatura/estado
 *
 * Estado consolidado da assinatura pra tela de Plano: plano/ciclo atuais,
 * status de cobrança, downgrade agendado (se houver) e a MOEDA REAL da
 * assinatura na Stripe (pra não formatar o preço na moeda do IP). Só admin.
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Apenas admin." }, { status: 403 });
  }

  const admin = criarClienteAdmin();
  const wsId = r.sessao.workspaceId;

  const { data: ws } = await admin
    .from("workspaces")
    .select("plano, ciclo, status")
    .eq("id", wsId)
    .maybeSingle<{ plano: string | null; ciclo: string | null; status: string | null }>();

  // Subscription: status + downgrade pendente. Defensivo: se as colunas de
  // downgrade ainda não foram migradas (46), cai no select sem elas.
  let subStatus: string | null = null;
  let downgradePara: string | null = null;
  let downgradeEfetivoEm: string | null = null;
  let mpPreferenceId: string | null = null;
  const sel = await admin
    .from("subscriptions")
    .select("status, mp_preference_id, downgrade_para, downgrade_efetivo_em")
    .eq("workspace_id", wsId)
    .maybeSingle<{
      status: string | null;
      mp_preference_id: string | null;
      downgrade_para: string | null;
      downgrade_efetivo_em: string | null;
    }>();
  if (!sel.error && sel.data) {
    subStatus = sel.data.status;
    mpPreferenceId = sel.data.mp_preference_id;
    downgradePara = sel.data.downgrade_para;
    downgradeEfetivoEm = sel.data.downgrade_efetivo_em;
  } else {
    const fb = await admin
      .from("subscriptions")
      .select("status, mp_preference_id")
      .eq("workspace_id", wsId)
      .maybeSingle<{ status: string | null; mp_preference_id: string | null }>();
    subStatus = fb.data?.status ?? null;
    mpPreferenceId = fb.data?.mp_preference_id ?? null;
  }

  // Moeda real da assinatura (best-effort — não quebra a tela se falhar).
  let moeda: string | null = null;
  if (mpPreferenceId) {
    try {
      const info = await infoSubscription(mpPreferenceId);
      moeda = info.moeda;
    } catch {
      /* mantém null → o client cai na moeda da região */
    }
  }

  return NextResponse.json({
    plano: ws?.plano ?? null,
    ciclo: ws?.ciclo === "anual" ? "anual" : "mensal",
    status: subStatus ?? ws?.status ?? null,
    moeda,
    downgradePara,
    downgradeEfetivoEm,
  });
}
