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
  contarModelosDoWorkspace,
} from "@/lib/repositories/contratoModelos.repo";
import type {
  ContratoModeloCreateInput,
  ContratoModeloUpdateInput,
} from "@/lib/validators/contratoModelos.schema";
import { getPlano, type PlanoId } from "@/lib/planos";
import { planoEfetivoParaLimites } from "@/lib/services/limites";

/**
 * Limite de modelos do plano atingido (espelha LimitePlanoEquipeError). A rota
 * traduz pra HTTP 409.
 */
export class LimiteModelosError extends Error {
  status = 409;
  constructor(public limite: number, public plano: string) {
    super(
      `Limite de ${limite} modelos atingido no plano ${plano}. Faça upgrade ou exclua um modelo.`
    );
    this.name = "LimiteModelosError";
  }
}

function entradaParaEscrita(
  input: ContratoModeloCreateInput | ContratoModeloUpdateInput
): ContratoModeloEscrita {
  const out: ContratoModeloEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.tipo !== undefined) out.tipo = input.tipo;
  if (input.corpo !== undefined) out.corpo = input.corpo ?? null;
  if (input.secoes !== undefined) out.secoes = input.secoes;
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
  planoId: PlanoId,
  input: ContratoModeloCreateInput
): Promise<ContratoModelo> {
  const plano = getPlano(await planoEfetivoParaLimites(supabase, workspaceId, planoId));
  const total = await contarModelosDoWorkspace(supabase, workspaceId);
  if (total >= plano.maxModelos) {
    throw new LimiteModelosError(plano.maxModelos, plano.nome);
  }

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
