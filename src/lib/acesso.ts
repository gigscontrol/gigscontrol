import { criarClienteAdmin } from "@/lib/db/supabase-admin";

export type EstadoAcesso = "ok" | "graca" | "bloqueado";

/** Linha (parcial) da subscription usada pela derivação de estado. */
export type SubAcesso = { status: string | null; trial_termina_em: string | null } | null;

/**
 * Estado de acesso efetivo a partir do status da assinatura + prazo
 * (`trial_termina_em`, reusado como deadline da graça).
 *
 * FONTE ÚNICA da regra — reusada pelo onboarding, pelo painel super-admin e
 * pelo gate server-side de mutação (`autenticarComWorkspace({ exigirAcesso })`).
 *
 * O ESTADO É DO WORKSPACE (derivado da subscription real), nunca do papel do
 * usuário: quando o admin não paga/vence, TODOS do ecossistema (admin, artista,
 * equipe) são bloqueados juntos.
 *
 *  - ok        → acesso liberado
 *  - graca     → prazo acabou há ≤ 1 dia: acesso liberado + aviso
 *  - bloqueado → graça expirou, suspended/cancelled (chargeback/cancelamento),
 *                OU trial sem data de término (o registro "trial" que o checkout
 *                cria ANTES de pagar — se o pagamento nunca acontece, isso NÃO
 *                pode virar acesso vitalício grátis).
 */
export function estadoAcessoDe(
  status: string,
  trialTerminaEm: string | null
): EstadoAcesso {
  const agora = Date.now();
  const prazo = trialTerminaEm ? new Date(trialTerminaEm).getTime() : null;
  if (status === "ativa") return "ok";
  if (status === "suspended" || status === "cancelled") return "bloqueado";
  if (status === "trial") {
    // Trial de verdade SEMPRE tem data (o `iniciar-trial` grava trial_termina_em).
    // Sem data = stub do checkout que nunca foi pago → bloqueia (fecha o "trial
    // eterno": abrir o checkout e abandonar não pode liberar o app pra sempre).
    if (!prazo) return "bloqueado";
    if (agora <= prazo) return "ok";
    if (agora <= prazo + 86_400_000) return "graca"; // +1 dia de graça
    return "bloqueado";
  }
  if (status === "graca") return prazo && agora <= prazo ? "graca" : "bloqueado";
  // Status desconhecido/vazio → não presume acesso (fail-safe).
  return "bloqueado";
}

/**
 * Deriva o estado a partir da LINHA da subscription (ou da ausência dela).
 *
 * SEM subscription (`null`) → "ok". Isto é grandfathering DELIBERADO dos
 * workspaces LEGADO: a migração 25 marcou `onboarding_completo = true` em todos
 * os workspaces que já existiam SEM criar linha em `subscriptions`. Bloquear a
 * ausência trancaria o Bruno e todo cliente antigo/pago — o oposto do desejado.
 *
 * Por que isto continua fechando o furo de cobrança: todo caminho de conta NOVA
 * que deveria bloquear CRIA uma linha de subscription (o checkout insere um
 * `status='trial'` sem data — que agora deriva "bloqueado" — e o `iniciar-trial`
 * insere trial COM data). Uma conta nova sem plano nem chega no app: fica presa
 * no onboarding (`onboarding_completo = false`). Logo, o único workspace que
 * chega SEM linha é o legado, e esse é legítimo.
 */
export function estadoAcessoDeSub(sub: SubAcesso): EstadoAcesso {
  if (!sub || sub.status == null) return "ok"; // legado (sem subscription) → liberado
  return estadoAcessoDe(sub.status, sub.trial_termina_em);
}

/**
 * true se o workspace está BLOQUEADO (assinatura vencida/suspensa/cancelada
 * além da graça, ou trial sem data que nunca virou pagamento). 'ok' e 'graca'
 * → false. Vale pra QUALQUER papel — o estado é do workspace, não do usuário.
 *
 * Sem subscription (legado da migração 25) → false: ver `estadoAcessoDeSub`.
 * Erro de leitura → false (não tranca ninguém por falha de infra).
 * Usa o cliente admin (bypassa RLS) só pra ler status + prazo.
 */
export async function workspaceBloqueado(workspaceId: string): Promise<boolean> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, trial_termina_em")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ status: string | null; trial_termina_em: string | null }>();
  if (error) return false;
  return estadoAcessoDeSub(data ?? null) === "bloqueado";
}

/**
 * true se o onboarding do workspace AINDA não foi concluído. Serve pra ISENTAR
 * o paywall durante o cadastro/assinatura: no passo Pagamento o checkout cria um
 * stub 'trial' sem data que deixa o workspace 'bloqueado' — mas o usuário ainda
 * está regularizando e precisa poder concluir/editar as etapas do onboarding.
 * Depois de concluído (`onboarding_completo = true`), o gate volta a valer normal.
 * Erro/ausência → false (na dúvida NÃO isenta, mantém o paywall).
 */
export async function workspaceOnboardingIncompleto(
  workspaceId: string
): Promise<boolean> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin
    .from("workspaces")
    .select("onboarding_completo")
    .eq("id", workspaceId)
    .maybeSingle<{ onboarding_completo: boolean | null }>();
  if (error || !data) return false;
  return data.onboarding_completo !== true;
}
