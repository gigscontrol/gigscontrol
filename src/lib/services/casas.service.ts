import type { SupabaseClient } from "@supabase/supabase-js";
import type { Casa } from "@/types";
import { rowParaCasa, type CasaEscrita } from "@/lib/mappers/contatos";
import {
  listarCasas as repoListar,
  buscarCasa as repoBuscar,
  criarCasa as repoCriar,
  atualizarCasa as repoAtualizar,
  removerCasa as repoRemover,
} from "@/lib/repositories/casas.repo";
import type {
  CasaCreateInput,
  CasaUpdateInput,
} from "@/lib/validators/contatos.schema";

function entradaParaEscrita(input: CasaCreateInput | CasaUpdateInput): CasaEscrita {
  const out: CasaEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.tipo !== undefined) out.tipo = input.tipo;
  if (input.cidade_id !== undefined) out.cidade_id = input.cidade_id;
  if (input.capacidade !== undefined) out.capacidade = input.capacidade;
  if (input.endereco !== undefined) out.endereco = input.endereco;
  if (input.contato_responsavel !== undefined)
    out.contato_responsavel = input.contato_responsavel;
  if (input.telefone !== undefined) out.telefone = input.telefone;
  return out;
}

export async function listarCasasDoWorkspace(supabase: SupabaseClient): Promise<Casa[]> {
  const rows = await repoListar(supabase);
  return rows.map(rowParaCasa);
}

export async function buscarCasaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<Casa | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaCasa(row) : null;
}

export async function criarCasaNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: CasaCreateInput
): Promise<Casa> {
  const row = await repoCriar(supabase, workspaceId, entradaParaEscrita(input));
  return rowParaCasa(row);
}

export async function atualizarCasaPorId(
  supabase: SupabaseClient,
  id: string,
  input: CasaUpdateInput
): Promise<Casa> {
  const row = await repoAtualizar(supabase, id, entradaParaEscrita(input));
  return rowParaCasa(row);
}

export async function removerCasaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}
