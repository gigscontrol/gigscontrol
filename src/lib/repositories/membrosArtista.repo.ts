import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acesso a `membros_artista` — o vínculo (usuário × artista) que carrega os
 * perfis aplicados e o conjunto EFETIVO de permissões concedidas.
 *
 * `permissoes` é jsonb no banco (array de chaves). RLS escopa por workspace.
 */
export type VinculoRow = {
  id: string;
  user_id: string;
  artist_id: string;
  perfis: string[];
  permissoes: string[];
};

const COLS = "id, user_id, artist_id, perfis, permissoes";

function normalizarPermissoes(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

function normalizarPerfis(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

function normalizar(row: Record<string, unknown>): VinculoRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    artist_id: String(row.artist_id),
    perfis: normalizarPerfis(row.perfis),
    permissoes: normalizarPermissoes(row.permissoes),
  };
}

/** Vínculos ativos de um usuário (todos os artistas a que ele tem acesso). */
export async function listarVinculosDoUsuario(
  supabase: SupabaseClient,
  userId: string
): Promise<VinculoRow[]> {
  const { data, error } = await supabase
    .from("membros_artista")
    .select(COLS)
    .eq("user_id", userId)
    .is("deletado_em", null);
  if (error) throw error;
  return (data ?? []).map((r) => normalizar(r as Record<string, unknown>));
}

/** Vínculos ativos de um artista (todos os membros da equipe dele). */
export async function listarVinculosDoArtista(
  supabase: SupabaseClient,
  artistId: string
): Promise<VinculoRow[]> {
  const { data, error } = await supabase
    .from("membros_artista")
    .select(COLS)
    .eq("artist_id", artistId)
    .is("deletado_em", null);
  if (error) throw error;
  return (data ?? []).map((r) => normalizar(r as Record<string, unknown>));
}

/** Mapa artist_id → permissões concedidas (formato consumido pelo motor). */
export function mapaDeVinculos(rows: VinculoRow[]): Record<string, string[]> {
  const mapa: Record<string, string[]> = {};
  for (const v of rows) mapa[v.artist_id] = v.permissoes;
  return mapa;
}
