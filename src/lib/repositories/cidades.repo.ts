import type { SupabaseClient } from "@supabase/supabase-js";
import type { CidadeRow, CidadeEscrita } from "@/lib/mappers/contatos";

const COLS =
  "id, workspace_id, nome, estado, latitude, longitude, ibge_id, pais, geoname_id";

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

/** Busca uma cidade do workspace pelo ID do IBGE (catálogo nacional). */
export async function buscarCidadePorIbge(
  supabase: SupabaseClient,
  workspaceId: string,
  ibgeId: string
): Promise<CidadeRow | null> {
  const { data, error } = await supabase
    .from("cidades")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .eq("ibge_id", ibgeId)
    .is("deletado_em", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CidadeRow) ?? null;
}

/** Busca uma cidade do workspace pelo ID do GeoNames (catálogo mundial). */
export async function buscarCidadePorGeoname(
  supabase: SupabaseClient,
  workspaceId: string,
  geonameId: string
): Promise<CidadeRow | null> {
  const { data, error } = await supabase
    .from("cidades")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .eq("geoname_id", geonameId)
    .is("deletado_em", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CidadeRow) ?? null;
}

/**
 * Busca cidade ativa do workspace por nome+UF (case-insensitive). Usado
 * pra "adotar" uma cidade legada (sem ibge_id) quando o user escolhe
 * uma cidade IBGE com o mesmo nome — evita duplicação.
 */
export async function buscarCidadePorNomeUf(
  supabase: SupabaseClient,
  workspaceId: string,
  nome: string,
  uf: string
): Promise<CidadeRow | null> {
  const { data, error } = await supabase
    .from("cidades")
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .ilike("nome", nome)
    .ilike("estado", uf)
    .is("deletado_em", null)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CidadeRow) ?? null;
}
