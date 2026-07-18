import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow, UsuarioEscrita } from "@/lib/mappers/usuario";
import { softDelete, restaurarSoftDelete } from "./_softDelete";

const COLS =
  "id, workspace_id, nome, email, username, papel, is_super_admin, artista_id, status, deletado_em, pode_criar_anotacoes, senha_padrao, senha_padrao_valor, cor, pais, nome_legal, documento_tipo, documento, razao_social, endereco, telefone, data_nascimento, cidade_id";

// COLS + a cidade embutida (join em cidades por cidade_id). Usado no roster da
// equipe E nas escritas que devolvem a linha pro cliente, pra o editar já abrir
// com o seletor de cidade pré-preenchido (nome/uf/país). O mapper
// rowParaUsuario lê `cidade` quando presente.
//
// PROVA CONTRA O SCHEMA REAL (regra do COLS): a FK `profiles_cidade_id_fkey`
// (profiles.cidade_id → cidades.id) existe, e todas as 9 colunas do join
// existem em `cidades` — verificado em information_schema no banco real.
const COLS_COM_CIDADE = `${COLS}, cidade:cidades!cidade_id(id, workspace_id, nome, estado, latitude, longitude, ibge_id, pais, geoname_id)`;

/** Lista equipe ativa (papel != admin/artista, deletado_em is null). */
export async function listarUsuariosEquipe(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(COLS_COM_CIDADE)
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
    // COM_CIDADE: a linha volta pro cliente e entra direto na lista da equipe
    // (workspace-context `setEquipe`). Com o COLS puro ela vinha SEM `cidade`,
    // e o membro recém-criado aparecia sem cidade até dar F5.
    .select(COLS_COM_CIDADE)
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
    // COM_CIDADE: esta linha SUBSTITUI o item da lista da equipe no cliente
    // (workspace-context:722 `setEquipe(prev.map(...))`). Com o COLS puro ela
    // voltava com `cidade_id` mas SEM o objeto `cidade`, então a cidade sumia
    // do card e o modal de editar reabria com o campo vazio logo depois de um
    // save bem-sucedido — o "a cidade some da tela" relatado.
    .select(COLS_COM_CIDADE)
    .single();
  if (error) throw error;
  return data as unknown as ProfileRow;
}

/** Soft delete: marca deletado_em = now(). */
export async function moverProfileParaLixeira(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await softDelete(supabase, "profiles", id, deletadoPor);
}

export async function restaurarProfile(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await restaurarSoftDelete(supabase, "profiles", id);
}

