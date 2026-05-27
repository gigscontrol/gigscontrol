import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShowRow, ShowEscrita } from "@/lib/mappers/show";

/**
 * Camada de acesso a dados de `shows`.
 *
 * Recebe um cliente Supabase já autenticado (via `criarClienteServidor`).
 * Toda query confia no RLS — o filtro por workspace_id está no banco.
 */

// Traz o `deletado_em` do artist pra conseguir esconder na listagem
// shows cujo artista foi soft-deletado (mandado pra lixeira).
const SELECT_COM_JOINS = `
  id, workspace_id, artist_id, contratante_id, casa_id, cidade_id,
  data, horario, status, valor, orcamento_id, venda_id, criado_em,
  artist:artists ( id, nome, deletado_em ),
  casa:casas ( id, nome ),
  cidade:cidades ( id, nome, estado )
`;

export async function listarShows(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<ShowRow[]> {
  let q = supabase
    .from("shows")
    .select(SELECT_COM_JOINS)
    .is("deletado_em", null)
    .order("data", { ascending: true });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  // Esconde shows cujo artista foi soft-deletado (artist_id NULL ainda
  // aparece — é um show "sem artista" intencional). Quando o admin
  // restaura o artista pela lixeira, esses shows voltam a aparecer.
  return ((data ?? []) as unknown as ShowRow[]).filter(
    (r) => !r.artist_id || (r.artist && r.artist.deletado_em === null)
  );
}

export async function listarShowsDeletados(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<(ShowRow & { deletado_em: string | null })[]> {
  const { data, error } = await supabase
    .from("shows")
    .select(`${SELECT_COM_JOINS}, deletado_em`)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (ShowRow & { deletado_em: string | null })[];
}

export async function moverShowParaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("shows")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restaurarShow(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("shows")
    .update({ deletado_em: null })
    .eq("id", id);
  if (error) throw error;
}

export async function buscarShow(
  supabase: SupabaseClient,
  id: string
): Promise<ShowRow | null> {
  const { data, error } = await supabase
    .from("shows")
    .select(SELECT_COM_JOINS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ShowRow) ?? null;
}

export async function criarShow(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: ShowEscrita
): Promise<ShowRow> {
  const { data, error } = await supabase
    .from("shows")
    .insert({ ...payload, workspace_id: workspaceId })
    .select(SELECT_COM_JOINS)
    .single();

  if (error) throw error;
  return data as unknown as ShowRow;
}

export async function atualizarShow(
  supabase: SupabaseClient,
  id: string,
  payload: ShowEscrita
): Promise<ShowRow> {
  const { data, error } = await supabase
    .from("shows")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COM_JOINS)
    .single();

  if (error) throw error;
  return data as unknown as ShowRow;
}

export async function removerShow(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // Soft delete — fica na lixeira por 30 dias.
  await moverShowParaLixeira(supabase, id);
}
