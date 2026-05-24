import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShowRow, ShowEscrita } from "@/lib/mappers/show";

/**
 * Camada de acesso a dados de `shows`.
 *
 * Recebe um cliente Supabase já autenticado (via `criarClienteServidor`).
 * Toda query confia no RLS — o filtro por workspace_id está no banco.
 */

const SELECT_COM_JOINS = `
  id, workspace_id, artist_id, contratante_id, casa_id, cidade_id,
  data, horario, status, valor, orcamento_id, venda_id, criado_em,
  artist:artists ( id, nome ),
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
    .order("data", { ascending: true });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ShowRow[];
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
  const { error } = await supabase.from("shows").delete().eq("id", id);
  if (error) throw error;
}
