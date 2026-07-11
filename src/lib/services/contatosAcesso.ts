import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessaoAutenticada } from "@/lib/api/session";
import { escopoContatosDoArtista } from "@/lib/permissoes/resolver";

/**
 * Visibilidade de CONTRATANTES — modelo NOVO, derivada (sem "dono fixo" e sem
 * migration). Um contratante é visível para o usuário se:
 *   - ele CRIOU o contratante (contratantes.criado_por), OU
 *   - existe orçamento/venda desse contratante que ELE criou, OU
 *   - existe orçamento/venda desse contratante para um ARTISTA que ele atende
 *     (tem vínculo em membros_artista).
 * A visibilidade ACUMULA: cada novo orçamento/venda pode passar a exibir o
 * contato para mais gente.
 *
 * Admin/super e usuário LEGADO (sem vínculos) veem TODOS ("todos"), pra não
 * trancar ninguém na transição — mesmo padrão dos outros módulos.
 *
 * ARTISTA (papel === "artista"): governado por `privacidade.contatos`
 * ("nenhum" | "proprios" | "todos"). "proprios" deriva os contatos ligados aos
 * SHOWS/vendas/orçamentos do PRÓPRIO artista (via artist_id). Ver
 * `escopoContatosArtista` / `idsPorArtistaEmFontes` abaixo. CASAS também passam
 * a ser filtradas para o artista (só as dos eventos dele) — para os demais
 * papéis casas seguem catálogo do workspace ("todos").
 */

/** Vê todos os contratantes? (admin/super/legado). NÃO decide artista. */
function veTodos(sessao: SessaoAutenticada): boolean {
  return (
    sessao.isSuperAdmin ||
    sessao.papel === "admin" ||
    sessao.vinculos === undefined
  );
}

/**
 * Escopo de contatos do artista (só faz sentido quando papel === "artista").
 * Reflete `privacidade.contatos` via resolver.
 */
function escopoContatosArtista(
  sessao: SessaoAutenticada
): "nenhum" | "proprios" | "todos" {
  return escopoContatosDoArtista(sessao.privacidade);
}

/**
 * Coleta os `coluna` (contratante_id / casa_id) que aparecem nas fontes
 * (shows/orçamentos/vendas) para um ARTISTA específico (artist_id). Usado no
 * escopo "proprios" do artista — os contatos que participam dos eventos dele.
 * As 3 consultas são independentes → roda em paralelo.
 */
async function idsPorArtistaEmFontes(
  supabase: SupabaseClient,
  coluna: "contratante_id" | "casa_id",
  artistaId: string
): Promise<Set<string>> {
  const fontes = ["shows", "orcamentos", "vendas"] as const;
  const resultados = await Promise.all(
    fontes.map(async (tabela) => {
      const { data, error } = await supabase
        .from(tabela)
        .select(coluna)
        .eq("artist_id", artistaId)
        .not(coluna, "is", null)
        .is("deletado_em", null);
      if (error) throw error;
      const linhas = (data ?? []) as unknown as Record<string, string | null>[];
      return linhas.map((r) => r[coluna]).filter((x): x is string => !!x);
    })
  );
  const set = new Set<string>();
  for (const ids of resultados) for (const id of ids) set.add(id);
  return set;
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
  // Artista: governado pela privacidade (nenhum/proprios/todos).
  if (sessao.papel === "artista") {
    const escopo = escopoContatosArtista(sessao);
    if (escopo === "todos") return "todos";
    if (escopo === "nenhum" || !sessao.artistaId) return new Set<string>();
    return idsPorArtistaEmFontes(supabase, "contratante_id", sessao.artistaId);
  }
  if (veTodos(sessao)) return "todos";
  const artistas = Object.keys(sessao.vinculos ?? {});
  const set = new Set<string>();
  // (a) contratantes que ele mesmo criou + (b) via orçamentos/vendas (dele ou
  // dos artistas que atende) — as 3 queries são independentes, roda em paralelo.
  const [criadosRes, idsOrc, idsVenda] = await Promise.all([
    supabase
      .from("contratantes")
      .select("id")
      .eq("criado_por", sessao.userId)
      .is("deletado_em", null),
    idsPorOrcVenda(supabase, "orcamentos", sessao.userId, artistas),
    idsPorOrcVenda(supabase, "vendas", sessao.userId, artistas),
  ]);
  if (criadosRes.error) throw criadosRes.error;
  for (const r of (criadosRes.data ?? []) as { id: string }[]) set.add(r.id);
  for (const id of idsOrc) set.add(id);
  for (const id of idsVenda) set.add(id);
  return set;
}

/** Um contratante específico é visível? Usado nas rotas [id]. */
export async function contratanteVisivelParaSessao(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada,
  contratanteId: string,
  criadoPor: string | null
): Promise<boolean> {
  // Artista: mesma regra da lista — "todos" liberado; "nenhum" bloqueia; em
  // "proprios" só se o contratante participa de um evento (show/venda/orçamento)
  // do próprio artista. (criado_por não conta: artista não cria contatos.)
  if (sessao.papel === "artista") {
    const escopo = escopoContatosArtista(sessao);
    if (escopo === "todos") return true;
    if (escopo === "nenhum" || !sessao.artistaId) return false;
    for (const t of ["shows", "orcamentos", "vendas"] as const) {
      const { count, error } = await supabase
        .from(t)
        .select("id", { count: "exact", head: true })
        .eq("contratante_id", contratanteId)
        .eq("artist_id", sessao.artistaId)
        .is("deletado_em", null);
      if (error) throw error;
      if ((count ?? 0) > 0) return true;
    }
    return false;
  }
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

// ============================================================
// CASAS — catálogo do workspace para admin/equipe ("todos", igual hoje). Só o
// ARTISTA é filtrado por privacidade.contatos (nenhum/proprios/todos), com
// "proprios" derivado das casas dos SHOWS/vendas/orçamentos do próprio artista.
// ============================================================

/** Conjunto de casa_ids visíveis, ou "todos". Usado pela LISTA de casas. */
export async function casaIdsVisiveis(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada
): Promise<Set<string> | "todos"> {
  if (sessao.papel !== "artista") return "todos"; // admin/equipe/legado: catálogo
  const escopo = escopoContatosArtista(sessao);
  if (escopo === "todos") return "todos";
  if (escopo === "nenhum" || !sessao.artistaId) return new Set<string>();
  return idsPorArtistaEmFontes(supabase, "casa_id", sessao.artistaId);
}

/** Uma casa específica é visível? Usado nas rotas [id] de casas. */
export async function casaVisivelParaSessao(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada,
  casaId: string
): Promise<boolean> {
  if (sessao.papel !== "artista") return true; // admin/equipe/legado: catálogo
  const escopo = escopoContatosArtista(sessao);
  if (escopo === "todos") return true;
  if (escopo === "nenhum" || !sessao.artistaId) return false;
  for (const t of ["shows", "orcamentos", "vendas"] as const) {
    const { count, error } = await supabase
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("casa_id", casaId)
      .eq("artist_id", sessao.artistaId)
      .is("deletado_em", null);
    if (error) throw error;
    if ((count ?? 0) > 0) return true;
  }
  return false;
}
