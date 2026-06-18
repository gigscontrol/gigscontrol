/**
 * Mapper de "modelos de contrato" (contrato_modelos).
 *
 * Tabela criada na migration 32 (+ coluna `secoes` na migration 36). O modelo
 * editável é montado por SEÇÕES TIPADAS, na ordem que o usuário quiser:
 *   - titulo:      título + subtítulo do contrato
 *   - partes:      contratante + contratado + 1 parágrafo
 *   - clausula:    título + itens (sub-cláusulas numeradas N.M ou parágrafos)
 *   - assinaturas: contratante + contratado + 0/1/2 testemunhas
 *   - anexo:       título + conteúdo digitado (ex: rider como anexo)
 *
 * Cláusulas (1, 2, 3…) e sub-cláusulas (N.1, N.2…) são numeradas AUTOMÁTICAMENTE
 * na renderização (ver src/lib/contratos/numeracao.ts) — o usuário nunca digita
 * número. O `tipo` do modelo define se é editável (seções) ou PDF anexado.
 */

/** Tipo do modelo: editável (seções) ou PDF anexado. */
export type ContratoModeloTipo = "editavel" | "pdf";

// ---------------- Seções tipadas ----------------

export type SecaoTitulo = {
  id: string;
  tipo: "titulo";
  titulo: string;
  subtitulo: string;
};

export type SecaoPartes = {
  id: string;
  tipo: "partes";
  contratante: string;
  contratado: string;
  paragrafo: string;
};

/** Item de uma cláusula: sub-cláusula (numerada N.M) ou parágrafo (sem número). */
export type ItemClausula = {
  id: string;
  tipo: "subclausula" | "paragrafo";
  texto: string;
};

export type SecaoClausula = {
  id: string;
  tipo: "clausula";
  titulo: string;
  itens: ItemClausula[];
};

/**
 * Testemunha — preenchida MANUALMENTE (não temos os dados dela no sistema,
 * já que não é contratante nem contratado).
 */
export type Testemunha = {
  id: string;
  nome: string;
  documento: string;
};

export type SecaoAssinaturas = {
  id: string;
  tipo: "assinaturas";
  /**
   * Testemunhas (0 a 2), cada uma preenchida manualmente. Contratante e
   * contratado vêm automáticos dos dados do contrato.
   */
  testemunhas: Testemunha[];
};

export type SecaoAnexo = {
  id: string;
  tipo: "anexo";
  titulo: string;
  conteudo: string;
};

export type SecaoModelo =
  | SecaoTitulo
  | SecaoPartes
  | SecaoClausula
  | SecaoAssinaturas
  | SecaoAnexo;

// ---------------- Estilo (cores do modelo) ----------------

/** Cores do modelo aplicadas no preview e no PDF (folha A4). */
export type EstiloModelo = {
  corFundo: string;
  corTexto: string;
  corTitulo: string;
};

export const ESTILO_PADRAO: EstiloModelo = {
  corFundo: "#ffffff",
  corTexto: "#111111",
  corTitulo: "#111111",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Estilo guardado SEM migration: serializado como JSON na coluna `corpo`
 * (legado — modelos editáveis não usam essa coluna). Lê com fallback seguro
 * pro padrão, inclusive se `corpo` tiver texto antigo (não-JSON).
 */
export function estiloValido(corpo: unknown): EstiloModelo {
  if (typeof corpo !== "string" || !corpo.trim()) return { ...ESTILO_PADRAO };
  try {
    const o = JSON.parse(corpo) as Record<string, unknown>;
    const cor = (k: keyof EstiloModelo): string =>
      typeof o[k] === "string" && HEX.test(o[k] as string)
        ? (o[k] as string)
        : ESTILO_PADRAO[k];
    return {
      corFundo: cor("corFundo"),
      corTexto: cor("corTexto"),
      corTitulo: cor("corTitulo"),
    };
  } catch {
    return { ...ESTILO_PADRAO };
  }
}

/** Serializa o estilo pra guardar na coluna `corpo`. */
export function estiloParaCorpo(estilo: EstiloModelo): string {
  return JSON.stringify(estilo);
}

// ---------------- Linha / modelo ----------------

export type ContratoModeloRow = {
  id: string;
  workspace_id: string;
  nome: string;
  tipo: string;
  /** Legado (texto único). Editáveis usam `secoes`. */
  corpo: string | null;
  /** jsonb — SecaoModelo[]. */
  secoes: unknown;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

export type ContratoModelo = {
  id: string;
  nome: string;
  tipo: ContratoModeloTipo;
  corpo: string | null;
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export function tipoValido(s: string | null | undefined): ContratoModeloTipo {
  if (s === "editavel" || s === "pdf") return s;
  return "editavel";
}

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Normaliza o jsonb `secoes` num SecaoModelo[] seguro (com compat do formato antigo). */
export function secoesValidas(raw: unknown): SecaoModelo[] {
  if (!Array.isArray(raw)) return [];
  const out: SecaoModelo[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const id = texto(o.id);
    switch (o.tipo) {
      case "titulo":
        out.push({ id, tipo: "titulo", titulo: texto(o.titulo), subtitulo: texto(o.subtitulo) });
        break;
      case "partes":
        out.push({
          id,
          tipo: "partes",
          contratante: texto(o.contratante),
          contratado: texto(o.contratado),
          paragrafo: texto(o.paragrafo),
        });
        break;
      case "clausula": {
        const itens: ItemClausula[] = Array.isArray(o.itens)
          ? o.itens
              .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
              .map((i) => ({
                id: texto(i.id),
                tipo: i.tipo === "paragrafo" ? "paragrafo" : "subclausula",
                texto: texto(i.texto),
              }))
          : [];
        out.push({ id, tipo: "clausula", titulo: texto(o.titulo), itens });
        break;
      }
      case "assinaturas": {
        const testemunhas: Testemunha[] = Array.isArray(o.testemunhas)
          ? o.testemunhas
              .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
              .slice(0, 2)
              .map((t) => ({
                id: texto(t.id),
                nome: texto(t.nome),
                documento: texto(t.documento),
              }))
          : [];
        out.push({ id, tipo: "assinaturas", testemunhas });
        break;
      }
      case "anexo":
        out.push({ id, tipo: "anexo", titulo: texto(o.titulo), conteudo: texto(o.conteudo) });
        break;
      default: {
        // Compat com formatos antigos ({titulo, paragrafos[]} ou {titulo, corpo}) → cláusula.
        const fonte = Array.isArray(o.paragrafos)
          ? o.paragrafos
          : typeof o.corpo === "string"
          ? [o.corpo]
          : null;
        if (fonte) {
          const itens: ItemClausula[] = fonte
            .filter((p): p is string => typeof p === "string")
            .map((p) => ({ id: "", tipo: "paragrafo" as const, texto: p }));
          out.push({ id, tipo: "clausula", titulo: texto(o.titulo), itens });
        }
        break;
      }
    }
  }
  return out;
}

export function rowParaModelo(row: ContratoModeloRow): ContratoModelo {
  return {
    id: row.id,
    nome: row.nome,
    tipo: tipoValido(row.tipo),
    corpo: row.corpo ?? null,
    secoes: secoesValidas(row.secoes),
    estilo: estiloValido(row.corpo),
    arquivoUrl: row.arquivo_url ?? null,
    arquivoNome: row.arquivo_nome ?? null,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
}

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
