import type { SupabaseClient } from "@supabase/supabase-js";
import type { CidadeRow, CidadeEscrita } from "@/lib/mappers/contatos";

const COLS = "id, workspace_id, nome, estado, latitude, longitude";

export async function listarCidades(supabase: SupabaseClient): Promise<CidadeRow[]> {
  const { data, error } = await supabase
    .from("cidades")
    .select(COLS)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CidadeRow[];
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
  const { error } = await supabase.from("cidades").delete().eq("id", id);
  if (error) throw error;
}
