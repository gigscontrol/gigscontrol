import Stripe from "stripe";
import {
  getPlano,
  valorMensal,
  valorAnual,
  PRECO_EXCEDENTE,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";

/**
 * Integração com a Stripe — modelo PRÉ-PAGO por validade (pagamento ÚNICO).
 *
 * NÃO usamos mais Subscriptions recorrentes. Cada compra é uma Checkout
 * Session em modo `payment` (pagamento único) que, ao ser paga, dispara o
 * webhook `checkout.session.completed` → a função central
 * `registrarPagamentoEEstenderAcesso` ESTENDE a validade (subscriptions.acesso_ate)
 * do workspace por N dias corridos (mensal=30, anual=365). Stripe e Mercado
 * Pago se conversam através dessa mesma RPC idempotente — só ESTENDEM a mesma
 * validade.
 *
 * Preços são montados ad-hoc via `price_data` a partir de `planos.ts` (não
 * precisa Prices cadastrados no painel). Valores em R$/US$ × 100 (centavos).
 * A chave secreta é lida do ambiente (server-only).
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
 * Valor TOTAL da cobrança pra um plano + ciclo, em R$/US$ (espelha planos.ts):
 *  - mensal: o preço mensal cheio.
 *  - anual: o preço TOTAL do ano (cobrado 1× — 30/365 dias de acesso).
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

/** Nome legível do produto ad-hoc na fatura/checkout (ex.: "Individual — mensal"). */
function nomeProduto(plano: PlanoId, ciclo: CicloCobranca): string {
  return `${getPlano(plano).nome} — ${ciclo === "anual" ? "anual" : "mensal"}`;
}

/**
 * Cria a Checkout Session em modo `payment` (PAGAMENTO ÚNICO) e devolve a
 * session. NÃO usa Prices do painel: monta `line_items` ad-hoc via `price_data`
 * (unit_amount = valorCobranca × 100). O `workspace_id`/`plano`/`ciclo` viajam
 * no metadata da SESSION E do payment_intent — é assim que o webhook
 * `checkout.session.completed` (mode=payment, paid) sabe qual workspace estender
 * e por quantos dias.
 *
 * `embedded` controla a apresentação (mesma session, só o modo muda):
 *  - `false` (DEFAULT, hosted): checkout hospedado da Stripe. A URL vem em
 *    `session.url`; sucesso/cancelamento voltam pra `/pagamento/retorno`.
 *  - `true` (embedded): Embedded Checkout (iframe na nossa página). Retorna
 *    `session.client_secret`; ao concluir, o Stripe redireciona pra `return_url`
 *    (/pagamento/retorno com o session_id na query).
 *
 * `creditoDias` (opcional) = crédito de upgrade em DIAS, somado aos dias do
 * ciclo pelo webhook (recalculado server-side — o metadata cru NUNCA é confiado).
 */
export async function criarCheckoutPagamento(params: {
  workspaceId: string;
  plano: PlanoId;
  ciclo: CicloCobranca;
  customerId: string;
  moeda?: Moeda;
  email?: string | null;
  baseUrl?: string;
  embedded?: boolean;
  creditoDias?: number;
}): Promise<Stripe.Checkout.Session> {
  const {
    workspaceId,
    plano,
    ciclo,
    customerId,
    moeda = "brl",
    embedded = false,
    creditoDias,
  } = params;
  const baseUrl = params.baseUrl ?? appUrl();
  const valor = valorCobranca(plano, ciclo, moeda);

  const meta: Record<string, string> = { workspace_id: workspaceId, plano, ciclo };
  if (typeof creditoDias === "number" && creditoDias > 0) {
    meta.credito_dias = String(Math.round(creditoDias));
  }

  const comum = {
    mode: "payment" as const,
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: moeda === "usd" ? "usd" : "brl",
          unit_amount: Math.round(valor * 100),
          product_data: { name: nomeProduto(plano, ciclo) },
        },
      },
    ],
    client_reference_id: workspaceId,
    // Metadata na SESSION e no PaymentIntent — o webhook lê de qualquer um.
    metadata: meta,
    payment_intent_data: { metadata: meta },
  };

  if (embedded) {
    return getStripe().checkout.sessions.create({
      ...comum,
      // DESVIO DO SPEC: o spec pede ui_mode:'embedded', mas o SDK pinado
      // (stripe@22.3.0) tipa o valor como 'embedded_page'. No fio da API isso
      // serializa pro embedded correto; usamos o literal que o typegen exige.
      ui_mode: "embedded_page",
      // O Stripe substitui {CHECKOUT_SESSION_ID} pelo id real da sessão.
      return_url: `${baseUrl}/pagamento/retorno?session_id={CHECKOUT_SESSION_ID}`,
    });
  }

  return getStripe().checkout.sessions.create({
    ...comum,
    success_url: `${baseUrl}/pagamento/retorno?status=success`,
    cancel_url: `${baseUrl}/pagamento/retorno?status=cancel`,
  });
}

/**
 * Cria um PaymentIntent avulso pro Stripe Payment Element (Deferred Intent).
 *
 * Substitui o Embedded Checkout na aba Stripe do checkout próprio: em vez de uma
 * Checkout Session, criamos direto o PaymentIntent e devolvemos o `client_secret`
 * (prefixo `pi_..._secret_`) pro front montar o Payment Element via
 * @stripe/stripe-js. NÃO usa `setup_future_usage` (não salvamos cartão) e SÓ
 * aceita cartão (`payment_method_types: ['card']`) — PIX é exclusivo do MP.
 *
 * O metadata é IDÊNTICO ao de `criarCheckoutPagamento` (`{ workspace_id, plano,
 * ciclo, credito_dias? }`), então o webhook `payment_intent.succeeded` estende a
 * validade pelas MESMAS regras do fluxo hosted/embedded. O amount é recalculado
 * server-side (`valorCobranca × 100`) — o client nunca decide o valor.
 *
 * `creditoDias` (opcional) = crédito de upgrade em DIAS, somado aos dias do
 * ciclo pelo webhook (recalculado server-side — o metadata cru NUNCA é confiado).
 */
export async function criarPaymentIntentPagamento(params: {
  workspaceId: string;
  plano: PlanoId;
  ciclo: CicloCobranca;
  customerId: string;
  moeda?: Moeda;
  creditoDias?: number;
}): Promise<Stripe.PaymentIntent> {
  const { workspaceId, plano, ciclo, customerId, moeda = "brl", creditoDias } = params;
  const valor = valorCobranca(plano, ciclo, moeda);

  const meta: Record<string, string> = { workspace_id: workspaceId, plano, ciclo };
  if (typeof creditoDias === "number" && creditoDias > 0) {
    meta.credito_dias = String(Math.round(creditoDias));
  }

  return getStripe().paymentIntents.create({
    amount: Math.round(valor * 100),
    currency: moeda === "usd" ? "usd" : "brl",
    customer: customerId,
    // SÓ cartão (D1) — sem setup_future_usage (não salvamos cartão).
    payment_method_types: ["card"],
    metadata: meta,
  });
}

/**
 * Cria uma Checkout Session avulsa (mode `payment`) pra cobrar UMA unidade
 * EXCEDENTE (ex.: contrato além do limite do ciclo). Valor = PRECO_EXCEDENTE na
 * moeda. Metadata `{ workspace_id, excedente: 'true' }` — o webhook reconhece o
 * excedente e registra o pagamento SEM conceder dias (status
 * 'excedente_disponivel'). Devolve a session (URL hospedada em `session.url`).
 */
export async function criarCheckoutExcedente(params: {
  workspaceId: string;
  customerId: string;
  moeda?: Moeda;
  descricao?: string;
  baseUrl?: string;
}): Promise<Stripe.Checkout.Session> {
  const { workspaceId, customerId, moeda = "brl" } = params;
  const baseUrl = params.baseUrl ?? appUrl();
  const meta: Record<string, string> = {
    workspace_id: workspaceId,
    excedente: "true",
  };
  return getStripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: moeda === "usd" ? "usd" : "brl",
          unit_amount: PRECO_EXCEDENTE[moeda],
          product_data: {
            name: params.descricao ?? "Contrato excedente",
          },
        },
      },
    ],
    client_reference_id: workspaceId,
    metadata: meta,
    payment_intent_data: { metadata: meta },
    success_url: `${baseUrl}/pagamento/retorno?status=success`,
    cancel_url: `${baseUrl}/pagamento/retorno?status=cancel`,
  });
}

/** 'month' | 'year' (Stripe) → nosso ciclo. Usado no legado invoice.paid. */
export function cicloDoInterval(interval: string | undefined | null): CicloCobranca {
  return interval === "year" ? "anual" : "mensal";
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
