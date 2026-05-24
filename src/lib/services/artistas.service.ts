import type { SupabaseClient } from "@supabase/supabase-js";
import type { DJ } from "@/types";
import { rowParaDj, type ArtistaEscrita } from "@/lib/mappers/artista";
import {
  listarArtistas as repoListar,
  buscarArtista as repoBuscar,
  contarArtistas,
  criarArtista as repoCriar,
  atualizarArtista as repoAtualizar,
  moverArtistaParaLixeira,
} from "@/lib/repositories/artistas.repo";
import type {
  ArtistaCreateInput,
  ArtistaUpdateInput,
} from "@/lib/validators/artistas.schema";
import { getPlano, type PlanoId } from "@/lib/planos";

/** Erro lançado quando o workspace atinge o limite do plano. */
export class LimitePlanoAtingidoError extends Error {
  status = 409;
  constructor(public limite: number, public plano: string) {
    super(
      `Limite de ${limite} artistas atingido no plano ${plano}. Faça upgrade ou remova um artista.`
    );
    this.name = "LimitePlanoAtingidoError";
  }
}

function entradaParaEscrita(
  input: ArtistaCreateInput | ArtistaUpdateInput
): ArtistaEscrita {
  const out: ArtistaEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.cor !== undefined) out.cor = input.cor;
  if (input.acesso_suspenso !== undefined)
    out.acesso_suspenso = input.acesso_suspenso;
  return out;
}

export async function listarArtistasDoWorkspace(
  supabase: SupabaseClient
): Promise<DJ[]> {
  const rows = await repoListar(supabase);
  return rows.map(rowParaDj);
}

export async function buscarArtistaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<DJ | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaDj(row) : null;
}

/**
 * Cria um artista, validando o limite do plano antes.
 *
 * @param planoId id do plano do workspace (vem de workspaces.plano)
 */
export async function criarArtistaNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  planoId: PlanoId,
  input: ArtistaCreateInput
): Promise<DJ> {
  const plano = getPlano(planoId);
  const total = await contarArtistas(supabase);
  if (total >= plano.maxArtistas) {
    throw new LimitePlanoAtingidoError(plano.maxArtistas, plano.nome);
  }
  const row = await repoCriar(supabase, workspaceId, entradaParaEscrita(input));
  return rowParaDj(row);
}

export async function atualizarArtistaPorId(
  supabase: SupabaseClient,
  id: string,
  input: ArtistaUpdateInput
): Promise<DJ> {
  const row = await repoAtualizar(supabase, id, entradaParaEscrita(input));
  return rowParaDj(row);
}

/** Inverte o flag `acesso_suspenso`. */
export async function alternarSuspensaoArtista(
  supabase: SupabaseClient,
  id: string
): Promise<DJ> {
  const atual = await repoBuscar(supabase, id);
  if (!atual) throw new Error("Artista não encontrado.");
  const row = await repoAtualizar(supabase, id, {
    acesso_suspenso: !atual.acesso_suspenso,
  });
  return rowParaDj(row);
}

/** Soft delete: move pra lixeira (recuperável por 30 dias). */
export async function removerArtistaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await moverArtistaParaLixeira(supabase, id);
}
