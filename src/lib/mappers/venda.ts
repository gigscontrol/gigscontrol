import type {
  Venda,
  Parcela,
  ParcelaMeta,
  ItemQuantidade,
  LogisticaSelecao,
  TaxaAgenciaModo,
} from "@/types";
import { LOGISTICA_VAZIA } from "@/types";

// ============================================================
// Venda
// ============================================================

export type VendaRow = {
  id: string;
  workspace_id: string;
  numero: string;
  orcamento_id: string | null;
  show_id: string | null;
  contratante_id: string | null;
  contratante_nome: string | null;
  contratante_email: string | null;
  contratante_telefone: string | null;
  contratante_documento: string | null;
  contratante_endereco: string | null;
  nome_evento: string | null;
  evento_instagram: string | null;
  nome_local: string | null;
  capacidade_publico: number | null;
  endereco_local: string | null;
  data_show: string | null;
  horario: string | null;
  horario_fim: string | null;
  cidade_id: string | null;
  casa_id: string | null;
  artist_id: string | null;
  line_up: string[] | null;
  cache: number | string | null;
  duracao_horas: number | null;
  duracao_minutos: number | null;
  camarim: ItemQuantidade[] | null;
  efeitos: ItemQuantidade[] | null;
  hotel: ItemQuantidade[] | null;
  logistica: LogisticaSelecao | Record<string, never> | null;
  observacoes: string | null;
  info_extra: string | null;
  criado_por: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  taxa_agencia_valor: number | string | null;
  taxa_modo_aplicado: TaxaAgenciaModo | null;
};

function paraNumero(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function logisticaValida(l: VendaRow["logistica"]): LogisticaSelecao {
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

export function rowParaVenda(row: VendaRow, parcelas: Parcela[]): Venda {
  return {
    id: row.id,
    numero: row.numero,
    orcamentoId: row.orcamento_id ?? undefined,
    showId: row.show_id ?? undefined,

    contratanteId: row.contratante_id ?? "",
    contratanteNome: row.contratante_nome ?? "",
    contratanteEmail: row.contratante_email ?? "",
    contratanteTelefone: row.contratante_telefone ?? "",
    contratanteDocumento: row.contratante_documento ?? "",
    contratanteEndereco: row.contratante_endereco ?? "",

    nomeEvento: row.nome_evento ?? "",
    eventoInstagram: row.evento_instagram ?? undefined,
    nomeLocal: row.nome_local ?? "",
    capacidadePublico: row.capacidade_publico ?? undefined,
    enderecoLocal: row.endereco_local ?? "",
    dataShow: row.data_show ?? "",
    horario: row.horario ?? "",
    horarioFim: row.horario_fim ?? undefined,
    cidadeId: row.cidade_id ?? "",
    casaId: row.casa_id ?? undefined,

    djId: row.artist_id ?? "",
    lineUp: Array.isArray(row.line_up) ? row.line_up : undefined,
    cache: paraNumero(row.cache),
    duracaoHoras: row.duracao_horas ?? 0,
    duracaoMinutos: row.duracao_minutos ?? undefined,
    camarim: Array.isArray(row.camarim) ? row.camarim : [],
    efeitos: Array.isArray(row.efeitos) ? row.efeitos : [],
    hotel: Array.isArray(row.hotel) ? row.hotel : [],
    logistica: logisticaValida(row.logistica),

    parcelas,
    taxaAgenciaValor:
      row.taxa_agencia_valor !== null && row.taxa_agencia_valor !== undefined
        ? paraNumero(row.taxa_agencia_valor)
        : undefined,
    taxaModoAplicado: row.taxa_modo_aplicado ?? undefined,
    observacoes: row.observacoes ?? undefined,
    infoExtra: row.info_extra ?? undefined,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
}

/**
 * Redige o RASTREAMENTO FINANCEIRO de uma venda para quem tem `vendas.ver` mas
 * NÃO tem autorização de ver o financeiro (podeVerFinanceiro). Remove o
 * `meta` de cada parcela (comprovante, quem pagou/quando, nota, log de
 * cobranças, motivo de cancelamento) e a taxa da agência. MANTÉM cachê,
 * valores e vencimentos — o vendedor precisa do negócio pra operar; o que fica
 * protegido é o rastro de PAGAMENTO (documento bancário, PII de quem informou).
 */
export function redigirVendaFinanceiro(v: Venda): Venda {
  return {
    ...v,
    taxaAgenciaValor: undefined,
    parcelas: v.parcelas.map((p) => ({ ...p, meta: undefined })),
  };
}

export type VendaEscrita = {
  workspace_id?: string;
  numero?: string;
  orcamento_id?: string | null;
  show_id?: string | null;
  contratante_id?: string | null;
  contratante_nome?: string | null;
  contratante_email?: string | null;
  contratante_telefone?: string | null;
  contratante_documento?: string | null;
  contratante_endereco?: string | null;
  nome_evento?: string | null;
  evento_instagram?: string | null;
  nome_local?: string | null;
  capacidade_publico?: number | null;
  endereco_local?: string | null;
  data_show?: string | null;
  horario?: string | null;
  horario_fim?: string | null;
  cidade_id?: string | null;
  casa_id?: string | null;
  artist_id?: string | null;
  line_up?: string[];
  cache?: number;
  duracao_horas?: number | null;
  duracao_minutos?: number | null;
  camarim?: ItemQuantidade[];
  efeitos?: ItemQuantidade[];
  hotel?: ItemQuantidade[];
  logistica?: LogisticaSelecao;
  observacoes?: string | null;
  info_extra?: string | null;
  criado_por?: string | null;
  atualizado_em?: string;
  taxa_agencia_valor?: number | null;
  taxa_modo_aplicado?: TaxaAgenciaModo | null;
};

// ============================================================
// Parcela
// ============================================================

export type ParcelaRow = {
  id: string;
  workspace_id: string;
  venda_id: string;
  percentual: number | string | null;
  valor: number | string | null;
  data_vencimento: string | null;
  status_base: "pendente" | "pago";
  data_pagamento: string | null;
  observacao: string | null;
  meta: ParcelaMeta | null;
};

export function rowParaParcela(row: ParcelaRow): Parcela {
  return {
    id: row.id,
    percentual: paraNumero(row.percentual),
    valor: paraNumero(row.valor),
    dataVencimento: row.data_vencimento ?? "",
    statusBase: row.status_base ?? "pendente",
    dataPagamento: row.data_pagamento ?? undefined,
    observacao: row.observacao ?? undefined,
    meta: row.meta ?? undefined,
  };
}

export type ParcelaEscrita = {
  workspace_id?: string;
  venda_id?: string;
  percentual?: number;
  valor?: number;
  data_vencimento?: string | null;
  status_base?: "pendente" | "pago";
  data_pagamento?: string | null;
  observacao?: string | null;
  meta?: ParcelaMeta;
};
