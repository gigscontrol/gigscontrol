import type { SupabaseClient } from "@supabase/supabase-js";
import type { CasaRow, CasaEscrita } from "@/lib/mappers/contatos";

const COLS =
  "id, workspace_id, nome, tipo, cidade_id, capacidade, endereco, contato_responsavel, telefone";

export async function listarCasas(supabase: SupabaseClient): Promise<CasaRow[]> {
  const { data, error } = await supabase
    .from("casas")
    .select(COLS)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CasaRow[];
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
  const { error } = await supabase.from("casas").delete().eq("id", id);
  if (error) throw error;
}
