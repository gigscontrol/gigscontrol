import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParcelaRow, ParcelaEscrita } from "@/lib/mappers/venda";

const COLS =
  "id, workspace_id, venda_id, percentual, valor, data_vencimento, status_base, data_pagamento, observacao, meta";

/** Busca uma parcela por id (usada pra resolver a venda/artista no gate). */
export async function buscarParcela(
  supabase: SupabaseClient,
  id: string
): Promise<ParcelaRow | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ParcelaRow) ?? null;
}

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

/**
 * Apaga TODAS as parcelas de uma venda (delete hard — parcela não tem lixeira).
 *
 * SÓ pode ser chamada quando NENHUMA parcela da venda está paga: apagar uma
 * parcela paga destruiria o registro do pagamento (comprovante, quem/quando,
 * log de cobranças) e isso é irrecuperável. O guard vive em
 * `atualizarVendaPorId` (regra D5), que é o único chamador.
 */
export async function removerParcelasDaVenda(
  supabase: SupabaseClient,
  vendaId: string
): Promise<void> {
  const { error } = await supabase.from("parcelas").delete().eq("venda_id", vendaId);
  if (error) throw error;
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
