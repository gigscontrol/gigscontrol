import type { Show, Contratante, Casa, Cidade, Orcamento } from "@/types";
import { formatarMoeda } from "./formatters";

// ---------- Contratantes ----------

export type ContratanteStats = {
  totalShows: number;
  totalOrcamentos: number;
  ltv: number; // soma do valor de todos os shows
  ticketMedio: number;
  ultimoShow?: Show;
};

export function getContratanteStats(
  contratanteId: string,
  shows: Show[],
  orcamentos: Orcamento[] = []
): ContratanteStats {
  const meus = shows.filter((s) => s.contratanteId === contratanteId);
  const meusOrcamentos = orcamentos.filter(
    (o) => o.contratanteId === contratanteId
  );
  const ltv = meus.reduce((acc, s) => acc + (s.valor ?? 0), 0);
  return {
    totalShows: meus.length,
    totalOrcamentos: meusOrcamentos.length,
    ltv,
    ticketMedio: meus.length > 0 ? Math.round(ltv / meus.length) : 0,
    ultimoShow: meus[meus.length - 1],
  };
}

// ---------- Casas ----------

export type CasaStats = {
  totalShows: number;
  faturamento: number;
  artistasQueTocaram: string[]; // nomes únicos
};

export function getCasaStats(casaId: string, shows: Show[]): CasaStats {
  const aqui = shows.filter((s) => s.casaId === casaId);
  const artistasUnicos = Array.from(new Set(aqui.map((s) => s.artistaNome)));
  return {
    totalShows: aqui.length,
    faturamento: aqui.reduce((acc, s) => acc + (s.valor ?? 0), 0),
    artistasQueTocaram: artistasUnicos,
  };
}

// ---------- Cidades ----------

export type CidadeStats = {
  totalShows: number;
  faturamento: number;
  totalCasas: number;
  topArtista?: { nome: string; shows: number };
};

export function getCidadeStats(
  cidadeId: string,
  shows: Show[],
  casas: Casa[]
): CidadeStats {
  const aqui = shows.filter((s) => s.cidadeId === cidadeId);
  const totalCasas = casas.filter((c) => c.cidadeId === cidadeId).length;

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
