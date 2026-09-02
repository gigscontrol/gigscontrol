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
  /**
   * Título da seção, EDITÁVEL (ex.: "DAS PARTES"). Vazio = sem título no A4.
   * Seções antigas (sem o campo gravado) caem no default "Das partes" — o
   * cabeçalho que o A4 imprimia fixo antes do campo existir.
   */
  titulo: string;
  contratante: string;
  contratado: string;
  paragrafo: string;
};

/**
 * Item de uma seção de cláusulas:
 *  - "clausula":    CAPUT — abre uma cláusula nova; o texto é o corpo
 *                   principal dela, numerado "N." (padrão BR: 3. / 3.1 /
 *                   3.2). N conta globalmente no documento.
 *  - "subclausula": item numerado N.M dentro da cláusula corrente.
 *  - "paragrafo":   texto sem número.
 */
export type ItemClausula = {
  id: string;
  tipo: "clausula" | "subclausula" | "paragrafo";
  texto: string;
};

/**
 * Seção de CLÁUSULAS (container): pode ter várias cláusulas, cada uma com
 * suas sub-cláusulas/parágrafos. `titulo` é o título da SEÇÃO (opcional,
 * centralizado acima) — o título de cada cláusula vive no item "clausula".
 * Seção antiga (1 seção = 1 cláusula) já é válida neste formato: o título
 * fica como título da seção e as subs numeram via cláusula implícita.
 */
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

/**
 * Linha de fechamento "Local, data" (ex.: "São José dos Pinhais, 21/08/2026").
 * `local` é editável (aceita {{variáveis}}); `data` é PREENCHIDA
 * AUTOMATICAMENTE na geração do contrato (preencherSecoes grava a data do dia
 * — congelada no snapshot, como manda a praxe).
 */
export type SecaoLocalData = {
  id: string;
  tipo: "localdata";
  local: string;
  /** Data resolvida na GERAÇÃO (vazia no modelo; o preview usa exemplo). */
  data: string;
};

export type SecaoModelo =
  | SecaoTitulo
  | SecaoPartes
  | SecaoClausula
  | SecaoAssinaturas
  | SecaoAnexo
  | SecaoLocalData;

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

/**
 * Idioma do modelo — dirige, SÓ na geração do contrato, os fallbacks
 * "Não informado"/"Not provided"/…​ e o por-extenso (data + cachê). Vive no
 * MESMO JSON da coluna `corpo` (chave extra `idioma`), sem migration. Modelo
 * antigo sem marca => "pt" (default seguro).
 */
export type IdiomaModelo = "pt" | "en" | "es" | "fr" | "de" | "it";

export const IDIOMAS_MODELO: readonly IdiomaModelo[] = [
  "pt", "en", "es", "fr", "de", "it",
];

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

/**
 * Idioma guardado no MESMO JSON da coluna `corpo` (chave `idioma`). Tolera
 * corpo não-JSON / texto legado exatamente como `estiloValido` → default "pt".
 */
export function idiomaDoCorpo(corpo: unknown): IdiomaModelo {
  if (typeof corpo !== "string" || !corpo.trim()) return "pt";
  try {
    const o = JSON.parse(corpo) as Record<string, unknown>;
    return (IDIOMAS_MODELO as readonly unknown[]).includes(o.idioma)
      ? (o.idioma as IdiomaModelo)
      : "pt";
  } catch {
    return "pt";
  }
}

/**
 * Serializa o estilo pra guardar na coluna `corpo`. `idioma` é opcional pra
 * não quebrar chamadas existentes; quando informado, viaja no mesmo JSON
 * (chave extra que `estiloValido` ignora — zero migration).
 */
export function estiloParaCorpo(estilo: EstiloModelo, idioma?: IdiomaModelo): string {
  return JSON.stringify(idioma ? { ...estilo, idioma } : { ...estilo });
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
  /** Idioma do modelo (derivado do JSON de `corpo`) — dirige os fallbacks/por-extenso na geração. */
  idioma: IdiomaModelo;
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
          // Compat: seção gravada ANTES do campo existir mantém o cabeçalho
          // fixo de antigamente; "" gravado = usuário removeu o título.
          titulo: typeof o.titulo === "string" ? o.titulo : "Das partes",
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
                tipo:
                  i.tipo === "paragrafo"
                    ? "paragrafo"
                    : i.tipo === "clausula"
                      ? "clausula"
                      : "subclausula",
                texto: texto(i.texto),
              }))
          : [];
        // Formato antigo (1 seção = 1 cláusula, título no `titulo`): o título
        // vira o TÍTULO DA SEÇÃO como está — sem inserir item "clausula"
        // (decisão do dono: o título dele já traz a própria numeração, ex.
        // "II DO OBJETO"). As sub-cláusulas seguem numeradas via cláusula
        // implícita (ver numeracao.ts), então o N.M não muda.
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
      case "localdata":
        out.push({ id, tipo: "localdata", local: texto(o.local), data: texto(o.data) });
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
    idioma: idiomaDoCorpo(row.corpo),
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
