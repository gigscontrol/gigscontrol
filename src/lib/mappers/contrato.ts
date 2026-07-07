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

/**
 * Campo de assinatura posicionado num contrato-por-UPLOAD. Coordenadas em
 * FRAÇÃO 0..1 da página (resolução-independente); vínculo com o signatário por
 * ORDEM (0,1,2…) — os ids de contrato_signatarios são recriados a cada save.
 */
export type CampoAssinatura = {
  id: string;
  signatarioOrdem: number;
  /** v1: só "assinatura". (nome/documento/data/rubrica ficam pra depois.) */
  tipo: "assinatura";
  /** Página 0-based. */
  pagina: number;
  xRel: number;
  yRel: number;
  wRel: number;
  hRel: number;
};

/** Layout de um contrato gerado a partir de um PDF ENVIADO (não de modelo). */
export type ContratoPdfLayout = {
  /** Path no bucket privado `assinaturas`. */
  path: string;
  nome: string;
  paginas: number;
  /** Dimensões (pt) de cada página, na ordem. */
  dims: { w: number; h: number }[];
  campos: CampoAssinatura[];
};

/**
 * Conteúdo desserializado do snapshot (`corpo_preenchido`).
 * `pdf` presente = contrato por UPLOAD (posiciona assinaturas sobre um PDF
 * pronto). Ausente = contrato editável de modelo (fluxo de sempre).
 */
export type ContratoConteudo = {
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  pdf?: ContratoPdfLayout;
};

const clamp01 = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

/** Valida/normaliza o layout de PDF vindo do jsonb. undefined se não for válido. */
export function pdfLayoutValido(raw: unknown): ContratoPdfLayout | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.path !== "string" || !o.path) return undefined;
  const paginas =
    typeof o.paginas === "number" && o.paginas > 0 ? Math.floor(o.paginas) : 0;
  const dims = Array.isArray(o.dims)
    ? o.dims.map((d) => {
        const x = (d ?? {}) as Record<string, unknown>;
        return {
          w: typeof x.w === "number" ? x.w : 0,
          h: typeof x.h === "number" ? x.h : 0,
        };
      })
    : [];
  const campos = Array.isArray(o.campos)
    ? o.campos.flatMap((c): CampoAssinatura[] => {
        const x = (c ?? {}) as Record<string, unknown>;
        if (typeof x.pagina !== "number") return [];
        return [
          {
            id: typeof x.id === "string" && x.id ? x.id : `c${Math.floor(clamp01(x.xRel) * 1e6)}`,
            signatarioOrdem:
              typeof x.signatarioOrdem === "number" ? Math.max(0, Math.floor(x.signatarioOrdem)) : 0,
            tipo: "assinatura",
            pagina: Math.max(0, Math.floor(x.pagina)),
            xRel: clamp01(x.xRel),
            yRel: clamp01(x.yRel),
            wRel: clamp01(x.wRel),
            hRel: clamp01(x.hRel),
          },
        ];
      })
    : [];
  return { path: o.path, nome: typeof o.nome === "string" ? o.nome : "documento.pdf", paginas, dims, campos };
}

/** true = contrato por upload de PDF (tem layout posicionado). */
export function temPdfLayout(c: ContratoConteudo): boolean {
  return !!c.pdf && !!c.pdf.path;
}

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
  /** Quem criou o contrato (migration 50). null nas linhas antigas. */
  criado_por: string | null;
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
  /** Quem criou o contrato (usado no escopo "editar só os que ele criou"). */
  criadoPor: string | null;
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
      pdf?: unknown;
    };
    const pdf = pdfLayoutValido(o.pdf);
    return {
      secoes: secoesValidas(o.secoes),
      estilo: estiloValido(JSON.stringify(o.estilo ?? {})),
      ...(pdf ? { pdf } : {}),
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
    criadoPor: row.criado_por ?? null,
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
  criado_por?: string | null;
  atualizado_em?: string;
};
