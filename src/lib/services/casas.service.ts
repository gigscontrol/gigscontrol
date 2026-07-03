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
import { resolverGeoDoContato } from "@/lib/services/geoContato";

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
  const escrita = entradaParaEscrita(input);
  // Geocodifica NO CADASTRO (tokens.md §7): endereço → ponto exato;
  // senão centroide da cidade. Falha nunca bloqueia o save.
  const geo = await resolverGeoDoContato(supabase, {
    endereco: escrita.endereco,
    cidadeId: escrita.cidade_id,
  });
  const row = await repoCriar(supabase, workspaceId, { ...escrita, ...geo });
  return rowParaCasa(row);
}

export async function atualizarCasaPorId(
  supabase: SupabaseClient,
  id: string,
  input: CasaUpdateInput
): Promise<Casa> {
  let escrita = entradaParaEscrita(input);

  // Re-geocodifica SÓ se endereço/cidade mudaram (cache via geocoded_at).
  if (input.endereco !== undefined || input.cidade_id !== undefined) {
    const atual = await repoBuscar(supabase, id);
    const enderecoNovo = input.endereco !== undefined ? (input.endereco ?? null) : (atual?.endereco ?? null);
    const cidadeNova = input.cidade_id !== undefined ? (input.cidade_id ?? null) : (atual?.cidade_id ?? null);
    const mudou =
      (atual?.endereco ?? null) !== enderecoNovo ||
      (atual?.cidade_id ?? null) !== cidadeNova ||
      atual?.lat == null; // nunca geocodificada → aproveita o save
    if (mudou) {
      const geo = await resolverGeoDoContato(supabase, {
        endereco: enderecoNovo,
        cidadeId: cidadeNova,
      });
      escrita = { ...escrita, ...geo };
    }
  }

  const row = await repoAtualizar(supabase, id, escrita);
  return rowParaCasa(row);
}

export async function removerCasaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}
