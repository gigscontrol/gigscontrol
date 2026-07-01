import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cidade } from "@/types";
import { rowParaCidade, type CidadeEscrita } from "@/lib/mappers/contatos";
import {
  listarCidades as repoListar,
  buscarCidade as repoBuscar,
  criarCidade as repoCriar,
  atualizarCidade as repoAtualizar,
  removerCidade as repoRemover,
  buscarCidadePorIbge,
  buscarCidadePorGeoname,
  buscarCidadePorNomeUf,
} from "@/lib/repositories/cidades.repo";
import type {
  CidadeCreateInput,
  CidadeUpdateInput,
} from "@/lib/validators/contatos.schema";
import { geocodarCidadeBR } from "@/lib/geocode-osm";

function entradaParaEscrita(
  input: CidadeCreateInput | CidadeUpdateInput
): CidadeEscrita {
  const out: CidadeEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.estado !== undefined) out.estado = input.estado;
  if (input.latitude !== undefined) out.latitude = input.latitude;
  if (input.longitude !== undefined) out.longitude = input.longitude;
  return out;
}

export async function listarCidadesDoWorkspace(supabase: SupabaseClient): Promise<Cidade[]> {
  const rows = await repoListar(supabase);
  return rows.map(rowParaCidade);
}

export async function buscarCidadePorId(
  supabase: SupabaseClient,
  id: string
): Promise<Cidade | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaCidade(row) : null;
}

export async function criarCidadeNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: CidadeCreateInput
): Promise<Cidade> {
  const row = await repoCriar(supabase, workspaceId, entradaParaEscrita(input));
  return rowParaCidade(row);
}

export async function atualizarCidadePorId(
  supabase: SupabaseClient,
  id: string,
  input: CidadeUpdateInput
): Promise<Cidade> {
  const row = await repoAtualizar(supabase, id, entradaParaEscrita(input));
  return rowParaCidade(row);
}

export async function removerCidadePorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}

/**
 * Faz lookup-or-create de uma cidade do IBGE no workspace.
 *
 * Fluxo (idempotente):
 *  1. Procura por `ibge_id` no workspace → se acha, retorna.
 *  2. Procura por nome+UF (case-insensitive) — se acha uma cidade
 *     legada (sem ibge_id), adota: atualiza com ibge_id e devolve.
 *  3. Senão, cria nova linha. Geocoda lat/lng via OSM Nominatim
 *     (best-effort; falha não bloqueia a criação).
 *
 * Usado pelos forms de orçamento, venda, casa e contratante quando o
 * usuário escolhe uma cidade no autocomplete IBGE.
 */
export async function lookupOuCriarCidadePorIbge(
  supabase: SupabaseClient,
  workspaceId: string,
  ibge: { ibgeId: string; nome: string; uf: string }
): Promise<Cidade> {
  // 1. Match exato por ibge_id
  const existente = await buscarCidadePorIbge(supabase, workspaceId, ibge.ibgeId);
  if (existente) return rowParaCidade(existente);

  // 2. Match por nome+UF (cidade legada/manual) — adota
  const legacy = await buscarCidadePorNomeUf(
    supabase,
    workspaceId,
    ibge.nome,
    ibge.uf
  );
  if (legacy) {
    const atualizada = await repoAtualizar(supabase, legacy.id, {
      ibge_id: ibge.ibgeId,
    });
    return rowParaCidade(atualizada);
  }

  // 3. Cria nova — geocoda (best-effort)
  const coords = await geocodarCidadeBR(ibge.nome, ibge.uf);
  const escrita: CidadeEscrita = {
    nome: ibge.nome,
    estado: ibge.uf.toUpperCase(),
    ibge_id: ibge.ibgeId,
  };
  if (coords) {
    escrita.latitude = coords.latitude;
    escrita.longitude = coords.longitude;
  }
  const criada = await repoCriar(supabase, workspaceId, escrita);
  return rowParaCidade(criada);
}

/**
 * Lookup-or-create UNIFICADO: Brasil (IBGE, geocode OSM) OU mundo
 * (GeoNames, coords já vêm no payload). Idempotente:
 *  - IBGE → delega pro fluxo existente (`lookupOuCriarCidadePorIbge`).
 *  - GeoNames → match por `geoname_id`; senão adota legada por nome+UF;
 *    senão cria com pais/geoname_id/lat/lng.
 */
export async function lookupOuCriarCidade(
  supabase: SupabaseClient,
  workspaceId: string,
  c: {
    ibgeId?: string;
    geonameId?: string;
    nome: string;
    uf: string;
    pais: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<Cidade> {
  // Brasil via IBGE — mantém o fluxo existente (adota legada + geocode OSM).
  if (c.ibgeId) {
    return lookupOuCriarCidadePorIbge(supabase, workspaceId, {
      ibgeId: c.ibgeId,
      nome: c.nome,
      uf: c.uf,
    });
  }

  // Outros países via GeoNames — coords já vêm no payload.
  if (c.geonameId) {
    const existente = await buscarCidadePorGeoname(supabase, workspaceId, c.geonameId);
    if (existente) return rowParaCidade(existente);
  }

  // Adota cidade legada (mesmo nome+UF) — evita duplicar.
  const legacy = await buscarCidadePorNomeUf(supabase, workspaceId, c.nome, c.uf);
  if (legacy) {
    const patch: CidadeEscrita = { pais: c.pais };
    if (c.geonameId) patch.geoname_id = c.geonameId;
    if (c.latitude !== undefined) patch.latitude = c.latitude;
    if (c.longitude !== undefined) patch.longitude = c.longitude;
    const atualizada = await repoAtualizar(supabase, legacy.id, patch);
    return rowParaCidade(atualizada);
  }

  const escrita: CidadeEscrita = {
    nome: c.nome,
    estado: c.uf,
    pais: c.pais,
  };
  if (c.geonameId) escrita.geoname_id = c.geonameId;
  if (c.latitude !== undefined) escrita.latitude = c.latitude;
  if (c.longitude !== undefined) escrita.longitude = c.longitude;
  const criada = await repoCriar(supabase, workspaceId, escrita);
  return rowParaCidade(criada);
}
