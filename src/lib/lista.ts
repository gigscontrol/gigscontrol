/**
 * Lógica da LISTA PADRÃO (ordenar por coluna + paginar). Pura — testada em
 * lista.test.ts. O componente visual mora em components/lista/TabelaDados.
 */

export type Direcao = "asc" | "desc";
export type Ordem = { chave: string; direcao: Direcao } | null;

export type ValorOrdenavel = string | number | null | undefined;

const colador = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Compara dois valores; vazio (null/undefined/"") vai SEMPRE pro fim. */
export function comparar(a: ValorOrdenavel, b: ValorOrdenavel, direcao: Direcao): number {
  const vazioA = a === null || a === undefined || a === "";
  const vazioB = b === null || b === undefined || b === "";
  if (vazioA && vazioB) return 0;
  if (vazioA) return 1;
  if (vazioB) return -1;
  const base =
    typeof a === "number" && typeof b === "number" ? a - b : colador.compare(String(a), String(b));
  return direcao === "asc" ? base : -base;
}

/** Ordena uma CÓPIA, estável (empate mantém a ordem de entrada). */
export function ordenar<T>(itens: readonly T[], valor: (item: T) => ValorOrdenavel, direcao: Direcao): T[] {
  return itens
    .map((item, i) => ({ item, i, v: valor(item) }))
    .sort((x, y) => comparar(x.v, y.v, direcao) || x.i - y.i)
    .map((x) => x.item);
}

/**
 * Clique no título da coluna: 1º clique ordena (crescente; datas e valores
 * começam decrescentes, que é o que se procura primeiro), 2º inverte, 3º
 * volta pra ordem original da tela.
 */
export function proximaOrdem(atual: Ordem, chave: string, comecaDecrescente = false): Ordem {
  const primeira: Direcao = comecaDecrescente ? "desc" : "asc";
  if (!atual || atual.chave !== chave) return { chave, direcao: primeira };
  if (atual.direcao === primeira) return { chave, direcao: primeira === "asc" ? "desc" : "asc" };
  return null;
}

export type Pagina<T> = {
  itens: T[];
  pagina: number;
  totalPaginas: number;
  inicio: number; // 1-based, 0 quando vazio
  fim: number;
  total: number;
};

/** Recorte da página (página fora do intervalo é ajustada pro limite). */
export function paginar<T>(itens: readonly T[], pagina: number, porPagina: number): Pagina<T> {
  const total = itens.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const p = Math.min(Math.max(1, pagina), totalPaginas);
  const ini = (p - 1) * porPagina;
  const fatia = itens.slice(ini, ini + porPagina);
  return {
    itens: fatia,
    pagina: p,
    totalPaginas,
    inicio: total === 0 ? 0 : ini + 1,
    fim: ini + fatia.length,
    total,
  };
}
