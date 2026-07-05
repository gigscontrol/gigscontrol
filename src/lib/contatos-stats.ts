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
  djsQueTocaram: string[]; // nomes únicos
};

export function getCasaStats(casaId: string, shows: Show[]): CasaStats {
  const aqui = shows.filter((s) => s.casaId === casaId);
  const djsUnicos = Array.from(new Set(aqui.map((s) => s.dj)));
  return {
    totalShows: aqui.length,
    faturamento: aqui.reduce((acc, s) => acc + (s.valor ?? 0), 0),
    djsQueTocaram: djsUnicos,
  };
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
  shows: Show[],
  casas: Casa[]
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

// ---------- Helpers gerais ----------

export function getCidadeNome(cidadeId: string, cidades: Cidade[]) {
  const c = cidades.find((x) => x.id === cidadeId);
  return c ? `${c.nome}, ${c.estado}` : "—";
}

export function getContratanteNome(
  contratanteId: string | undefined,
  contratantes: Contratante[]
) {
  if (!contratanteId) return "—";
  return contratantes.find((x) => x.id === contratanteId)?.nome ?? "—";
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
