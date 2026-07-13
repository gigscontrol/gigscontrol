import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contratante } from "@/types";
import {
  rowParaContratante,
  type ContratanteEscrita,
} from "@/lib/mappers/contatos";
import {
  listarContratantes as repoListar,
  buscarContratante as repoBuscar,
  criarContratante as repoCriar,
  atualizarContratante as repoAtualizar,
  removerContratante as repoRemover,
} from "@/lib/repositories/contratantes.repo";
import type {
  ContratanteCreateInput,
  ContratanteUpdateInput,
} from "@/lib/validators/contatos.schema";
import type { SessaoAutenticada } from "@/lib/api/session";
import { contratanteIdsVisiveis } from "@/lib/services/contatosAcesso";
import { resolverGeoDoContato } from "@/lib/services/geoContato";

function entradaParaEscrita(
  input: ContratanteCreateInput | ContratanteUpdateInput
): ContratanteEscrita {
  const out: ContratanteEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.documento !== undefined) out.documento = input.documento;
  if (input.pais !== undefined) out.pais = input.pais;
  // Zod normaliza string vazia em e-mail como ""; tratamos como null no banco
  if (input.email !== undefined) out.email = input.email === "" ? null : input.email;
  if (input.telefone !== undefined) out.telefone = input.telefone;
  if (input.endereco !== undefined) out.endereco = input.endereco;
  if (input.cidade_id !== undefined) out.cidade_id = input.cidade_id;
  if (input.observacoes !== undefined) out.observacoes = input.observacoes;
  return out;
}

/**
 * Aplica bloquear/desbloquear numa escrita de contratante, carimbando
 * quem/quando com o usuário da sessão. Bloquear → grava motivo/por/em.
 * Desbloquear → limpa os 4 campos. Só age se `input.bloqueado` veio no PATCH.
 */
function aplicarBloqueio(
  escrita: ContratanteEscrita,
  input: ContratanteUpdateInput,
  bloqueadoPor?: string
): ContratanteEscrita {
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

export async function listarContratantesDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Contratante[]> {
  // Visibilidade DERIVADA (modelo novo): só os contratantes que o usuário
  // alcança (criou, fez orçamento/venda, ou é de um artista que ele atende).
  // Admin/legado → "todos". Ver contatosAcesso.ts.
  if (sessao) {
    const visiveis = await contratanteIdsVisiveis(supabase, sessao);
    if (visiveis !== "todos") {
      if (visiveis.size === 0) return [];
      const ids = Array.from(visiveis);
      const rows = await repoListar(supabase, <Q,>(q: Q) =>
        (q as unknown as { in(c: string, v: string[]): unknown }).in("id", ids) as Q
      );
      return rows.map(rowParaContratante);
    }
  }
  const rows = await repoListar(supabase);
  return rows.map(rowParaContratante);
}

export async function buscarContratantePorId(
  supabase: SupabaseClient,
  id: string
): Promise<Contratante | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaContratante(row) : null;
}

export async function criarContratanteNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  input: ContratanteCreateInput
): Promise<Contratante> {
  const escrita = entradaParaEscrita(input);
  // Geocodifica NO CADASTRO (tokens.md §7): endereço → ponto exato;
  // senão centroide da cidade. Falha nunca bloqueia o save.
  const geo = await resolverGeoDoContato(supabase, {
    endereco: escrita.endereco,
    cidadeId: escrita.cidade_id,
    paisIso2: escrita.pais,
  });
  const row = await repoCriar(supabase, workspaceId, criadoPor, { ...escrita, ...geo });
  return rowParaContratante(row);
}

export async function atualizarContratantePorId(
  supabase: SupabaseClient,
  id: string,
  input: ContratanteUpdateInput,
  bloqueadoPor?: string
): Promise<Contratante> {
  let escrita = entradaParaEscrita(input);

  // Re-geocodifica SÓ se endereço/cidade mudaram (cache via geocoded_at).
  if (input.endereco !== undefined || input.cidade_id !== undefined) {
    const atual = await repoBuscar(supabase, id);
    const enderecoNovo = input.endereco !== undefined ? (input.endereco ?? null) : (atual?.endereco ?? null);
    const cidadeNova = input.cidade_id !== undefined ? (input.cidade_id ?? null) : (atual?.cidade_id ?? null);
    const mudou =
      (atual?.endereco ?? null) !== enderecoNovo ||
      (atual?.cidade_id ?? null) !== cidadeNova ||
      atual?.lat == null; // nunca geocodificado → aproveita o save
    if (mudou) {
      const geo = await resolverGeoDoContato(supabase, {
        endereco: enderecoNovo,
        cidadeId: cidadeNova,
        paisIso2: input.pais ?? atual?.pais ?? null,
      });
      escrita = { ...escrita, ...geo };
    }
  }

  // Bloquear/desbloquear carimba quem/quando com o usuário da sessão.
  escrita = aplicarBloqueio(escrita, input, bloqueadoPor);

  const row = await repoAtualizar(supabase, id, escrita);
  return rowParaContratante(row);
}

export async function removerContratantePorId(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await repoRemover(supabase, id, deletadoPor);
}
