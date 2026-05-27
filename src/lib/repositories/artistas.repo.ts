import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtistaRow, ArtistaEscrita } from "@/lib/mappers/artista";

const COLS =
  "id, workspace_id, nome, cor, acesso_suspenso, deletado_em, criado_em, " +
  "cidade_ibge_id, cidade_nome, cidade_uf, taxa_modo, taxa_valor, " +
  "rider_camarim, rider_efeitos";

/** Lista só ativos (deletado_em IS NULL). */
export async function listarArtistas(
  supabase: SupabaseClient
): Promise<ArtistaRow[]> {
  const { data, error } = await supabase
    .from("artists")
    .select(COLS)
    .is("deletado_em", null)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ArtistaRow[];
}

/** Lista só os que estão na lixeira. */
export async function listarArtistasDeletados(
  supabase: SupabaseClient
): Promise<ArtistaRow[]> {
  const { data, error } = await supabase
    .from("artists")
    .select(COLS)
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
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from("artists")
    .select("id", { count: "exact", head: true })
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
  const { error } = await supabase
    .from("artists")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Restaura — zera deletado_em. */
export async function restaurarArtista(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("artists")
    .update({ deletado_em: null })
    .eq("id", id);
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
