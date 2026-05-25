import type { SupabaseClient } from "@supabase/supabase-js";
import type { CidadeRow, CidadeEscrita } from "@/lib/mappers/contatos";

const COLS = "id, workspace_id, nome, estado, latitude, longitude";

export async function listarCidades(supabase: SupabaseClient): Promise<CidadeRow[]> {
  const { data, error } = await supabase
    .from("cidades")
    .select(COLS)
    .is("deletado_em", null)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CidadeRow[];
}

export async function listarCidadesDeletadas(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<(CidadeRow & { deletado_em: string | null })[]> {
  const { data, error } = await supabase
    .from("cidades")
    .select(`${COLS}, deletado_em`)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (CidadeRow & { deletado_em: string | null })[];
}

export async function moverCidadeParaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("cidades")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restaurarCidade(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("cidades")
    .update({ deletado_em: null })
    .eq("id", id);
  if (error) throw error;
}

export async function buscarCidade(
  supabase: SupabaseClient,
  id: string
): Promise<CidadeRow | null> {
  const { data, error } = await supabase
    .from("cidades")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CidadeRow) ?? null;
}

export async function criarCidade(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: CidadeEscrita
): Promise<CidadeRow> {
  const { data, error } = await supabase
    .from("cidades")
    .insert({ ...payload, workspace_id: workspaceId })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as CidadeRow;
}

export async function atualizarCidade(
  supabase: SupabaseClient,
  id: string,
  payload: CidadeEscrita
): Promise<CidadeRow> {
  const { data, error } = await supabase
    .from("cidades")
    .update(payload)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as CidadeRow;
}

export async function removerCidade(supabase: SupabaseClient, id: string): Promise<void> {
  // Soft delete — fica na lixeira por 30 dias.
  await moverCidadeParaLixeira(supabase, id);
}
