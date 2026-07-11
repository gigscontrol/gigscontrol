import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtistaRow, ArtistaEscrita } from "@/lib/mappers/artista";
import { softDelete } from "./_softDelete";

const COLS =
  "id, workspace_id, nome, cor, acesso_suspenso, deletado_em, criado_em, " +
  "cidade_ibge_id, cidade_nome, cidade_uf, taxa_modo, taxa_valor, " +
  "rider_camarim, rider_efeitos, rider_tecnico, posicao, privacidade, " +
  "pais, nome_legal, documento_tipo, documento, razao_social, endereco, telefone, " +
  "data_nascimento";

/** Lista só ativos (deletado_em IS NULL), ordenados por posição manual. */
export async function listarArtistas(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ArtistaRow[]> {
  const { data, error } = await supabase
    .from("artists")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .is("deletado_em", null)
    // Posição manual primeiro (drag&drop em Configurações), nome como
    // desempate. Linhas com posicao NULL (não devem existir após
    // migração 23) caem pro fim.
    .order("posicao", { ascending: true, nullsFirst: false })
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ArtistaRow[];
}

/** Lista só os que estão na lixeira. */
export async function listarArtistasDeletados(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ArtistaRow[]> {
  const { data, error } = await supabase
    .from("artists")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ArtistaRow[];
}

export async function buscarArtista(
  supabase: SupabaseClient,
  id: string
): Promise<ArtistaRow | null> {
  const { data, error } = await supabase
    .from("artists")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ArtistaRow) ?? null;
}

/** Conta só ativos — usado no enforce do limite do plano. */
export async function contarArtistas(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("artists")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("deletado_em", null);
  if (error) throw error;
  return count ?? 0;
}

export async function criarArtista(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: ArtistaEscrita
): Promise<ArtistaRow> {
  const { data, error } = await supabase
    .from("artists")
    .insert({ ...payload, workspace_id: workspaceId })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ArtistaRow;
}

export async function atualizarArtista(
  supabase: SupabaseClient,
  id: string,
  payload: ArtistaEscrita
): Promise<ArtistaRow> {
  const { data, error } = await supabase
    .from("artists")
    .update(payload)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ArtistaRow;
}

/** Soft delete — marca deletado_em = now(). */
export async function moverArtistaParaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await softDelete(supabase, "artists", id);
}

/** Restaura — zera deletado_em. */
export async function restaurarArtista(
  supabase: SupabaseClient,
  id: string,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase
    .from("artists")
    .update({ deletado_em: null })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
}

/** Apaga definitivamente (irrecuperável). */
export async function removerArtistaDefinitivamente(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("artists").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Próxima posição disponível pra um artista novo (= MAX + 10).
 * Novos artistas vão pro FIM da lista; admin reordena depois.
 */
export async function proximaPosicaoArtista(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("artists")
    .select("posicao")
    .eq("workspace_id", workspaceId)
    .order("posicao", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw error;
  const max = (data?.[0]?.posicao as number | null) ?? 0;
  return max + 10;
}

/**
 * Atualiza a posição de vários artistas em lote.
 * Não usa transação (Supabase JS não expõe). Os updates são independentes
 * (cada artista tem a sua posição), então rodam em PARALELO em vez de um por
 * vez. Se algum falhar, a UI recarrega e mostra o estado atual do banco — o
 * usuário arrasta de novo.
 */
export async function atualizarPosicoes(
  supabase: SupabaseClient,
  updates: Array<{ id: string; posicao: number }>
): Promise<void> {
  const resultados = await Promise.all(
    updates.map((u) =>
      supabase.from("artists").update({ posicao: u.posicao }).eq("id", u.id)
    )
  );
  const primeiroErro = resultados.find((r) => r.error)?.error;
  if (primeiroErro) throw primeiroErro;
}

/**
 * Verifica se um username já está em uso (em profiles). Usado pelo
 * service de criação pra evitar colisão antes de criar o auth user.
 */
export async function usernameJaExiste(
  supabase: SupabaseClient,
  username: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", username);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Busca o slug do workspace — usado pra montar o username final. */
export async function buscarSlugWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();
  if (error || !data?.slug) {
    throw new Error("Workspace sem slug — rode o SQL 21.");
  }
  return data.slug as string;
}

/**
 * Busca um artista incluindo o username (via join com profiles).
 * Útil quando a UI precisa mostrar o username já cadastrado.
 */
export async function buscarArtistaComUsername(
  supabase: SupabaseClient,
  id: string
): Promise<(ArtistaRow & { username: string | null }) | null> {
  const { data: artista, error } = await supabase
    .from("artists")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!artista) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("artista_id", id)
    .maybeSingle();
  return {
    ...(artista as unknown as ArtistaRow),
    username: (profile?.username as string) ?? null,
  };
}
