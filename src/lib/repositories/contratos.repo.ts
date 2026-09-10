import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratoRow, ContratoEscrita } from "@/lib/mappers/contrato";
import { softDelete } from "./_softDelete";

const COLS = `
  id, workspace_id, venda_id, modelo_id,
  numero, status, corpo_preenchido, arquivo_url,
  local_assinatura, data_emissao, data_assinatura, observacoes,
  pasta_id, criado_por, criado_em, atualizado_em,
  conteudo_hash, conteudo_versao, finalizado_em, verificacao_id,
  pdf_final_hash, pdf_final_path
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

/** Busca pelo ID PÚBLICO de verificação (GC-XXXX-XXXX) — página /verificar. */
export async function buscarPorVerificacaoId(
  admin: SupabaseClient,
  verificacaoId: string
): Promise<ContratoRow | null> {
  const { data, error } = await admin
    .from("contratos")
    .select(COLS)
    .eq("verificacao_id", verificacaoId)
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

/**
 * Atualiza SEM ressuscitar contrato cancelado: o UPDATE só aplica quando
 * status != 'cancelado'. Usado pelo fluxo público de assinatura — a agência
 * pode cancelar durante os 30 min do staging de confirmação por e-mail, e a
 * confirmação não pode reverter o cancelamento. Devolve null se não aplicou.
 */
export async function atualizarContratoSeNaoCancelado(
  admin: SupabaseClient,
  id: string,
  payload: ContratoEscrita
): Promise<ContratoRow | null> {
  const { data, error } = await admin
    .from("contratos")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "cancelado")
    .select(COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContratoRow) ?? null;
}

/**
 * Grava o verificacao_id da finalização SÓ se ainda não existe um (corrida
 * entre os dois últimos signatários: um único vencedor — o perdedor relê e
 * usa o ID gravado, senão o segundo UPDATE sobrescreveria o ID já exibido/
 * carimbado do primeiro). Também não toca contrato cancelado.
 */
export async function atribuirVerificacaoId(
  admin: SupabaseClient,
  id: string,
  payload: ContratoEscrita
): Promise<ContratoRow | null> {
  const { data, error } = await admin
    .from("contratos")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .is("verificacao_id", null)
    .neq("status", "cancelado")
    .select(COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContratoRow) ?? null;
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
