import Stripe from "stripe";
import {
  getPlano,
  valorMensal,
  valorAnual,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";

/**
 * Integração com a Stripe — Assinaturas recorrentes (Subscriptions).
 *
 * Fluxo:
 *  1. `criarCheckoutAssinatura` cria uma Checkout Session em modo
 *     `subscription` e devolve a URL hospedada da Stripe pra onde o
 *     cliente é redirecionado (cartão).
 *  2. Cliente paga lá. A Stripe chama nosso webhook
 *     (`/api/webhooks/stripe`) com `checkout.session.completed`.
 *  3. O webhook ativa a assinatura e, nas renovações, recebe
 *     `invoice.paid` / `customer.subscription.updated` / `.deleted`.
 *
 * Preços são resolvidos por `lookup_key` = `${plano}_${ciclo}`
 * (ex.: `equipe_mensal`, `agencia-plus_anual`) — configurados no painel
 * da Stripe. A chave secreta é lida do ambiente (server-only).
 *
 * O cliente Stripe é inicializado de forma preguiçosa (lazy) dentro de
 * `getStripe()` pra que o build não quebre quando STRIPE_SECRET_KEY não
 * está presente em build time — a chave só é exigida em request time.
 */

let _stripe: Stripe | null = null;

/** Cliente Stripe (lazy). Lança erro claro se a chave não estiver setada. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não configurado no ambiente.");
  }
  // Sem pin de apiVersion — usa o default do SDK.
  _stripe = new Stripe(key);
  return _stripe;
}

/** URL pública do app (success/cancel urls), sem barra final. */
function appUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return u.replace(/\/+$/, "");
}

/**
 * lookup_key do preço na Stripe pra um plano + ciclo + moeda.
 * BRL: `${plano}_${ciclo}` (ex. `time_mensal`); USD: + sufixo `_usd`
 * (ex. `time_mensal_usd`).
 */
export function lookupKey(
  plano: PlanoId,
  ciclo: CicloCobranca,
  moeda: Moeda = "brl"
): string {
  return `${plano}_${ciclo}${moeda === "usd" ? "_usd" : ""}`;
}

/**
 * Valor TOTAL da cobrança pra um plano + ciclo, em R$ (espelha planos.ts):
 *  - mensal: o preço mensal cheio.
 *  - anual: o preço-por-mês do anual × 12.
 */
export function valorCobranca(
  planoId: PlanoId,
  ciclo: CicloCobranca,
  moeda: Moeda = "brl"
): number {
  const plano = getPlano(planoId);
  return ciclo === "anual" ? valorAnual(plano, moeda) : valorMensal(plano, moeda);
}

/**
 * Resolve o Price id da Stripe via lookup_key. Lança erro claro se o
 * preço não estiver configurado/ativo no painel.
 */
export async function resolverPriceId(
  plano: PlanoId,
  ciclo: CicloCobranca,
  moeda: Moeda = "brl"
): Promise<string> {
  const key = lookupKey(plano, ciclo, moeda);
  const lista = await getStripe().prices.list({
    lookup_keys: [key],
    active: true,
    limit: 1,
  });
  const price = lista.data[0];
  if (!price) {
    throw new Error(`Preço não configurado na Stripe (lookup_key: ${key}).`);
  }
  return price.id;
}

/**
 * Reaproveita o customer existente (se houver) ou cria um novo na Stripe.
 * O `workspaceId` vai no metadata pra rastreabilidade.
 */
export async function obterOuCriarCustomer(params: {
  workspaceId: string;
  email?: string | null;
  customerIdExistente?: string | null;
}): Promise<string> {
  const { workspaceId, email, customerIdExistente } = params;
  if (customerIdExistente) return customerIdExistente;
  const customer = await getStripe().customers.create({
    email: email ?? undefined,
    metadata: { workspaceId },
  });
  return customer.id;
}

/**
 * Cria a Checkout Session em modo `subscription` e devolve a session
 * (a URL hospedada vem em `session.url`). O `workspaceId` viaja no
 * metadata da session E da subscription — é assim que o webhook sabe
 * qual conta ativar.
 */
export async function criarCheckoutAssinatura(params: {
  workspaceId: string;
  plano: PlanoId;
  ciclo: CicloCobranca;
  customerId: string;
  moeda?: Moeda;
  baseUrl?: string;
}): Promise<Stripe.Checkout.Session> {
  const { workspaceId, plano, ciclo, customerId, moeda = "brl" } = params;
  const baseUrl = params.baseUrl ?? appUrl();
  const priceId = await resolverPriceId(plano, ciclo, moeda);

  return getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/pagamento/retorno?status=success`,
    cancel_url: `${baseUrl}/pagamento/retorno?status=cancel`,
    client_reference_id: workspaceId,
    subscription_data: {
      metadata: { workspaceId, plano, ciclo, moeda },
    },
    metadata: { workspaceId, plano, ciclo, moeda },
  });
}

/** Moeda + dias restantes do ciclo atual da assinatura (pro preview do upgrade). */
export async function infoSubscription(subscriptionId: string): Promise<{
  moeda: Moeda;
  diasRestantes: number;
}> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  const moeda: Moeda = item?.price?.currency === "usd" ? "usd" : "brl";
  const periodEnd = item?.current_period_end ?? null;
  const diasRestantes = periodEnd
    ? Math.max(0, Math.ceil((periodEnd * 1000 - Date.now()) / 86_400_000))
    : 0;
  return { moeda, diasRestantes };
}

/**
 * Aplica upgrade da assinatura: troca o item de preço com RATEIO e cobra a
 * diferença NA HORA (`proration_behavior: 'always_invoice'` cria e cobra a
 * fatura de rateio imediatamente). Falha se o cartão recusar
 * (`error_if_incomplete`). Devolve a subscription atualizada + a moeda.
 */
export async function aplicarUpgrade(params: {
  subscriptionId: string;
  plano: PlanoId;
  ciclo: CicloCobranca;
}): Promise<{ subscription: Stripe.Subscription; moeda: Moeda }> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  if (!item) throw new Error("Assinatura sem item de preço.");
  const moeda: Moeda = item.price?.currency === "usd" ? "usd" : "brl";
  const novoPriceId = await resolverPriceId(params.plano, params.ciclo, moeda);
  const subscription = await stripe.subscriptions.update(params.subscriptionId, {
    items: [{ id: item.id, price: novoPriceId }],
    proration_behavior: "always_invoice",
    payment_behavior: "error_if_incomplete",
  });
  return { subscription, moeda };
}

/**
 * Constrói e VERIFICA o evento do webhook a partir do corpo bruto e da
 * assinatura `stripe-signature`. Lança se a assinatura não confere.
 */
export function construirEvento(
  rawBody: string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET não configurado no ambiente.");
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
