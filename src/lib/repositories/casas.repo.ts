import type { SupabaseClient } from "@supabase/supabase-js";
import type { CasaRow, CasaEscrita } from "@/lib/mappers/contatos";
import { softDelete, restaurarSoftDelete } from "./_softDelete";

const COLS =
  "id, workspace_id, nome, tipo, cidade_id, capacidade, endereco, contato_responsavel, telefone, lat, lng, geo_precision, criado_em";

export async function listarCasas(supabase: SupabaseClient): Promise<CasaRow[]> {
  const { data, error } = await supabase
    .from("casas")
    .select(COLS)
    .is("deletado_em", null)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CasaRow[];
}

export async function listarCasasDeletadas(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<(CasaRow & { deletado_em: string | null })[]> {
  const { data, error } = await supabase
    .from("casas")
    .select(`${COLS}, deletado_em`)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (CasaRow & { deletado_em: string | null })[];
}

export async function moverCasaParaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await softDelete(supabase, "casas", id);
}

export async function restaurarCasa(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await restaurarSoftDelete(supabase, "casas", id);
}

export async function buscarCasa(
  supabase: SupabaseClient,
  id: string
): Promise<CasaRow | null> {
  const { data, error } = await supabase
    .from("casas")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CasaRow) ?? null;
}

export async function criarCasa(
  supabase: SupabaseClient,
  workspaceId: string,
  payload: CasaEscrita
): Promise<CasaRow> {
  const { data, error } = await supabase
    .from("casas")
    .insert({ ...payload, workspace_id: workspaceId })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as CasaRow;
}

export async function atualizarCasa(
  supabase: SupabaseClient,
  id: string,
  payload: CasaEscrita
): Promise<CasaRow> {
  const { data, error } = await supabase
    .from("casas")
    .update(payload)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as CasaRow;
}

export async function removerCasa(supabase: SupabaseClient, id: string): Promise<void> {
  // Soft delete — fica na lixeira por 30 dias.
  await moverCasaParaLixeira(supabase, id);
}
