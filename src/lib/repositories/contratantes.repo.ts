import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratanteRow, ContratanteEscrita } from "@/lib/mappers/contatos";
import { softDelete, restaurarSoftDelete } from "./_softDelete";

const COLS =
  "id, workspace_id, nome, documento, documentos, razao_social, pais, email, telefone, endereco, cidade_id, observacoes, criado_por, criado_em, lat, lng, geo_precision, bloqueado, bloqueado_motivo, bloqueado_por, bloqueado_em";

export async function listarContratantes(
  supabase: SupabaseClient,
  aplicarFiltro?: <Q>(q: Q) => Q
): Promise<ContratanteRow[]> {
  let q = supabase
    .from("contratantes")
    .select(COLS)
    .is("deletado_em", null)
    .order("nome", { ascending: true });
  if (aplicarFiltro) q = aplicarFiltro(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ContratanteRow[];
}

export async function listarContratantesDeletados(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<(ContratanteRow & { deletado_em: string | null })[]> {
  const { data, error } = await supabase
    .from("contratantes")
    .select(`${COLS}, deletado_em`)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (ContratanteRow & { deletado_em: string | null })[];
}

export async function moverContratanteParaLixeira(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await softDelete(supabase, "contratantes", id, deletadoPor);
}

export async function restaurarContratante(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await restaurarSoftDelete(supabase, "contratantes", id);
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
  id: string,
  deletadoPor?: string
): Promise<void> {
  // Soft delete — fica na lixeira por 30 dias.
  await moverContratanteParaLixeira(supabase, id, deletadoPor);
}
