import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";

/**
 * `loadStripe` memoizado (recomendação da Stripe: fora do render, uma vez por
 * app). Compartilhado pelo CheckoutEmbutido (Embedded Checkout) e pelo
 * PagamentoStripeElement (Payment Element) pra não carregar o Stripe.js duas
 * vezes. Sem `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` devolve `Promise<null>` — o
 * chamador degrada via `onIndisponivel`.
 */
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) return Promise.resolve(null);
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}
