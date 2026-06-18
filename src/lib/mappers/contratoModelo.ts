/**
 * Mapper de "modelos de contrato" (contrato_modelos).
 *
 * Tabela criada na migration 32 (+ coluna `secoes` na migration 36). CRUD
 * simples por workspace — sem número, sub-entidades ou vínculos com
 * show/venda. O `tipo` define se o modelo é um texto editável (montado por
 * SEÇÕES com variáveis) ou um PDF anexado no Storage.
 */

/** Tipo do modelo: editável (seções com variáveis) ou PDF anexado. */
export type ContratoModeloTipo = "editavel" | "pdf";

/**
 * Seção de um modelo editável. O contrato é montado como uma lista ORDENADA
 * de seções (título + corpo). O `corpo` é texto com variáveis `{{...}}` que
 * são preenchidas com os dados do show ao gerar o contrato. Seções
 * "automáticas" já vêm com as variáveis; seções manuais (cláusulas, foro,
 * PIX) o usuário escreve livremente.
 */
export type SecaoModelo = {
  id: string;
  titulo: string;
  /** Cláusulas/parágrafos da seção. 1 = parágrafo único; vários = N cláusulas. */
  paragrafos: string[];
};

/** Linha bruta da tabela `contrato_modelos` no Supabase. */
export type ContratoModeloRow = {
  id: string;
  workspace_id: string;
  nome: string;
  tipo: string;
  /** Legado (texto único). Editáveis novos usam `secoes`. */
  corpo: string | null;
  /** jsonb — SecaoModelo[]. */
  secoes: unknown;
  /** URL no Storage (para tipo "pdf"); null quando é editável. */
  arquivo_url: string | null;
  arquivo_nome: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

/** Modelo de contrato no formato do app (camelCase). */
export type ContratoModelo = {
  id: string;
  nome: string;
  tipo: ContratoModeloTipo;
  corpo: string | null;
  secoes: SecaoModelo[];
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

/** Normaliza o jsonb `secoes` num SecaoModelo[] seguro. */
export function secoesValidas(raw: unknown): SecaoModelo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : "",
      titulo: typeof s.titulo === "string" ? s.titulo : "",
      paragrafos: Array.isArray(s.paragrafos)
        ? s.paragrafos.filter((p): p is string => typeof p === "string")
        : typeof s.corpo === "string"
        ? [s.corpo] // compat com o formato antigo (corpo único)
        : [],
    }));
}

export function rowParaModelo(row: ContratoModeloRow): ContratoModelo {
  return {
    id: row.id,
    nome: row.nome,
    tipo: tipoValido(row.tipo),
    corpo: row.corpo ?? null,
    secoes: secoesValidas(row.secoes),
    arquivoUrl: row.arquivo_url ?? null,
    arquivoNome: row.arquivo_nome ?? null,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
}

/** Payload aceito no INSERT/UPDATE de contrato_modelos. */
export type ContratoModeloEscrita = {
  workspace_id?: string;
  nome?: string;
  tipo?: ContratoModeloTipo;
  corpo?: string | null;
  secoes?: SecaoModelo[];
  arquivo_url?: string | null;
  arquivo_nome?: string | null;
  atualizado_em?: string;
};
