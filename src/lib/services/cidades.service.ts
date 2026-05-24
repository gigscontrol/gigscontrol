import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cidade } from "@/types";
import { rowParaCidade, type CidadeEscrita } from "@/lib/mappers/contatos";
import {
  listarCidades as repoListar,
  buscarCidade as repoBuscar,
  criarCidade as repoCriar,
  atualizarCidade as repoAtualizar,
  removerCidade as repoRemover,
} from "@/lib/repositories/cidades.repo";
import type {
  CidadeCreateInput,
  CidadeUpdateInput,
} from "@/lib/validators/contatos.schema";

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
