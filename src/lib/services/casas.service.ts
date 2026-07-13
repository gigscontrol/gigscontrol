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
import type { SessaoAutenticada } from "@/lib/api/session";
import { casaIdsVisiveis } from "@/lib/services/contatosAcesso";
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

/**
 * Aplica bloquear/desbloquear numa escrita de casa, carimbando quem/quando com
 * o usuário da sessão. Bloquear → grava motivo/por/em. Desbloquear → limpa os
 * 4 campos. Só age se `input.bloqueado` veio no PATCH.
 */
function aplicarBloqueio(
  escrita: CasaEscrita,
  input: CasaUpdateInput,
  bloqueadoPor?: string
): CasaEscrita {
  if (input.bloqueado === undefined) return escrita;
  if (input.bloqueado) {
    return {
      ...escrita,
      bloqueado: true,
      bloqueado_motivo: input.bloqueado_motivo ?? null,
      bloqueado_por: bloqueadoPor ?? null,
      bloqueado_em: new Date().toISOString(),
    };
  }
  return {
    ...escrita,
    bloqueado: false,
    bloqueado_motivo: null,
    bloqueado_por: null,
    bloqueado_em: null,
  };
}

export async function listarCasasDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Casa[]> {
  // Só o ARTISTA é filtrado (por privacidade.contatos). Admin/equipe/legado →
  // "todos" (catálogo do workspace, igual antes). Ver contatosAcesso.ts.
  if (sessao) {
    const visiveis = await casaIdsVisiveis(supabase, sessao);
    if (visiveis !== "todos") {
      if (visiveis.size === 0) return [];
      const ids = Array.from(visiveis);
      const rows = await repoListar(supabase, <Q,>(q: Q) =>
        (q as unknown as { in(c: string, v: string[]): unknown }).in("id", ids) as Q
      );
      return rows.map(rowParaCasa);
    }
  }
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
  input: CasaUpdateInput,
  bloqueadoPor?: string
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

  // Bloquear/desbloquear carimba quem/quando com o usuário da sessão.
  escrita = aplicarBloqueio(escrita, input, bloqueadoPor);

  const row = await repoAtualizar(supabase, id, escrita);
  return rowParaCasa(row);
}

export async function removerCasaPorId(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await repoRemover(supabase, id, deletadoPor);
}
