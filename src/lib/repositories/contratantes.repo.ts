import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratanteRow, ContratanteEscrita } from "@/lib/mappers/contatos";

const COLS =
  "id, workspace_id, nome, documento, email, telefone, endereco, cidade_id, observacoes, criado_por, criado_em";

export async function listarContratantes(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<ContratanteRow[]> {
  let q = supabase
    .from("contratantes")
    .select(COLS)
    .order("nome", { ascending: true });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ContratanteRow[];
}

export async function buscarContratante(
  supabase: SupabaseClient,
  id: string
): Promise<ContratanteRow | null> {
  const { data, error } = await supabase
    .from("contratantes")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContratanteRow) ?? null;
}

export async function criarContratante(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  payload: ContratanteEscrita
): Promise<ContratanteRow> {
  const { data, error } = await supabase
    .from("contratantes")
    .insert({ ...payload, workspace_id: workspaceId, criado_por: criadoPor })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ContratanteRow;
}

export async function atualizarContratante(
  supabase: SupabaseClient,
  id: string,
  payload: ContratanteEscrita
): Promise<ContratanteRow> {
  const { data, error } = await supabase
    .from("contratantes")
    .update(payload)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ContratanteRow;
}

export async function removerContratante(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("contratantes").delete().eq("id", id);
  if (error) throw error;
}
