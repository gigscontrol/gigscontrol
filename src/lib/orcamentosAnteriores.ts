import type { Casa, Cidade, Orcamento } from "@/types";

/**
 * Orçamentos anteriores que interessam a quem está montando um NOVO
 * orçamento: os da mesma cidade e os do mesmo evento/local. Puro — testado em
 * orcamentosAnteriores.test.ts. As listas de entrada já vêm filtradas pela
 * permissão de quem vê (contexts do servidor).
 */

/** A cidade escolhida no autocomplete (IBGE no Brasil, GeoNames fora). */
export type CidadeAlvo = { ibgeId?: string; geonameId?: string; nome: string; uf: string };

export function normalizarNome(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ids das cidades cadastradas que são a cidade escolhida. Casa por IBGE/
 * GeoNames; sem eles (cidade legada/manual), por nome + UF. Pode haver mais de
 * um registro da mesma cidade (cadastros antigos) — todos contam.
 */
export function idsDaCidade(alvo: CidadeAlvo, cidades: readonly Cidade[]): Set<string> {
  const nome = normalizarNome(alvo.nome);
  const uf = normalizarNome(alvo.uf);
  return new Set(
    cidades
      .filter(
        (c) =>
          (!!alvo.ibgeId && c.ibgeId === alvo.ibgeId) ||
          (!!alvo.geonameId && c.geonameId === alvo.geonameId) ||
          (normalizarNome(c.nome) === nome && normalizarNome(c.estado) === uf)
      )
      .map((c) => String(c.id))
  );
}

const maisRecentePrimeiro = (a: Orcamento, b: Orcamento) =>
  (b.criadoEm || "").localeCompare(a.criadoEm || "");

/** Orçamentos daquela cidade, mais recente primeiro. */
export function orcamentosDaCidade(orcamentos: readonly Orcamento[], ids: Set<string>): Orcamento[] {
  if (ids.size === 0) return [];
  return orcamentos.filter((o) => ids.has(String(o.cidadeId))).sort(maisRecentePrimeiro);
}

/** Mínimo de letras digitadas pra procurar evento/local (evita "Ba" casar tudo). */
export const MIN_LETRAS_EVENTO = 4;

/**
 * Orçamentos do mesmo evento ou local: o nome digitado aparece no nome do
 * evento, no local informado ou na casa vinculada (sem acento/maiúscula).
 */
export function orcamentosDoEvento(
  orcamentos: readonly Orcamento[],
  casas: readonly Casa[],
  termos: readonly string[]
): Orcamento[] {
  const busca = termos.map(normalizarNome).filter((t) => t.length >= MIN_LETRAS_EVENTO);
  if (busca.length === 0) return [];
  const nomeCasa = new Map(casas.map((c) => [String(c.id), normalizarNome(c.nome)]));
  return orcamentos
    .filter((o) => {
      const nomes = [
        o.detalhesEvento?.nomeEvento,
        o.detalhesEvento?.nomeLocal,
        o.casaId ? nomeCasa.get(String(o.casaId)) : undefined,
      ]
        .filter((n): n is string => !!n)
        .map(normalizarNome);
      return busca.some((t) => nomes.some((n) => n.includes(t)));
    })
    .sort(maisRecentePrimeiro);
}
