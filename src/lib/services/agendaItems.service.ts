import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaItem } from "@/types";
import { rowParaAgendaItem, type AgendaItemEscrita } from "@/lib/mappers/agendaItem";
import {
  listarAgendaItems as repoListar,
  criarAgendaItem as repoCriar,
  removerAgendaItem as repoRemover,
} from "@/lib/repositories/agendaItems.repo";
import type { AgendaItemCreateInput } from "@/lib/validators/agendaItems.schema";

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
  supabase: SupabaseClient
): Promise<AgendaItem[]> {
  const rows = await repoListar(supabase);
  return rows.map(rowParaAgendaItem);
}

export async function criarAgendaItemNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: AgendaItemCreateInput
): Promise<AgendaItem> {
  const row = await repoCriar(supabase, workspaceId, entradaParaEscrita(input));
  return rowParaAgendaItem(row);
}

export async function removerAgendaItemPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}
