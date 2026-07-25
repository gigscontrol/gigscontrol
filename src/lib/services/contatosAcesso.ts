import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessaoAutenticada } from "@/lib/api/session";
import { escopoContatosDoArtista } from "@/lib/permissoes/resolver";
import { escopoContatosEquipe } from "@/lib/api/permissoes";

/**
 * Visibilidade de CONTATOS (contratantes/casas) — enforcement por UNIÃO dos
 * vínculos (D2). Modelo NOVO, sem "dono fixo" e sem migration.
 *
 * EQUIPE (operacional) — derivada de `escopoContatosEquipe` (ver permissoes.ts):
 *   - "todos"    → vê todos os contatos do workspace;
 *   - "proprios" → só os que ELE criou (contratantes.criado_por);
 *   - "nenhum"   → não vê contato algum.
 * Admin/super → "todos". Legado (sem vínculo) → "nenhum" (o legado morreu; sem
 * chave de contatos em vínculo, não vê nada).
 *
 * ARTISTA (papel === "artista") — INALTERADO: governado por `privacidade.contatos`
 * ("nenhum" | "proprios" | "todos"). "proprios" deriva os contatos ligados aos
 * SHOWS/vendas/orçamentos do PRÓPRIO artista (via artist_id).
 *
 * NOTA sobre CASAS: a tabela `casas` TEM `criado_por` (usado na MUTAÇÃO, por
 * autoria — ver o gate de casas). Mas a VISIBILIDADE é DE PROPÓSITO de catálogo:
 * locais são um diretório compartilhado da equipe (o mesmo clube atende vários
 * artistas), então qualquer permissão de leitura de contatos (ver OU
 * ver_proprios) mostra o catálogo inteiro; só "nenhum" esconde tudo. A assimetria
 * é intencional — leitura ampla, escrita por autoria. Para o artista, casas
 * seguem privacidade.contatos com "proprios" derivado dos eventos dele.
 */

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

/** contratante_ids que o usuário CRIOU (escopo "proprios" da equipe). */
async function contratantesCriadosPor(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("contratantes")
    .select("id")
    .eq("criado_por", userId)
    .is("deletado_em", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of (data ?? []) as { id: string }[]) set.add(r.id);
  return set;
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
  // Equipe/admin: união dos vínculos (contatos.ver → todos; ver_proprios → os
  // que ele criou; nenhum → vazio).
  const escopo = escopoContatosEquipe(sessao);
  if (escopo === "todos") return "todos";
  if (escopo === "nenhum") return new Set<string>();
  return contratantesCriadosPor(supabase, sessao.userId);
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
  // Equipe/admin: "todos" → sim; "nenhum" → não; "proprios" → só se ELE criou.
  const escopo = escopoContatosEquipe(sessao);
  if (escopo === "todos") return true;
  if (escopo === "nenhum") return false;
  return !!criadoPor && criadoPor === sessao.userId;
}

// ============================================================
// CASAS — diretório de locais compartilhado do workspace. `casas.criado_por`
// EXISTE e governa a MUTAÇÃO (por autoria), mas a VISIBILIDADE é ampla DE
// PROPÓSITO: o mesmo clube atende vários artistas. O ARTISTA é filtrado por
// privacidade.contatos ("proprios" = casas dos eventos dele). Para a EQUIPE,
// "ver" e "ver_proprios" mostram o catálogo inteiro; só "nenhum" (sem permissão
// de contatos) esconde tudo. Assimetria intencional: leitura ampla, escrita por autoria.
// ============================================================

/** Conjunto de casa_ids visíveis, ou "todos". Usado pela LISTA de casas. */
export async function casaIdsVisiveis(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada
): Promise<Set<string> | "todos"> {
  if (sessao.papel === "artista") {
    const escopo = escopoContatosArtista(sessao);
    if (escopo === "todos") return "todos";
    if (escopo === "nenhum" || !sessao.artistaId) return new Set<string>();
    return idsPorArtistaEmFontes(supabase, "casa_id", sessao.artistaId);
  }
  // Equipe/admin: diretório compartilhado. Visibilidade ampla de propósito
  // (não filtra por criado_por): qualquer leitura de contatos mostra tudo; só
  // "nenhum" esconde. A autoria de casas vale só na escrita (gate de mutação).
  return escopoContatosEquipe(sessao) === "nenhum" ? new Set<string>() : "todos";
}

/** Uma casa específica é visível? Usado nas rotas [id] de casas. */
export async function casaVisivelParaSessao(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada,
  casaId: string
): Promise<boolean> {
  if (sessao.papel === "artista") {
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
  // Equipe/admin: catálogo — visível a menos que sem permissão de contatos.
  return escopoContatosEquipe(sessao) !== "nenhum";
}
