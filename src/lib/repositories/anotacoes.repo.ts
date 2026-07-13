import type { SupabaseClient } from "@supabase/supabase-js";
import { softDelete } from "./_softDelete";
import type {
  PastaRow,
  NotaRow,
  PastaEscrita,
  NotaEscrita,
  MembroPasta,
} from "@/lib/mappers/anotacoes";

const COLS_PASTA =
  "id, workspace_id, nome, cor, icone, visibilidade, criado_por, criado_em, atualizado_em";
const COLS_NOTA =
  "id, workspace_id, pasta_id, show_id, artist_id, titulo, conteudo, cor, fixada, criado_por, criado_em, atualizado_em, atualizado_por";

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

export async function removerPasta(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await softDelete(supabase, "anotacao_pastas", id, deletadoPor);
}

// ============================================================
// Membros (visibilidade "selecionados")
// ============================================================

type MembroRow = {
  pasta_id: string;
  usuario_id: string | null;
  artista_id: string | null;
};

/** Membros de todas as pastas visíveis, já tipados por {tipo,id}. */
export async function listarMembros(
  supabase: SupabaseClient
): Promise<Array<{ pasta_id: string; membro: MembroPasta }>> {
  const { data, error } = await supabase
    .from("anotacao_pasta_membros")
    .select("pasta_id, usuario_id, artista_id");
  if (error) throw error;
  const rows = (data ?? []) as MembroRow[];
  const out: Array<{ pasta_id: string; membro: MembroPasta }> = [];
  for (const r of rows) {
    if (r.usuario_id) {
      out.push({ pasta_id: r.pasta_id, membro: { tipo: "usuario", id: r.usuario_id } });
    } else if (r.artista_id) {
      out.push({ pasta_id: r.pasta_id, membro: { tipo: "artista", id: r.artista_id } });
    }
  }
  return out;
}

/**
 * Substitui a lista de membros de uma pasta (delete-all + insert). Grava na
 * coluna certa por tipo — usuario_id para "usuario", artista_id para "artista"
 * (o CHECK do banco exige exatamente um preenchido por linha).
 */
export async function setMembros(
  supabase: SupabaseClient,
  pastaId: string,
  membros: MembroPasta[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("anotacao_pasta_membros")
    .delete()
    .eq("pasta_id", pastaId);
  if (delErr) throw delErr;
  if (membros.length > 0) {
    const rows = membros.map((m) => ({
      pasta_id: pastaId,
      usuario_id: m.tipo === "usuario" ? m.id : null,
      artista_id: m.tipo === "artista" ? m.id : null,
    }));
    const { error: insErr } = await supabase.from("anotacao_pasta_membros").insert(rows);
    if (insErr) throw insErr;
  }
}

/**
 * Dentre `ids`, quais artistas VIVOS pertencem ao workspace. Usado para validar
 * membros-artista de pasta e a etiqueta de contexto da nota antes de gravar.
 */
export async function artistasDoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from("artists")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", ids)
    .is("deletado_em", null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { id: string }).id));
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

export async function removerNota(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await softDelete(supabase, "anotacoes", id, deletadoPor);
}

/** Notas vivas de um show (pro limite de 4 por show). */
export async function contarNotasDoShow(
  supabase: SupabaseClient,
  showId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("anotacoes")
    .select("id", { count: "exact", head: true })
    .eq("show_id", showId)
    .is("deletado_em", null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Pastas vivas do WORKSPACE inteiro (pro limite de 8). Usa o cliente ADMIN
 * (service-role) porque a contagem via sessão só veria as pastas visíveis ao
 * usuário — e o teto é global, incluindo pastas privadas de outros.
 */
export async function contarPastasDoWorkspace(
  admin: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { count, error } = await admin
    .from("anotacao_pastas")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("deletado_em", null);
  if (error) throw error;
  return count ?? 0;
}
