import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratoRow, ContratoEscrita } from "@/lib/mappers/contrato";

const COLS = `
  id, workspace_id, venda_id, modelo_id,
  numero, status, corpo_preenchido, arquivo_url,
  local_assinatura, data_emissao, data_assinatura, observacoes,
  criado_em, atualizado_em
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
 * Conta os contratos (não-deletados) criados a partir de `desdeIso` (ISO) no
 * workspace — usado pra validar o limite mensal do plano (`maxContratosMes`).
 * `desdeIso` é o primeiro instante do mês corrente. Conta por `criado_em`,
 * incluindo cancelados (a geração já consumiu a cota do mês).
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
    .is("deletado_em", null)
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
  id: string
): Promise<void> {
  // Soft delete — marca deletado_em (mesmo padrão dos modelos/orçamentos).
  const { error } = await supabase
    .from("contratos")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function proximoNumeroContrato(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  // Mesmo padrão de vendas/orçamentos (reduce do maior sufixo numérico),
  // mas com prefixo "CTR-" e escopado por workspace + não-deletados, pra
  // bater com o índice único contratos_numero_uniq (workspace_id, numero).
  const { data, error } = await supabase
    .from("contratos")
    .select("numero")
    .eq("workspace_id", workspaceId)
    .is("deletado_em", null);
  if (error) throw error;
  const max = (data ?? []).reduce((acc, c) => {
    const n = parseInt(String(c.numero).replace(/\D/g, ""), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `CTR-${String(max + 1).padStart(4, "0")}`;
}
