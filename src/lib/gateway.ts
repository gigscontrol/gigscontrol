import { resolverPais, regiaoDe } from "./regiao";

/**
 * Roteamento de gateway de pagamento por país.
 *
 * O sistema fala com DOIS gateways que se conversam por uma RPC central
 * idempotente (`registrarPagamentoEEstenderAcesso`): Stripe (internacional) e
 * Mercado Pago (Brasil). Ambos SÓ estendem a mesma validade.
 *
 * Regra de negócio (v1): Mercado Pago é EXCLUSIVO do Brasil. Fora do BR só
 * existe Stripe. Dentro do BR o padrão é Mercado Pago, mas Stripe segue
 * disponível como alternativa (cartão internacional, legado em transição).
 *
 * O país vem de `resolverPais(header, cookie)` (IP da Vercel; cookie só
 * sobrescreve em DEV) — não confie no cliente pra escolher gateway/moeda.
 */

export type Gateway = "stripe" | "mercadopago";

/** true se o país é Brasil (reusa a regra única de `regiaoDe`). */
function ehBrasil(pais: string | null | undefined): boolean {
  return regiaoDe(pais).br;
}

/**
 * Gateway PADRÃO pro país: BR → mercadopago; qualquer outro → stripe.
 * País desconhecido cai em BR (mesma convenção de `regiaoDe`).
 */
export function gatewayPadraoDe(pais: string | null | undefined): Gateway {
  return ehBrasil(pais) ? "mercadopago" : "stripe";
}

/**
 * Gateways DISPONÍVEIS pro país, em ordem de preferência.
 * BR → ['mercadopago', 'stripe']; resto → ['stripe'] (MP só pra Brasil).
 */
export function gatewaysDisponiveis(pais: string | null | undefined): Gateway[] {
  return ehBrasil(pais) ? ["mercadopago", "stripe"] : ["stripe"];
}

/**
 * true se o Mercado Pago pode ser oferecido pro país. v1: só Brasil.
 * Substitui o helper local `mpDisponivel()` que ficava na rota do MP.
 */
export function mpDisponivel(pais: string | null | undefined): boolean {
  return gatewaysDisponiveis(pais).includes("mercadopago");
}

// Re-export por conveniência: quem importa gateway costuma precisar resolver o
// país na mesma linha de raciocínio.
export { resolverPais };
