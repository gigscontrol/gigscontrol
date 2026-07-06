import type { TaxaAgenciaModo } from "@/types";

/**
 * Taxa de agência = comissão que o artista paga à agência por intermediar a
 * venda. Configurada no artista (`taxaModo` + `taxaValor`); nos modos VARIÁVEIS
 * o valor é definido a cada orçamento. Resultado gravado na venda/orçamento
 * como `taxa_agencia_valor` + `taxa_modo_aplicado` (snapshot do modo usado).
 *
 * É INFORMATIVA: não altera o "a receber" (as parcelas continuam sendo o
 * pagamento do contratante = cachê cheio). Serve pra mostrar o líquido do
 * artista (cachê − taxa) e, no futuro, a receita da agência.
 */
export type TaxaAgenciaResultado = {
  /** R$ da comissão, 2 casas (centavos). */
  valor: number;
  /** Modo efetivamente aplicado (snapshot). */
  modoAplicado: TaxaAgenciaModo;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Calcula a comissão da agência.
 *  - sem-taxa:       0
 *  - perc-fixa:      cachê × (taxaValor do artista)%
 *  - valor-fixo:     taxaValor do artista (R$)
 *  - perc-variavel:  cachê × (% digitado no orçamento)
 *  - valor-variavel: R$ digitado no orçamento
 * Clampa negativos a 0 e a taxa ao teto do cachê (não faz sentido comissão > cachê).
 */
export function calcularTaxaAgencia(params: {
  modo: TaxaAgenciaModo | null | undefined;
  /** Config fixa do artista (perc-fixa usa como %, valor-fixo como R$). */
  taxaValorArtista?: number | null;
  cache: number;
  /** Digitado no orçamento nos modos variáveis (% ou R$ conforme o modo). */
  entradaVariavel?: number | null;
}): TaxaAgenciaResultado {
  const modo = params.modo ?? "sem-taxa";
  const cache = Math.max(0, params.cache || 0);
  const fixo = Math.max(0, params.taxaValorArtista ?? 0);
  const variavel = Math.max(0, params.entradaVariavel ?? 0);

  let valor = 0;
  switch (modo) {
    case "perc-fixa":
      valor = (cache * fixo) / 100;
      break;
    case "valor-fixo":
      valor = fixo;
      break;
    case "perc-variavel":
      valor = (cache * variavel) / 100;
      break;
    case "valor-variavel":
      valor = variavel;
      break;
    case "sem-taxa":
    default:
      return { valor: 0, modoAplicado: "sem-taxa" };
  }
  return { valor: Math.min(r2(valor), cache), modoAplicado: modo };
}

/** Líquido do artista = cachê − comissão (nunca negativo). */
export function liquidoArtista(cache: number, taxa: number): number {
  return r2(Math.max(0, (cache || 0) - (taxa || 0)));
}
