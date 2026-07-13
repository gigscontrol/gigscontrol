import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratoRow, ContratoEscrita } from "@/lib/mappers/contrato";
import { softDelete } from "./_softDelete";

const COLS = `
  id, workspace_id, venda_id, modelo_id,
  numero, status, corpo_preenchido, arquivo_url,
  local_assinatura, data_emissao, data_assinatura, observacoes,
  pasta_id, criado_por, criado_em, atualizado_em
`;

export async function listarContratos(
  supabase: SupabaseClient
): Promise<ContratoRow[]> {
  const { data, error } = await supabase
    .from("contratos")
    .select(COLS)
    .is("deletado_em", null)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ContratoRow[];
}

/**
 * Conta os contratos criados a partir de `desdeIso` (ISO) no workspace — usado
 * pra validar o limite mensal do plano (`maxContratosMes`). `desdeIso` é o
 * primeiro instante do mês corrente. Conta por `criado_em` e inclui TAMBÉM os
 * cancelados E os que foram pra lixeira (soft-delete): a geração já consumiu a
 * cota do mês, então apagar + recriar NÃO reseta o limite.
 */
export async function contarContratosDesde(
  supabase: SupabaseClient,
  workspaceId: string,
  desdeIso: string
): Promise<number> {
  const { count, error } = await supabase
    .from("contratos")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("criado_em", desdeIso);
  if (error) throw error;
  return count ?? 0;
}

export async function buscarContrato(
  supabase: SupabaseClient,
  id: string
): Promise<ContratoRow | null> {
  const { data, error } = await supabase
    .from("contratos")
    .select(COLS)
    .eq("id", id)
    .is("deletado_em", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContratoRow) ?? null;
}

export async function criarContrato(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: ContratoEscrita
): Promise<ContratoRow> {
  const { data, error } = await supabase
    .from("contratos")
    .insert({ ...payload, workspace_id: workspaceId })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ContratoRow;
}

export async function atualizarContrato(
  supabase: SupabaseClient,
  id: string,
  payload: ContratoEscrita
): Promise<ContratoRow> {
  const { data, error } = await supabase
    .from("contratos")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ContratoRow;
}

export async function removerContrato(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  // Soft delete — marca deletado_em (mesmo padrão dos modelos/orçamentos).
  await softDelete(supabase, "contratos", id, deletadoPor);
}

export async function proximoNumeroContrato(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  // Numeração ATÔMICA via RPC (migration 60) — sem race nem full-scan.
  const { data, error } = await supabase.rpc("proximo_numero", {
    p_workspace: workspaceId,
    p_tipo: "contrato",
    p_prefixo: "CTR-",
  });
  if (error) throw error;
  return data as string;
}
