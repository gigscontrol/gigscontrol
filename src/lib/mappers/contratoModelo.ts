/**
 * Mapper de "modelos de contrato" (contrato_modelos).
 *
 * Tabela criada na migration 32. CRUD simples por workspace — sem número,
 * sub-entidades ou vínculos com show/venda. O `tipo` define se o modelo é
 * um texto editável (com variáveis) ou um PDF anexado no Storage.
 */

/** Tipo do modelo: texto editável (com variáveis) ou PDF anexado. */
export type ContratoModeloTipo = "editavel" | "pdf";

/**
 * Linha bruta da tabela `contrato_modelos` no Supabase.
 */
export type ContratoModeloRow = {
  id: string;
  workspace_id: string;
  nome: string;
  tipo: string;
  /** Texto-modelo (para tipo "editavel"); null quando é PDF. */
  corpo: string | null;
  /** URL no Storage (para tipo "pdf"); null quando é editável. */
  arquivo_url: string | null;
  arquivo_nome: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

/**
 * Modelo de contrato no formato do app (camelCase).
 */
export type ContratoModelo = {
  id: string;
  nome: string;
  tipo: ContratoModeloTipo;
  corpo: string | null;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

/** Normaliza o `tipo` vindo do banco; default "editavel". */
export function tipoValido(s: string | null | undefined): ContratoModeloTipo {
  if (s === "editavel" || s === "pdf") return s;
  return "editavel";
}

export function rowParaModelo(row: ContratoModeloRow): ContratoModelo {
  return {
    id: row.id,
    nome: row.nome,
    tipo: tipoValido(row.tipo),
    corpo: row.corpo ?? null,
    arquivoUrl: row.arquivo_url ?? null,
    arquivoNome: row.arquivo_nome ?? null,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
}

/**
 * Payload aceito no INSERT/UPDATE de contrato_modelos.
 */
export type ContratoModeloEscrita = {
  workspace_id?: string;
  nome?: string;
  tipo?: ContratoModeloTipo;
  corpo?: string | null;
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  atualizado_em?: string;
};
