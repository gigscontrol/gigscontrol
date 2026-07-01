import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * Estado de acesso efetivo a partir do status da assinatura + prazo
 * (`trial_termina_em`, reusado como deadline da graça).
 *
 * FONTE ÚNICA da regra — reusada pelo onboarding, pelo painel super-admin e
 * pelo gate server-side de mutação (`autenticarComWorkspace({ exigirAcesso })`).
 *
 *  - ok        → acesso liberado
 *  - graca     → prazo acabou há ≤ 1 dia: acesso liberado + aviso
 *  - bloqueado → graça expirou, ou suspended/cancelled (chargeback/cancelamento)
 */
export function estadoAcessoDe(
  status: string,
  trialTerminaEm: string | null
): "ok" | "graca" | "bloqueado" {
  const agora = Date.now();
  const prazo = trialTerminaEm ? new Date(trialTerminaEm).getTime() : null;
  if (status === "ativa") return "ok";
  if (status === "suspended" || status === "cancelled") return "bloqueado";
  if (status === "trial") {
    if (!prazo || agora <= prazo) return "ok";
    if (agora <= prazo + 86_400_000) return "graca"; // +1 dia de graça
    return "bloqueado";
  }
  if (status === "graca") return prazo && agora <= prazo ? "graca" : "bloqueado";
  return "ok";
}

/**
 * true se o workspace está BLOQUEADO (assinatura vencida/suspensa/cancelada
 * além da graça). 'ok' e 'graca' → false. Sem subscription (onboarding ainda
 * não escolheu plano) → false (o próprio fluxo de onboarding cuida disso).
 * Usa o cliente admin (bypassa RLS) só pra ler status + prazo.
 */
export async function workspaceBloqueado(workspaceId: string): Promise<boolean> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, trial_termina_em")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ status: string | null; trial_termina_em: string | null }>();
  if (error || !data) return false;
  return estadoAcessoDe(data.status ?? "ativa", data.trial_termina_em) === "bloqueado";
}
