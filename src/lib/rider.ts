import type { ItemQuantidade } from "@/types";

/**
 * Itens de seção a partir do RIDER salvo no artista (só nomes; qtd nasce 0 e
 * é definida por orçamento/venda). Artista sem rider cai no catálogo padrão.
 */
export function itensDoRider(
  nomes: string[] | undefined,
  catalogo: readonly string[]
): ItemQuantidade[] {
  const base = nomes && nomes.length > 0 ? nomes : catalogo;
  return base.map((n) => ({ nome: n, qtd: 0 }));
}
