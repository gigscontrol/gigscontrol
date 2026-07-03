import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaItem } from "@/types";
import { rowParaAgendaItem, type AgendaItemEscrita } from "@/lib/mappers/agendaItem";
import {
  listarAgendaItems as repoListar,
  criarAgendaItem as repoCriar,
  atualizarAgendaItem as repoAtualizar,
  removerAgendaItem as repoRemover,
} from "@/lib/repositories/agendaItems.repo";
import type { AgendaItemCreateInput } from "@/lib/validators/agendaItems.schema";
import type { SessaoAutenticada } from "@/lib/api/session";
import { aplicarFiltroShows, stripAgendaItemDetalhado } from "@/lib/api/permissoes";

/** Camada de negócio dos itens da agenda. */

function entradaParaEscrita(input: AgendaItemCreateInput): AgendaItemEscrita {
  return {
    tipo: input.tipo,
    titulo: input.titulo ?? null,
    data: input.data,
    data_fim: input.data_fim ?? null,
    dia_inteiro: input.dia_inteiro ?? false,
    hora_inicio: input.hora_inicio ?? null,
    hora_fim: input.hora_fim ?? null,
    artist_id: input.artist_id ?? null,
    observacoes: input.observacoes ?? null,
    dados: input.dados ?? {},
  };
}

export async function listarAgendaItensDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<AgendaItem[]> {
  const filtro = sessao
    ? <Q,>(q: Q) => aplicarFiltroShows(q as never, sessao) as Q
    : undefined;
  const rows = await repoListar(supabase, filtro);
  // Redação por nível: sem agenda.ver_detalhado → zera dados (voo/transporte)
  // e observações, mantendo tipo/título/data/horários.
  return rows.map((row) => {
    const item = rowParaAgendaItem(row);
    return sessao ? stripAgendaItemDetalhado(item, sessao, row.artist_id) : item;
  });
}

export async function criarAgendaItemNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: AgendaItemCreateInput,
  criadoPor?: string
): Promise<AgendaItem> {
  const escrita = entradaParaEscrita(input);
  if (criadoPor) escrita.criado_por = criadoPor;
  const row = await repoCriar(supabase, workspaceId, escrita);
  return rowParaAgendaItem(row);
}

export async function atualizarAgendaItemNoWorkspace(
  supabase: SupabaseClient,
  id: string,
  input: AgendaItemCreateInput
): Promise<AgendaItem> {
  const row = await repoAtualizar(supabase, id, entradaParaEscrita(input));
  return rowParaAgendaItem(row);
}

export async function removerAgendaItemPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}
