import type { SupabaseClient } from "@supabase/supabase-js";
import { expandirLegadoVinculo } from "@/lib/permissoes/legadoEquipe";

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
  // Expande as chaves LEGADAS na leitura: agenda (setores) + os 4 módulos da
  // equipe v2 (vendas/financeiro/contratos/contatos). Sem isto, todo vínculo
  // gravado antes da mudança perderia acesso no primeiro deploy — o banco fica
  // intacto, a tradução acontece na leitura. O cliente (auth-context) chama a
  // MESMA função (`expandirLegadoVinculo`) para não divergir.
  for (const v of rows) mapa[v.artist_id] = expandirLegadoVinculo(v.permissoes);
  return mapa;
}

/**
 * Cria ou atualiza o vínculo ativo (usuário × artista). Um vínculo ativo por
 * par (índice único parcial), então busca o ativo e atualiza, senão insere.
 * Usa o cliente ADMIN (a rota valida workspace/admin antes).
 */
export async function upsertVinculo(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    userId: string;
    artistId: string;
    perfis: string[];
    permissoes: string[];
  }
): Promise<VinculoRow> {
  const { data: existente } = await admin
    .from("membros_artista")
    .select("id")
    .eq("user_id", params.userId)
    .eq("artist_id", params.artistId)
    .is("deletado_em", null)
    .maybeSingle();

  if (existente) {
    const { data, error } = await admin
      .from("membros_artista")
      .update({ perfis: params.perfis, permissoes: params.permissoes })
      .eq("id", (existente as { id: string }).id)
      .select(COLS)
      .single();
    if (error) throw error;
    return normalizar(data as Record<string, unknown>);
  }

  const { data, error } = await admin
    .from("membros_artista")
    .insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      artist_id: params.artistId,
      perfis: params.perfis,
      permissoes: params.permissoes,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return normalizar(data as Record<string, unknown>);
}

/** Soft delete do vínculo ativo (usuário × artista). */
export async function removerVinculo(
  admin: SupabaseClient,
  userId: string,
  artistId: string,
  deletadoPor?: string
): Promise<void> {
  // Soft-delete inline (não usa o helper `softDelete` porque filtra por
  // chave composta user_id + artist_id, não por id). `deletadoPor` grava
  // quem apagou quando presente.
  const patch: { deletado_em: string; deletado_por?: string } = {
    deletado_em: new Date().toISOString(),
  };
  if (deletadoPor) patch.deletado_por = deletadoPor;
  const { error } = await admin
    .from("membros_artista")
    .update(patch)
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .is("deletado_em", null);
  if (error) throw error;
}
