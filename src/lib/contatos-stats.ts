import { MOCK_SHOWS } from "./mock-shows";
import { MOCK_CASAS } from "./mock-casas";
import { MOCK_CIDADES } from "./mock-cidades";
import { MOCK_CONTRATANTES } from "./mock-contratantes";
import type { Show, Contratante, Casa, Cidade, Orcamento } from "@/types";

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
  shows: Show[] = MOCK_SHOWS,
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

export function getContratantesComStats(shows: Show[] = MOCK_SHOWS, contratantes: Contratante[] = MOCK_CONTRATANTES) {
  return contratantes.map((c) => ({
    ...c,
    stats: getContratanteStats(c.id, shows),
  }));
}

// ---------- Casas ----------

export type CasaStats = {
  totalShows: number;
  faturamento: number;
  djsQueTocaram: string[]; // nomes únicos
};

export function getCasaStats(casaId: string, shows: Show[] = MOCK_SHOWS): CasaStats {
  const aqui = shows.filter((s) => s.casaId === casaId);
  const djsUnicos = Array.from(new Set(aqui.map((s) => s.dj)));
  return {
    totalShows: aqui.length,
    faturamento: aqui.reduce((acc, s) => acc + (s.valor ?? 0), 0),
    djsQueTocaram: djsUnicos,
  };
}

export function getCasasComStats(shows: Show[] = MOCK_SHOWS, casas: Casa[] = MOCK_CASAS) {
  return casas.map((c) => ({
    ...c,
    stats: getCasaStats(c.id, shows),
  }));
}

// ---------- Cidades ----------

export type CidadeStats = {
  totalShows: number;
  faturamento: number;
  totalCasas: number;
  topDJ?: { nome: string; shows: number };
};

export function getCidadeStats(
  cidadeId: string,
  shows: Show[] = MOCK_SHOWS,
  casas: Casa[] = MOCK_CASAS
): CidadeStats {
  const aqui = shows.filter((s) => s.cidadeId === cidadeId);
  const totalCasas = casas.filter((c) => c.cidadeId === cidadeId).length;

  // Conta shows por DJ
  const porDJ = new Map<string, number>();
  aqui.forEach((s) => {
    porDJ.set(s.dj, (porDJ.get(s.dj) ?? 0) + 1);
  });
  let topDJ: { nome: string; shows: number } | undefined;
  porDJ.forEach((qtd, nome) => {
    if (!topDJ || qtd > topDJ.shows) topDJ = { nome, shows: qtd };
  });

  return {
    totalShows: aqui.length,
    faturamento: aqui.reduce((acc, s) => acc + (s.valor ?? 0), 0),
    totalCasas,
    topDJ,
  };
}

export function getCidadesComStats(
  shows: Show[] = MOCK_SHOWS,
  cidades: Cidade[] = MOCK_CIDADES,
  casas: Casa[] = MOCK_CASAS
) {
  return cidades.map((c) => ({
    ...c,
    stats: getCidadeStats(c.id, shows, casas),
  }));
}

// ---------- Helpers gerais ----------

export function getCidadeNome(cidadeId: string, cidades: Cidade[] = MOCK_CIDADES) {
  const c = cidades.find((x) => x.id === cidadeId);
  return c ? `${c.nome}, ${c.estado}` : "—";
}

export function getCasaNome(casaId: string, casas: Casa[] = MOCK_CASAS) {
  return casas.find((x) => x.id === casaId)?.nome ?? "—";
}

export function getContratanteNome(contratanteId: string | undefined, contratantes: Contratante[] = MOCK_CONTRATANTES) {
  if (!contratanteId) return "—";
  return contratantes.find((x) => x.id === contratanteId)?.nome ?? "—";
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
