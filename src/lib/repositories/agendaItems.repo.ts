import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaItemRow, AgendaItemEscrita } from "@/lib/mappers/agendaItem";
import { softDelete } from "./_softDelete";

/**
 * Acesso a dados de `agenda_items`. Cliente já autenticado — o filtro por
 * workspace_id está no RLS (igual `shows`). Soft delete via `deletado_em`.
 */

const SELECT = `
  id, workspace_id, artist_id, tipo, titulo, data, data_fim,
  dia_inteiro, hora_inicio, hora_fim, dados, observacoes, criado_em, criado_por
`;

/**
 * Conta vouchers de aérea (agenda_items com `dados.voucherPath`) criados desde
 * `desdeIso` — janela do limite de uploads do ciclo. Inclui os que foram pra
 * lixeira (o upload já consumiu a cota), pra não driblar com apagar + recriar.
 */
export async function contarVouchersDesde(
  supabase: SupabaseClient,
  workspaceId: string,
  desdeIso: string
): Promise<number> {
  const { count, error } = await supabase
    .from("agenda_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("dados->>voucherPath", "is", null)
    .gte("criado_em", desdeIso);
  if (error) throw error;
  return count ?? 0;
}

export async function listarAgendaItems(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<AgendaItemRow[]> {
  let q = supabase
    .from("agenda_items")
    .select(SELECT)
    .is("deletado_em", null)
    .order("data", { ascending: true });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AgendaItemRow[];
}

export async function buscarAgendaItem(
  supabase: SupabaseClient,
  id: string
): Promise<AgendaItemRow | null> {
  const { data, error } = await supabase
    .from("agenda_items")
    .select(SELECT)
    .eq("id", id)
    .is("deletado_em", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as AgendaItemRow) ?? null;
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

export async function atualizarAgendaItem(
  supabase: SupabaseClient,
  id: string,
  payload: AgendaItemEscrita
): Promise<AgendaItemRow> {
  const { data, error } = await supabase
    .from("agenda_items")
    .update(payload)
    .eq("id", id)
    .is("deletado_em", null)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as AgendaItemRow;
}

export async function removerAgendaItem(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  // Soft delete — mantém o histórico (igual shows).
  await softDelete(supabase, "agenda_items", id, deletadoPor);
}
