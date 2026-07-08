import type { SupabaseClient } from "@supabase/supabase-js";
import { softDelete } from "./_softDelete";
import type { PastaRow, NotaRow, PastaEscrita, NotaEscrita } from "@/lib/mappers/anotacoes";

const COLS_PASTA =
  "id, workspace_id, nome, cor, icone, visibilidade, criado_por, criado_em, atualizado_em";
const COLS_NOTA =
  "id, workspace_id, pasta_id, titulo, conteudo, cor, fixada, criado_por, criado_em, atualizado_em, atualizado_por";

// ============================================================
// Pastas
// ============================================================

export async function listarPastas(supabase: SupabaseClient): Promise<PastaRow[]> {
  const { data, error } = await supabase
    .from("anotacao_pastas")
    .select(COLS_PASTA)
    .is("deletado_em", null)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PastaRow[];
}

export async function buscarPasta(
  supabase: SupabaseClient,
  id: string
): Promise<PastaRow | null> {
  const { data, error } = await supabase
    .from("anotacao_pastas")
    .select(COLS_PASTA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PastaRow) ?? null;
}

export async function criarPasta(
  supabase: SupabaseClient,
  workspaceId: string,
  escrita: PastaEscrita
): Promise<PastaRow> {
  const { data, error } = await supabase
    .from("anotacao_pastas")
    .insert({ ...escrita, workspace_id: workspaceId })
    .select(COLS_PASTA)
    .single();
  if (error) throw error;
  return data as unknown as PastaRow;
}

export async function atualizarPasta(
  supabase: SupabaseClient,
  id: string,
  escrita: PastaEscrita
): Promise<PastaRow> {
  const { data, error } = await supabase
    .from("anotacao_pastas")
    .update(escrita)
    .eq("id", id)
    .select(COLS_PASTA)
    .single();
  if (error) throw error;
  return data as unknown as PastaRow;
}

export async function removerPasta(supabase: SupabaseClient, id: string): Promise<void> {
  await softDelete(supabase, "anotacao_pastas", id);
}

// ============================================================
// Membros (visibilidade "selecionados")
// ============================================================

export async function listarMembros(
  supabase: SupabaseClient
): Promise<{ pasta_id: string; usuario_id: string }[]> {
  const { data, error } = await supabase
    .from("anotacao_pasta_membros")
    .select("pasta_id, usuario_id");
  if (error) throw error;
  return (data ?? []) as { pasta_id: string; usuario_id: string }[];
}

/** Substitui a lista de membros de uma pasta (delete-all + insert). */
export async function setMembros(
  supabase: SupabaseClient,
  pastaId: string,
  usuarioIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("anotacao_pasta_membros")
    .delete()
    .eq("pasta_id", pastaId);
  if (delErr) throw delErr;
  if (usuarioIds.length > 0) {
    const rows = usuarioIds.map((u) => ({ pasta_id: pastaId, usuario_id: u }));
    const { error: insErr } = await supabase.from("anotacao_pasta_membros").insert(rows);
    if (insErr) throw insErr;
  }
}

// ============================================================
// Notas
// ============================================================

export async function listarNotas(supabase: SupabaseClient): Promise<NotaRow[]> {
  const { data, error } = await supabase
    .from("anotacoes")
    .select(COLS_NOTA)
    .is("deletado_em", null)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as NotaRow[];
}

export async function buscarNota(
  supabase: SupabaseClient,
  id: string
): Promise<NotaRow | null> {
  const { data, error } = await supabase
    .from("anotacoes")
    .select(COLS_NOTA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as NotaRow) ?? null;
}

export async function criarNota(
  supabase: SupabaseClient,
  workspaceId: string,
  escrita: NotaEscrita
): Promise<NotaRow> {
  const { data, error } = await supabase
    .from("anotacoes")
    .insert({ ...escrita, workspace_id: workspaceId })
    .select(COLS_NOTA)
    .single();
  if (error) throw error;
  return data as unknown as NotaRow;
}

export async function atualizarNota(
  supabase: SupabaseClient,
  id: string,
  escrita: NotaEscrita
): Promise<NotaRow> {
  const { data, error } = await supabase
    .from("anotacoes")
    .update(escrita)
    .eq("id", id)
    .select(COLS_NOTA)
    .single();
  if (error) throw error;
  return data as unknown as NotaRow;
}

export async function removerNota(supabase: SupabaseClient, id: string): Promise<void> {
  await softDelete(supabase, "anotacoes", id);
}
