import { criarClienteAdmin } from "@/lib/db/supabase-admin";

export type EstadoAcesso = "ok" | "graca" | "bloqueado";

/**
 * Linha (parcial) da subscription usada pela derivação de estado.
 *
 * MODELO PRÉ-PAGO: o acesso deriva de `acesso_ate` (validade em data), não
 * mais de `trial_termina_em`. As colunas legado ficam read-only.
 */
export type SubAcesso = { status: string | null; acesso_ate: string | null } | null;

/** +1 dia de graça em ms depois de vencida a validade. */
const GRACA_MS = 86_400_000;

/**
 * Estado de acesso efetivo a partir do status + VALIDADE (`acesso_ate`).
 *
 * FONTE ÚNICA da regra — reusada pelo onboarding, pelo painel super-admin e
 * pelo gate server-side de mutação (`autenticarComWorkspace({ exigirAcesso })`).
 *
 * O ESTADO É DO WORKSPACE (derivado da subscription real), nunca do papel do
 * usuário: quando o admin não paga/vence, TODOS do ecossistema (admin, artista,
 * equipe) são bloqueados juntos.
 *
 *  - ok        → dentro da validade (agora ≤ acesso_ate)
 *  - graca     → validade acabou há ≤ 1 dia: acesso liberado + aviso
 *  - bloqueado → validade venceu além da graça; suspended/cancelled
 *                (chargeback/cancelamento) SEMPRE bloqueiam, mesmo com data
 *                futura; ou SEM `acesso_ate` (stub que nunca foi pago — fecha o
 *                "trial eterno": abrir o checkout e abandonar não libera o app).
 */
export function estadoAcessoDe(
  status: string,
  acessoAte: string | null
): EstadoAcesso {
  // Suspensão/cancelamento (chargeback, cancelamento) barram SEMPRE — mesmo
  // que ainda reste validade paga.
  if (status === "suspended" || status === "cancelled") return "bloqueado";

  const agora = Date.now();
  const prazo = acessoAte ? new Date(acessoAte).getTime() : null;

  // Sem validade = nunca pagou (stub de checkout abandonado) → bloqueado.
  if (prazo == null || Number.isNaN(prazo)) return "bloqueado";

  if (agora <= prazo) return "ok";
  if (agora <= prazo + GRACA_MS) return "graca"; // +1 dia de graça
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
 * stub SEM `acesso_ate` — que deriva "bloqueado" — e o pagamento/cortesia
 * grava a validade). Uma conta nova sem plano nem chega no app: fica presa no
 * onboarding (`onboarding_completo = false`). Logo, o único workspace que chega
 * SEM linha é o legado, e esse é legítimo.
 */
export function estadoAcessoDeSub(sub: SubAcesso): EstadoAcesso {
  if (!sub || sub.status == null) return "ok"; // legado (sem subscription) → liberado
  return estadoAcessoDe(sub.status, sub.acesso_ate);
}

/**
 * true se o workspace está BLOQUEADO (validade vencida além da graça, ou
 * suspended/cancelled, ou stub sem validade que nunca virou pagamento). 'ok' e
 * 'graca' → false. Vale pra QUALQUER papel — o estado é do workspace.
 *
 * Sem subscription (legado da migração 25) → false: ver `estadoAcessoDeSub`.
 * Erro de leitura → false (não tranca ninguém por falha de infra).
 * Usa o cliente admin (bypassa RLS) só pra ler status + validade.
 */
export async function workspaceBloqueado(workspaceId: string): Promise<boolean> {
  const admin = criarClienteAdmin();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, acesso_ate")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ status: string | null; acesso_ate: string | null }>();
  if (error) return false;
  return estadoAcessoDeSub(data ?? null) === "bloqueado";
}

/**
 * true se o onboarding do workspace AINDA não foi concluído. Serve pra ISENTAR
 * o paywall durante o cadastro/assinatura: no passo Pagamento o checkout cria um
 * stub sem validade que deixa o workspace 'bloqueado' — mas o usuário ainda
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
