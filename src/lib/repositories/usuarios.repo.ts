import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow, UsuarioEscrita } from "@/lib/mappers/usuario";

const COLS =
  "id, workspace_id, nome, email, username, papel, is_super_admin, artista_id, escopo, funcoes, status, deletado_em, senha_padrao, senha_padrao_valor";

/** Lista equipe ativa (papel != admin/artista, deletado_em is null). */
export async function listarUsuariosEquipe(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .is("deletado_em", null)
    .not("papel", "in", "(admin,artista)")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ProfileRow[];
}

/** Lista equipe na lixeira. */
export async function listarUsuariosDeletados(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .not("papel", "in", "(admin,artista)")
    .order("deletado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProfileRow[];
}

export async function contarUsuariosEquipe(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("deletado_em", null)
    .not("papel", "in", "(admin,artista)");
  if (error) throw error;
  return count ?? 0;
}

export async function buscarProfile(
  supabase: SupabaseClient,
  id: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ProfileRow) ?? null;
}

export async function criarProfile(
  supabase: SupabaseClient,
  payload: UsuarioEscrita & { id: string; workspace_id: string }
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      ...payload,
      is_super_admin: false,
      status: payload.status ?? "ativo",
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ProfileRow;
}

export async function atualizarProfile(
  supabase: SupabaseClient,
  id: string,
  payload: UsuarioEscrita
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ProfileRow;
}

/** Soft delete: marca deletado_em = now(). */
export async function moverProfileParaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ deletado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restaurarProfile(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ deletado_em: null })
    .eq("id", id);
  if (error) throw error;
}

/** Apaga definitivamente — irrecuperável. */
export async function removerProfileDefinitivamente(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}
