import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParcelaRow, ParcelaEscrita } from "@/lib/mappers/venda";

const COLS =
  "id, workspace_id, venda_id, percentual, valor, data_vencimento, status_base, data_pagamento, observacao";

export async function listarParcelasDaVenda(
  supabase: SupabaseClient,
  vendaId: string
): Promise<ParcelaRow[]> {
  const { data, error } = await supabase
    .from("parcelas")
    .select(COLS)
    .eq("venda_id", vendaId)
    .order("data_vencimento", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ParcelaRow[];
}

export async function listarTodasParcelas(
  supabase: SupabaseClient
): Promise<ParcelaRow[]> {
  const { data, error } = await supabase
    .from("parcelas")
    .select(COLS)
    .order("data_vencimento", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ParcelaRow[];
}

export async function inserirParcelasEmLote(
  supabase: SupabaseClient,
  workspaceId: string,
  vendaId: string,
  payloads: ParcelaEscrita[]
): Promise<ParcelaRow[]> {
  if (payloads.length === 0) return [];
  const rows = payloads.map((p) => ({
    ...p,
    workspace_id: workspaceId,
    venda_id: vendaId,
  }));
  const { data, error } = await supabase.from("parcelas").insert(rows).select(COLS);
  if (error) throw error;
  return (data ?? []) as unknown as ParcelaRow[];
}

export async function atualizarParcelaRow(
  supabase: SupabaseClient,
  id: string,
  payload: ParcelaEscrita
): Promise<ParcelaRow> {
  const { data, error } = await supabase
    .from("parcelas")
    .update(payload)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ParcelaRow;
}
