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
