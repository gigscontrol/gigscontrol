import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessaoAutenticada } from "@/lib/api/session";

/**
 * Visibilidade de CONTRATANTES — modelo NOVO, derivada (sem "dono fixo" e sem
 * migration). Um contratante é visível para o usuário se:
 *   - ele CRIOU o contratante (contratantes.criado_por), OU
 *   - existe orçamento/venda desse contratante que ELE criou, OU
 *   - existe orçamento/venda desse contratante para um ARTISTA que ele atende
 *     (tem vínculo em membros_artista).
 * A visibilidade ACUMULA: cada novo orçamento/venda pode passar a exibir o
 * contato para mais gente. Contatos (casas/cidades) seguem sendo catálogo do
 * workspace — não passam por aqui.
 *
 * Admin/super e usuário LEGADO (sem vínculos) veem TODOS ("todos"), pra não
 * trancar ninguém na transição — mesmo padrão dos outros módulos.
 */

/** Vê todos os contratantes? (admin/super/legado). */
function veTodos(sessao: SessaoAutenticada): boolean {
  return (
    sessao.isSuperAdmin ||
    sessao.papel === "admin" ||
    sessao.vinculos === undefined
  );
}

/** contratante_ids referenciados por orçamentos/vendas que o usuário alcança. */
async function idsPorOrcVenda(
  supabase: SupabaseClient,
  tabela: "orcamentos" | "vendas",
  userId: string,
  artistas: string[]
): Promise<string[]> {
  let q = supabase
    .from(tabela)
    .select("contratante_id")
    .not("contratante_id", "is", null)
    .is("deletado_em", null);
  q =
    artistas.length > 0
      ? q.or(`criado_por.eq.${userId},artist_id.in.(${artistas.join(",")})`)
      : q.eq("criado_por", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? [])
    .map((r) => (r as { contratante_id: string | null }).contratante_id)
    .filter((x): x is string => !!x);
}

/** Conjunto de contratante_ids visíveis, ou "todos". Usado pela LISTA. */
export async function contratanteIdsVisiveis(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada
): Promise<Set<string> | "todos"> {
  if (veTodos(sessao)) return "todos";
  const artistas = Object.keys(sessao.vinculos ?? {});
  const set = new Set<string>();
  // (a) contratantes que ele mesmo criou
  const { data: criados, error } = await supabase
    .from("contratantes")
    .select("id")
    .eq("criado_por", sessao.userId)
    .is("deletado_em", null);
  if (error) throw error;
  for (const r of (criados ?? []) as { id: string }[]) set.add(r.id);
  // (b) via orçamentos + vendas (que ele criou OU dos artistas que atende)
  for (const t of ["orcamentos", "vendas"] as const) {
    for (const id of await idsPorOrcVenda(supabase, t, sessao.userId, artistas)) {
      set.add(id);
    }
  }
  return set;
}

/** Um contratante específico é visível? Usado nas rotas [id]. */
export async function contratanteVisivelParaSessao(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada,
  contratanteId: string,
  criadoPor: string | null
): Promise<boolean> {
  if (veTodos(sessao)) return true;
  if (criadoPor && criadoPor === sessao.userId) return true;
  const artistas = Object.keys(sessao.vinculos ?? {});
  for (const t of ["orcamentos", "vendas"] as const) {
    let q = supabase
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("contratante_id", contratanteId)
      .is("deletado_em", null);
    q =
      artistas.length > 0
        ? q.or(`criado_por.eq.${sessao.userId},artist_id.in.(${artistas.join(",")})`)
        : q.eq("criado_por", sessao.userId);
    const { count, error } = await q;
    if (error) throw error;
    if ((count ?? 0) > 0) return true;
  }
  return false;
}
