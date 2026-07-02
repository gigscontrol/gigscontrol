/**
 * Mapper de "contratos" (contratos) — os contratos GERADOS a partir de uma
 * venda + um modelo (ver migration 32).
 *
 * O corpo preenchido é um SNAPSHOT: guardamos em `corpo_preenchido` o
 * JSON.stringify({ secoes, estilo }) no momento da geração, pra que o contrato
 * não mude se o modelo for editado depois. As seções/estilo reaproveitam os
 * tipos e validadores do mapper de modelos (contratoModelo.ts).
 */
import type { SecaoModelo, EstiloModelo } from "./contratoModelo";
import { secoesValidas, estiloValido, ESTILO_PADRAO } from "./contratoModelo";

/** Status do contrato gerado. */
export type ContratoStatus = "rascunho" | "enviado" | "assinado" | "cancelado";

/** Pasta de organização de contratos (aba "Meus contratos"). Máx. 5/workspace. */
export type ContratoPasta = { id: string; nome: string; ordem: number };

/** Máximo de pastas PERSONALIZADAS (a "Arquivados" é fixa, à parte). */
export const MAX_PASTAS = 4;

/** Valida/normaliza a lista de pastas (do jsonb do banco ou do client). Cap em 5. */
export function pastasValidas(raw: unknown): ContratoPasta[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: ContratoPasta[] = [];
  for (const p of arr) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : null;
    const nome = typeof o.nome === "string" ? o.nome.trim().slice(0, 40) : "";
    if (!id || !nome) continue;
    out.push({ id, nome, ordem: typeof o.ordem === "number" ? o.ordem : out.length });
    if (out.length >= MAX_PASTAS) break;
  }
  return out.sort((a, b) => a.ordem - b.ordem);
}

/** Conteúdo desserializado do snapshot (`corpo_preenchido`). */
export type ContratoConteudo = { secoes: SecaoModelo[]; estilo: EstiloModelo };

export type ContratoRow = {
  id: string;
  workspace_id: string;
  venda_id: string | null;
  modelo_id: string | null;
  numero: string;
  status: string;
  corpo_preenchido: string | null;
  arquivo_url: string | null;
  local_assinatura: string | null;
  data_emissao: string | null;
  data_assinatura: string | null;
  observacoes: string | null;
  /** Pasta (organização em "Meus contratos"). null = sem pasta. */
  pasta_id: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

export type Contrato = {
  id: string;
  numero: string;
  status: ContratoStatus;
  vendaId: string | null;
  modeloId: string | null;
  conteudo: ContratoConteudo;
  arquivoUrl: string | null;
  localAssinatura: string | null;
  dataEmissao: string | null;
  dataAssinatura: string | null;
  observacoes: string | null;
  /** Pasta de organização (null = sem pasta). */
  pastaId: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export function statusValido(s: string | null | undefined): ContratoStatus {
  if (
    s === "rascunho" ||
    s === "enviado" ||
    s === "assinado" ||
    s === "cancelado"
  )
    return s;
  return "rascunho";
}

/**
 * `corpo_preenchido` guarda JSON.stringify({ secoes, estilo }). Parse com
 * fallback seguro (vazio + estilo padrão) se não for JSON válido.
 */
export function conteudoValido(corpoPreenchido: unknown): ContratoConteudo {
  if (typeof corpoPreenchido !== "string" || !corpoPreenchido.trim())
    return { secoes: [], estilo: { ...ESTILO_PADRAO } };
  try {
    const o = JSON.parse(corpoPreenchido) as {
      secoes?: unknown;
      estilo?: unknown;
    };
    return {
      secoes: secoesValidas(o.secoes),
      estilo: estiloValido(JSON.stringify(o.estilo ?? {})),
    };
  } catch {
    return { secoes: [], estilo: { ...ESTILO_PADRAO } };
  }
}

/** Serializa o conteúdo pra guardar na coluna `corpo_preenchido`. */
export function conteudoParaCorpo(c: ContratoConteudo): string {
  return JSON.stringify(c);
}

export function rowParaContrato(row: ContratoRow): Contrato {
  return {
    id: row.id,
    numero: row.numero,
    status: statusValido(row.status),
    vendaId: row.venda_id ?? null,
    modeloId: row.modelo_id ?? null,
    conteudo: conteudoValido(row.corpo_preenchido),
    arquivoUrl: row.arquivo_url ?? null,
    localAssinatura: row.local_assinatura ?? null,
    dataEmissao: row.data_emissao ?? null,
    dataAssinatura: row.data_assinatura ?? null,
    observacoes: row.observacoes ?? null,
    pastaId: row.pasta_id ?? null,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
}

export type ContratoEscrita = {
  workspace_id?: string;
  venda_id?: string | null;
  modelo_id?: string | null;
  numero?: string;
  status?: ContratoStatus;
  corpo_preenchido?: string | null;
  arquivo_url?: string | null;
  local_assinatura?: string | null;
  data_emissao?: string | null;
  data_assinatura?: string | null;
  observacoes?: string | null;
  pasta_id?: string | null;
  atualizado_em?: string;
};
