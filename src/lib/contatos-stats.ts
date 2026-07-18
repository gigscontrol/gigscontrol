import type { Show, Contratante, Casa, Cidade, Orcamento, Venda, Moeda } from "@/types";
import { formatarMoeda, totaisPorMoeda } from "./formatters";

// ---------- Multi-moeda (regra-mãe: nunca somar moedas diferentes) ----------

/**
 * `venda.id → moeda`. Os Shows não carregam a própria moeda (o tipo Show não
 * tem esse campo); quando o show veio de uma venda (`show.vendaId`) herdamos a
 * moeda dela. Sem venda vinculada assumimos BRL — mantém o caso legado (100%
 * BRL) idêntico ao de hoje.
 */
function mapaMoedaVenda(vendas: Venda[]): Map<string, Moeda> {
  const m = new Map<string, Moeda>();
  for (const v of vendas) m.set(v.id, v.moeda);
  return m;
}

/** Σ do `valor` dos shows AGRUPADO por moeda (via venda vinculada). */
function faturamentoShowsPorMoeda(
  shows: Show[],
  vendaMoeda: Map<string, Moeda>
): Partial<Record<Moeda, number>> {
  const acc: Partial<Record<Moeda, number>> = {};
  for (const s of shows) {
    const val = s.valor ?? 0;
    if (!val) continue;
    const moeda = (s.vendaId && vendaMoeda.get(s.vendaId)) || "BRL";
    acc[moeda] = (acc[moeda] ?? 0) + val;
  }
  return acc;
}

/**
 * Formata um faturamento agrupado por moeda com `totaisPorMoeda`. Com UMA moeda
 * (o normal) devolve só ela ("R$ 45.000"); com várias, "R$ 45.000 + US$ 8.000".
 * `casas = 0` por padrão pra casar com o antigo `formatBRL` (0 casas) dos cards.
 */
export function formatarFaturamento(
  porMoeda: Partial<Record<Moeda, number>>,
  casas = 0
): string {
  const itens = (Object.entries(porMoeda) as [Moeda, number][]).map(
    ([moeda, valor]) => ({ valor, moeda })
  );
  return totaisPorMoeda(itens, casas);
}

// ---------- Contratantes ----------

export type ContratanteStats = {
  totalShows: number;
  totalOrcamentos: number;
  ltv: number; // soma do valor de todos os shows
  ticketMedio: number;
  ultimoShow?: Show;
  /**
   * Faturamento das VENDAS do contratante agrupado por moeda (regra-mãe). Só
   * preenchido quando `vendas` é passado; agência 100% BRL → `{ BRL: x }`.
   */
  faturamentoPorMoeda: Partial<Record<Moeda, number>>;
  /**
   * Moeda única das vendas quando há só uma; `null` quando há 2+ (D-TICKET: o
   * ticket médio não faz sentido misturando moedas → quem exibe mostra "—").
   * Sem vendas cai em "BRL" pra manter o caso legado idêntico.
   */
  moedaUnica: Moeda | null;
};

export function getContratanteStats(
  contratanteId: string,
  shows: Show[],
  orcamentos: Orcamento[] = [],
  vendas: Venda[] = []
): ContratanteStats {
  const meus = shows.filter((s) => s.contratanteId === contratanteId);
  const meusOrcamentos = orcamentos.filter(
    (o) => o.contratanteId === contratanteId
  );
  const minhasVendas = vendas.filter((v) => v.contratanteId === contratanteId);
  const ltv = meus.reduce((acc, s) => acc + (s.valor ?? 0), 0);

  const faturamentoPorMoeda: Partial<Record<Moeda, number>> = {};
  for (const v of minhasVendas) {
    faturamentoPorMoeda[v.moeda] = (faturamentoPorMoeda[v.moeda] ?? 0) + (v.cache || 0);
  }
  const moedasUsadas = Object.keys(faturamentoPorMoeda) as Moeda[];
  const moedaUnica: Moeda | null =
    moedasUsadas.length > 1 ? null : moedasUsadas[0] ?? "BRL";

  return {
    totalShows: meus.length,
    totalOrcamentos: meusOrcamentos.length,
    ltv,
    ticketMedio: meus.length > 0 ? Math.round(ltv / meus.length) : 0,
    ultimoShow: meus[meus.length - 1],
    faturamentoPorMoeda,
    moedaUnica,
  };
}

// ---------- Casas ----------

export type CasaStats = {
  totalShows: number;
  faturamento: number;
  /** Faturamento (Σ valor dos shows) agrupado por moeda. Só-BRL → { BRL: x }. */
  faturamentoPorMoeda: Partial<Record<Moeda, number>>;
  artistasQueTocaram: string[]; // nomes únicos
};

export function getCasaStats(
  casaId: string,
  shows: Show[],
  vendas: Venda[] = []
): CasaStats {
  const aqui = shows.filter((s) => s.casaId === casaId);
  const artistasUnicos = Array.from(new Set(aqui.map((s) => s.artistaNome)));
  const vendaMoeda = mapaMoedaVenda(vendas);
  return {
    totalShows: aqui.length,
    faturamento: aqui.reduce((acc, s) => acc + (s.valor ?? 0), 0),
    faturamentoPorMoeda: faturamentoShowsPorMoeda(aqui, vendaMoeda),
    artistasQueTocaram: artistasUnicos,
  };
}

// ---------- Cidades ----------

export type CidadeStats = {
  totalShows: number;
  faturamento: number;
  /** Faturamento (Σ valor dos shows) agrupado por moeda. Só-BRL → { BRL: x }. */
  faturamentoPorMoeda: Partial<Record<Moeda, number>>;
  totalCasas: number;
  topArtista?: { nome: string; shows: number };
};

export function getCidadeStats(
  cidadeId: string,
  shows: Show[],
  casas: Casa[],
  vendas: Venda[] = []
): CidadeStats {
  const aqui = shows.filter((s) => s.cidadeId === cidadeId);
  const totalCasas = casas.filter((c) => c.cidadeId === cidadeId).length;
  const vendaMoeda = mapaMoedaVenda(vendas);

  // Conta shows por artista
  const porArtista = new Map<string, number>();
  aqui.forEach((s) => {
    porArtista.set(s.artistaNome, (porArtista.get(s.artistaNome) ?? 0) + 1);
  });
  let topArtista: { nome: string; shows: number } | undefined;
  porArtista.forEach((qtd, nome) => {
    if (!topArtista || qtd > topArtista.shows) topArtista = { nome, shows: qtd };
  });

  return {
    totalShows: aqui.length,
    faturamento: aqui.reduce((acc, s) => acc + (s.valor ?? 0), 0),
    faturamentoPorMoeda: faturamentoShowsPorMoeda(aqui, vendaMoeda),
    totalCasas,
    topArtista,
  };
}

/** D6 — cidade "principal" exibida do contratante = cidade do ÚLTIMO SHOW
 *  REALIZADO (data <= hoje, não cancelado), não o show de data mais futura
 *  (isso é `stats.ultimoShow`, de getContratanteStats — não reusar aqui).
 *  Retorna undefined quando não há show usável; quem chama faz o fallback
 *  pro `cidade_id` gravado no cadastro. Só exibição — não persiste nada. */
export function getCidadePrincipalContratante(
  contratanteId: string,
  shows: Show[]
): string | undefined {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const realizados = shows.filter(
    (s) =>
      s.contratanteId === contratanteId &&
      !!s.data &&
      s.data <= hojeISO &&
      s.status !== "cancelado"
  );
  realizados.sort((a, b) => (b.data as string).localeCompare(a.data as string));
  return realizados[0]?.cidadeId;
}

// ---------- Helpers gerais ----------

export function getCidadeNome(cidadeId: string, cidades: Cidade[]) {
  const c = cidades.find((x) => x.id === cidadeId);
  return c ? `${c.nome}, ${c.estado}` : "—";
}

/** Moeda resumida (0 casas). Delega no formatador único. */
export const formatBRL = (v: number) => formatarMoeda(v, "BRL", 0);
