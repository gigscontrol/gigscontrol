import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContratoModeloRow,
  ContratoModeloEscrita,
} from "@/lib/mappers/contratoModelo";

const COLS = `
  id, workspace_id, nome, tipo,
  corpo, secoes, arquivo_url, arquivo_nome,
  criado_em, atualizado_em
`;

export async function listarModelos(
  supabase: SupabaseClient
): Promise<ContratoModeloRow[]> {
  const { data, error } = await supabase
    .from("contrato_modelos")
    .select(COLS)
    .is("deletado_em", null)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ContratoModeloRow[];
}

/**
 * Conta os modelos editáveis (não-deletados) do workspace — usado pra
 * validar o limite do plano (`maxModelos`). Escopado por workspace_id, igual
 * ao `contarUsuariosEquipe`. Só conta `tipo = editavel` (o PDF é um sub-passo
 * futuro e não aparece na tela de modelos).
 */
export async function contarModelosDoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("contrato_modelos")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("tipo", "editavel")
    .is("deletado_em", null);
  if (error) throw error;
  return count ?? 0;
}

export async function buscarModelo(
  supabase: SupabaseClient,
  id: string
): Promise<ContratoModeloRow | null> {
  const { data, error } = await supabase
    .from("contrato_modelos")
    .select(COLS)
    .eq("id", id)
    .is("deletado_em", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContratoModeloRow) ?? null;
}

export async function criarModelo(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: ContratoModeloEscrita
): Promise<ContratoModeloRow> {
  const { data, error } = await supabase
    .from("contrato_modelos")
    .insert({ ...payload, workspace_id: workspaceId })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ContratoModeloRow;
}

export async function atualizarModelo(
  supabase: SupabaseClient,
  id: string,
  payload: ContratoModeloEscrita
): Promise<ContratoModeloRow> {
  const { data, error } = await supabase
    .from("contrato_modelos")
    .update({ ...payload, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ContratoModeloRow;
}

export async function removerModelo(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  // Soft delete — marca deletado_em (mesmo padrão dos orçamentos).
  const { error } = await supabase
    .from("contrato_modelos")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
