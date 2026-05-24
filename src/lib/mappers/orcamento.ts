import type {
  Orcamento,
  OrcamentoStatus,
  TipoEvento,
  ItemQuantidade,
  LogisticaSelecao,
} from "@/types";
import { LOGISTICA_VAZIA } from "@/types";

/**
 * Linha bruta da tabela `orcamentos` no Supabase.
 */
export type OrcamentoRow = {
  id: string;
  workspace_id: string;
  numero: string;
  status: string;
  tipo_evento: string | null;
  contratante_id: string | null;
  casa_id: string | null;
  cidade_id: string | null;
  artist_id: string | null;
  valor_cache: number | string | null;
  duracao_horas: number | null;
  duracao_minutos: number | null;
  camarim: ItemQuantidade[] | null;
  efeitos: ItemQuantidade[] | null;
  hotel: ItemQuantidade[] | null;
  logistica: LogisticaSelecao | Record<string, never> | null;
  observacoes: string | null;
  data_show: string | null;
  horario: string | null;
  validade: string | null;
  show_id: string | null;
  criado_por: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

function statusValido(s: string | null | undefined): OrcamentoStatus {
  if (s === "pendente" || s === "negociacao" || s === "aceito" || s === "recusado")
    return s;
  return "pendente";
}

function tipoEventoValido(t: string | null | undefined): TipoEvento {
  if (t === "social" || t === "casa-noturna" || t === "festival") return t;
  return "social";
}

function paraNumero(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function logisticaValida(l: OrcamentoRow["logistica"]): LogisticaSelecao {
  if (
    l &&
    typeof l === "object" &&
    "aereaQtd" in l &&
    "transladoTerrestre" in l
  ) {
    return l as LogisticaSelecao;
  }
  return LOGISTICA_VAZIA;
}

export function rowParaOrcamento(row: OrcamentoRow): Orcamento {
  return {
    id: row.id,
    numero: row.numero,
    status: statusValido(row.status),
    tipoEvento: tipoEventoValido(row.tipo_evento),
    contratanteId: row.contratante_id ?? "",
    cidadeId: row.cidade_id ?? "",
    casaId: row.casa_id ?? undefined,
    djId: row.artist_id ?? "",
    dataShow: row.data_show ?? undefined,
    horario: row.horario ?? undefined,
    duracaoHoras: row.duracao_horas ?? 0,
    duracaoMinutos: row.duracao_minutos ?? undefined,
    valorCache: paraNumero(row.valor_cache),
    camarim: Array.isArray(row.camarim) ? row.camarim : [],
    efeitos: Array.isArray(row.efeitos) ? row.efeitos : [],
    hotel: Array.isArray(row.hotel) ? row.hotel : [],
    logistica: logisticaValida(row.logistica),
    validade: row.validade ?? undefined,
    observacoes: row.observacoes ?? undefined,
    showId: row.show_id ?? undefined,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
}

/**
 * Payload aceito no INSERT/UPDATE. `numero` é gerado pelo service para
 * o caso de criação; pode vir no update se for renumeração.
 */
export type OrcamentoEscrita = {
  workspace_id?: string;
  numero?: string;
  status?: OrcamentoStatus;
  tipo_evento?: TipoEvento | null;
  contratante_id?: string | null;
  casa_id?: string | null;
  cidade_id?: string | null;
  artist_id?: string | null;
  valor_cache?: number | null;
  duracao_horas?: number | null;
  duracao_minutos?: number | null;
  camarim?: ItemQuantidade[];
  efeitos?: ItemQuantidade[];
  hotel?: ItemQuantidade[];
  logistica?: LogisticaSelecao;
  observacoes?: string | null;
  data_show?: string | null;
  horario?: string | null;
  validade?: string | null;
  show_id?: string | null;
  criado_por?: string | null;
  atualizado_em?: string;
};
