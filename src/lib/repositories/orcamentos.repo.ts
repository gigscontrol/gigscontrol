import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrcamentoRow, OrcamentoEscrita } from "@/lib/mappers/orcamento";
import { softDelete, restaurarSoftDelete } from "./_softDelete";

const COLS = `
  id, workspace_id, numero, status, tipo_evento,
  contratante_id, casa_id, cidade_id, artist_id,
  valor_cache, duracao_horas, duracao_minutos,
  camarim, efeitos, hotel, logistica,
  observacoes, info_extra, detalhes_evento,
  data_show, horario, fuso_horario, validade, show_id,
  taxa_agencia_valor, taxa_modo_aplicado,
  criado_por, criado_em, atualizado_em,
  criador:profiles!orcamentos_criado_por_fkey ( nome )
`;

export async function listarOrcamentos(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<OrcamentoRow[]> {
  let q = supabase
    .from("orcamentos")
    .select(COLS)
    .is("deletado_em", null)
    .order("criado_em", { ascending: false });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as OrcamentoRow[];
}

export async function listarOrcamentosDeletados(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<(OrcamentoRow & { deletado_em: string | null })[]> {
  const { data, error } = await supabase
    .from("orcamentos")
    .select(`${COLS}, deletado_em`)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (OrcamentoRow & { deletado_em: string | null })[];
}

export async function moverOrcamentoParaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await softDelete(supabase, "orcamentos", id);
}

export async function restaurarOrcamento(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await restaurarSoftDelete(supabase, "orcamentos", id);
}

export async function buscarOrcamento(
  supabase: SupabaseClient,
  id: string
): Promise<OrcamentoRow | null> {
  const { data, error } = await supabase
    .from("orcamentos")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as OrcamentoRow) ?? null;
}

export async function proximoNumeroOrcamento(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  // Numeração ATÔMICA via RPC (migration 60) — sem race nem full-scan.
  const { data, error } = await supabase.rpc("proximo_numero", {
    p_workspace: workspaceId,
    p_tipo: "orcamento",
    p_prefixo: "ORC-",
  });
  if (error) throw error;
  return data as string;
}

export async function criarOrcamento(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  payload: OrcamentoEscrita
): Promise<OrcamentoRow> {
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({ ...payload, workspace_id: workspaceId, criado_por: criadoPor })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as OrcamentoRow;
}

export async function atualizarOrcamento(
  supabase: SupabaseClient,
  id: string,
  payload: OrcamentoEscrita
): Promise<OrcamentoRow> {
  const { data, error } = await supabase
    .from("orcamentos")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as OrcamentoRow;
}

export async function removerOrcamento(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // Soft delete — fica na lixeira por 30 dias.
  await moverOrcamentoParaLixeira(supabase, id);
}
