import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContratoModelo } from "@/lib/mappers/contratoModelo";
import {
  rowParaModelo,
  type ContratoModeloEscrita,
} from "@/lib/mappers/contratoModelo";
import {
  listarModelos as repoListar,
  buscarModelo as repoBuscar,
  criarModelo as repoCriar,
  atualizarModelo as repoAtualizar,
  removerModelo as repoRemover,
} from "@/lib/repositories/contratoModelos.repo";
import type {
  ContratoModeloCreateInput,
  ContratoModeloUpdateInput,
} from "@/lib/validators/contratoModelos.schema";

function entradaParaEscrita(
  input: ContratoModeloCreateInput | ContratoModeloUpdateInput
): ContratoModeloEscrita {
  const out: ContratoModeloEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.tipo !== undefined) out.tipo = input.tipo;
  if (input.corpo !== undefined) out.corpo = input.corpo ?? null;
  if (input.arquivo_url !== undefined) out.arquivo_url = input.arquivo_url ?? null;
  if (input.arquivo_nome !== undefined)
    out.arquivo_nome = input.arquivo_nome ?? null;
  return out;
}

export async function listarModelosDoWorkspace(
  supabase: SupabaseClient
): Promise<ContratoModelo[]> {
  const rows = await repoListar(supabase);
  return rows.map(rowParaModelo);
}

export async function buscarModeloPorId(
  supabase: SupabaseClient,
  id: string
): Promise<ContratoModelo | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaModelo(row) : null;
}

export async function criarModeloNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: ContratoModeloCreateInput
): Promise<ContratoModelo> {
  const escrita = entradaParaEscrita(input);
  escrita.tipo = escrita.tipo ?? "editavel";
  const row = await repoCriar(supabase, workspaceId, escrita);
  return rowParaModelo(row);
}

export async function atualizarModeloPorId(
  supabase: SupabaseClient,
  id: string,
  input: ContratoModeloUpdateInput
): Promise<ContratoModelo> {
  const row = await repoAtualizar(supabase, id, entradaParaEscrita(input));
  return rowParaModelo(row);
}

export async function removerModeloPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}
