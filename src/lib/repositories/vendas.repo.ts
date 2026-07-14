import type { SupabaseClient } from "@supabase/supabase-js";
import type { VendaRow, VendaEscrita } from "@/lib/mappers/venda";
import { softDelete, restaurarSoftDelete } from "./_softDelete";

const COLS = `
  id, workspace_id, numero, orcamento_id, show_id,
  contratante_id, contratante_nome, contratante_email,
  contratante_telefone, contratante_documento, contratante_endereco,
  nome_evento, evento_instagram, nome_local, capacidade_publico, endereco_local,
  data_show, horario, horario_fim, fuso_horario, cidade_id, casa_id, artist_id,
  line_up, cache, duracao_horas, duracao_minutos,
  camarim, efeitos, hotel, logistica,
  observacoes, info_extra,
  taxa_agencia_valor, taxa_modo_aplicado, status,
  criado_por, criado_em, atualizado_em,
  criador:profiles!vendas_criado_por_fkey ( nome )
`;

export async function listarVendas(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<VendaRow[]> {
  let q = supabase
    .from("vendas")
    .select(COLS)
    .is("deletado_em", null)
    .order("criado_em", { ascending: false });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as VendaRow[];
}

export async function listarVendasDeletadas(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<(VendaRow & { deletado_em: string | null })[]> {
  const { data, error } = await supabase
    .from("vendas")
    .select(`${COLS}, deletado_em`)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (VendaRow & { deletado_em: string | null })[];
}

export async function buscarVenda(
  supabase: SupabaseClient,
  id: string
): Promise<VendaRow | null> {
  const { data, error } = await supabase
    .from("vendas")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as VendaRow) ?? null;
}

/**
 * Mapa id → { artist_id, criado_por } de várias vendas (batch). Usado pelo
 * escopo de CONTRATOS, que resolve o artista pelo venda_id de cada contrato.
 * Respeita RLS/deleção implícitas do cliente passado (só retorna o que ele vê).
 */
export async function escoposDeVendas(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, { artistId: string | null; criadoPor: string | null }>> {
  const map = new Map<string, { artistId: string | null; criadoPor: string | null }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("vendas")
    .select("id, artist_id, criado_por")
    .in("id", ids);
  if (error) throw error;
  for (const row of (data ?? []) as { id: string; artist_id: string | null; criado_por: string | null }[]) {
    map.set(row.id, { artistId: row.artist_id ?? null, criadoPor: row.criado_por ?? null });
  }
  return map;
}

export async function moverVendaParaLixeira(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await softDelete(supabase, "vendas", id, deletadoPor);
}

export async function restaurarVenda(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await restaurarSoftDelete(supabase, "vendas", id);
}

export async function proximoNumeroVenda(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  // Numeração ATÔMICA via RPC (migration 60): incrementa o contador do
  // workspace numa única operação com lock de linha — sem race (dois creates
  // simultâneos não pegam mais o mesmo número) nem full-scan da tabela.
  const { data, error } = await supabase.rpc("proximo_numero", {
    p_workspace: workspaceId,
    p_tipo: "venda",
    p_prefixo: "VND-",
  });
  if (error) throw error;
  return data as string;
}

export async function criarVendaRow(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  payload: VendaEscrita
): Promise<VendaRow> {
  const { data, error } = await supabase
    .from("vendas")
    .insert({ ...payload, workspace_id: workspaceId, criado_por: criadoPor })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as VendaRow;
}

export async function atualizarVendaRow(
  supabase: SupabaseClient,
  id: string,
  payload: VendaEscrita
): Promise<VendaRow> {
  const { data, error } = await supabase
    .from("vendas")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as VendaRow;
}

export async function removerVendaRow(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  // Soft delete — vai pra lixeira por 30 dias. Hard delete real
  // acontece via pg_cron (parcelas vão junto por FK CASCADE).
  await moverVendaParaLixeira(supabase, id, deletadoPor);
}
