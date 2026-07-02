import type { AgendaItem, AgendaItemTipo } from "@/types";

/** Linha bruta da tabela `agenda_items` no Supabase. */
export type AgendaItemRow = {
  id: string;
  workspace_id: string;
  artist_id: string | null;
  tipo: string;
  titulo: string | null;
  data: string;
  data_fim: string | null;
  dia_inteiro: boolean | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  dados: Record<string, unknown> | null;
  observacoes: string | null;
  criado_em: string | null;
  criado_por: string | null;
};

function tipoValido(t: string | null): AgendaItemTipo {
  if (t === "evento" || t === "voo" || t === "transporte") return t;
  return "evento";
}

/** Converte uma row do banco no objeto `AgendaItem` que a UI usa. */
export function rowParaAgendaItem(row: AgendaItemRow): AgendaItem {
  return {
    id: row.id,
    tipo: tipoValido(row.tipo),
    titulo: row.titulo ?? "",
    data: row.data,
    dataFim: row.data_fim ?? undefined,
    diaInteiro: !!row.dia_inteiro,
    horaInicio: row.hora_inicio ?? undefined,
    horaFim: row.hora_fim ?? undefined,
    artistIds: Array.isArray(row.dados?.artistIds)
      ? (row.dados.artistIds as string[])
      : row.artist_id
        ? [row.artist_id]
        : [],
    observacoes: row.observacoes ?? undefined,
    dados: row.dados ?? undefined,
  };
}

/** Campos aceitos no INSERT (workspace_id é setado pelo repository). */
export type AgendaItemEscrita = {
  workspace_id?: string;
  artist_id?: string | null;
  tipo?: string;
  titulo?: string | null;
  data?: string;
  data_fim?: string | null;
  dia_inteiro?: boolean;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  dados?: Record<string, unknown>;
  observacoes?: string | null;
  criado_por?: string | null;
};
