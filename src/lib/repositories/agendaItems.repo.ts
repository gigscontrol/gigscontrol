import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaItemRow, AgendaItemEscrita } from "@/lib/mappers/agendaItem";

/**
 * Acesso a dados de `agenda_items`. Cliente já autenticado — o filtro por
 * workspace_id está no RLS (igual `shows`). Soft delete via `deletado_em`.
 */

const SELECT = `
  id, workspace_id, artist_id, tipo, titulo, data, data_fim,
  dia_inteiro, hora_inicio, hora_fim, dados, observacoes, criado_em
`;

export async function listarAgendaItems(
  supabase: SupabaseClient
): Promise<AgendaItemRow[]> {
  const { data, error } = await supabase
    .from("agenda_items")
    .select(SELECT)
    .is("deletado_em", null)
    .order("data", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AgendaItemRow[];
}

export async function criarAgendaItem(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: AgendaItemEscrita
): Promise<AgendaItemRow> {
  const { data, error } = await supabase
    .from("agenda_items")
    .insert({ ...payload, workspace_id: workspaceId })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as AgendaItemRow;
}

export async function removerAgendaItem(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // Soft delete — mantém o histórico (igual shows).
  const { error } = await supabase
    .from("agenda_items")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
