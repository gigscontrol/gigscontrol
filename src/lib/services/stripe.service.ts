import Stripe from "stripe";
import {
  PLANOS,
  getPlano,
  valorMensal,
  valorAnual,
  PRECO_EXCEDENTE,
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

/** 'month' | 'year' (Stripe) → nosso ciclo. */
export function cicloDoInterval(interval: string | undefined | null): CicloCobranca {
  return interval === "year" ? "anual" : "mensal";
}

/**
 * Extrai {plano, ciclo, moeda} do `lookup_key` de um preço da Stripe
 * (`${plano}_${ciclo}[_usd]`). É o inverso do `lookupKey()`. null se não bater
 * com nenhum plano conhecido. Usado pelo webhook pra reconciliar o plano a
 * partir do que a Stripe realmente está cobrando.
 */
export function parseLookupKey(
  lookupKey: string | null | undefined
): { plano: PlanoId; ciclo: CicloCobranca; moeda: Moeda } | null {
  if (!lookupKey) return null;
  let s = lookupKey;
  let moeda: Moeda = "brl";
  if (s.endsWith("_usd")) {
    moeda = "usd";
    s = s.slice(0, -4);
  }
  let ciclo: CicloCobranca;
  if (s.endsWith("_mensal")) {
    ciclo = "mensal";
    s = s.slice(0, -"_mensal".length);
  } else if (s.endsWith("_anual")) {
    ciclo = "anual";
    s = s.slice(0, -"_anual".length);
  } else {
    return null;
  }
  const plano = PLANOS.find((p) => p.id === s)?.id;
  if (!plano) return null;
  return { plano, ciclo, moeda };
}

/**
 * Moeda + ciclo (do Stripe, não do banco) + dias restantes do ciclo atual.
 * Ciclo derivado de `price.recurring.interval` pra bater com a cobrança real.
 */
export async function infoSubscription(subscriptionId: string): Promise<{
  moeda: Moeda;
  ciclo: CicloCobranca;
  diasRestantes: number;
  /** unix seconds do fim do período atual (quando o downgrade viraria). */
  periodEnd: number | null;
  /** unix seconds do início do período atual (pra medir o ciclo real). */
  periodStart: number | null;
}> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  const moeda: Moeda = item?.price?.currency === "usd" ? "usd" : "brl";
  const ciclo = cicloDoInterval(item?.price?.recurring?.interval);
  const periodEnd = item?.current_period_end ?? null;
  const periodStart = item?.current_period_start ?? null;
  const diasRestantes = periodEnd
    ? Math.max(0, Math.ceil((periodEnd * 1000 - Date.now()) / 86_400_000))
    : 0;
  return { moeda, ciclo, diasRestantes, periodEnd, periodStart };
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
}): Promise<{ subscription: Stripe.Subscription; moeda: Moeda; ciclo: CicloCobranca }> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  if (!item) throw new Error("Assinatura sem item de preço.");
  // Moeda E ciclo saem do estado REAL da assinatura no Stripe (não do banco),
  // pra o novo preço bater com a cobrança atual (evita trocar mensal↔anual).
  const moeda: Moeda = item.price?.currency === "usd" ? "usd" : "brl";
  const ciclo = cicloDoInterval(item.price?.recurring?.interval);
  const novoPriceId = await resolverPriceId(params.plano, ciclo, moeda);
  const subscription = await stripe.subscriptions.update(
    params.subscriptionId,
    {
      items: [{ id: item.id, price: novoPriceId }],
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
      // Mantém o metadata coerente com o preço novo (o webhook pode confiar nele).
      metadata: { ...(sub.metadata ?? {}), plano: params.plano, ciclo, moeda },
    },
    // Idempotência: duplo clique / retry não cobra o rateio 2×.
    { idempotencyKey: `upgrade_${params.subscriptionId}_${novoPriceId}` }
  );
  return { subscription, moeda, ciclo };
}

/** id (string) de um campo Stripe que pode vir expandido (objeto) ou só id. */
function idDeStripe(campo: string | { id: string } | null | undefined): string | null {
  if (!campo) return null;
  return typeof campo === "string" ? campo : campo.id;
}

/**
 * Agenda um DOWNGRADE pro fim do período atual, via Subscription Schedule:
 *  - Fase 1: preço ATUAL até o fim do período (cliente mantém os benefícios
 *    do plano de cima até acabarem os dias já pagos).
 *  - Fase 2: preço do plano-destino, SEM proration (não devolve dinheiro).
 * Quando a fase 2 começa, a Stripe fatura o preço menor → `invoice.paid` →
 * o webhook reconcilia o plano no MESMO instante (rebaixa acesso na virada).
 *
 * `end_behavior: 'release'` = depois da fase 2 a subscription segue sozinha
 * no preço novo (o schedule se solta). Devolve quando vira + o valor novo.
 */
export async function agendarDowngrade(params: {
  subscriptionId: string;
  plano: PlanoId;
}): Promise<{
  efetivoEm: number | null;
  ciclo: CicloCobranca;
  moeda: Moeda;
  valorNovo: number;
}> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ["items.data.price"],
  });
  const item = sub.items.data[0];
  if (!item) throw new Error("Assinatura sem item de preço.");
  const moeda: Moeda = item.price?.currency === "usd" ? "usd" : "brl";
  const ciclo = cicloDoInterval(item.price?.recurring?.interval);
  const periodEnd = item.current_period_end ?? null;
  const precoAtualId = idDeStripe(item.price);
  const novoPriceId = await resolverPriceId(params.plano, ciclo, moeda);
  const workspaceId = (sub.metadata?.workspaceId as string) ?? "";

  // Cria o schedule adotando a subscription atual (phases[0] = fase vigente).
  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: params.subscriptionId,
  });
  const fase0 = schedule.phases[0];
  const qtd = fase0?.items?.[0]?.quantity ?? 1;

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        // Preserva a fase atual até o fim do período já pago.
        items: [{ price: precoAtualId ?? novoPriceId, quantity: qtd }],
        start_date: fase0?.start_date,
        end_date: fase0?.end_date,
      },
      {
        // Fase nova: plano-destino, sem rateio (nada é devolvido).
        items: [{ price: novoPriceId, quantity: 1 }],
        proration_behavior: "none",
        metadata: { workspaceId, plano: params.plano, ciclo, moeda },
      },
    ],
    metadata: { workspaceId, downgrade_para: params.plano },
  });

  return {
    efetivoEm: periodEnd,
    ciclo,
    moeda,
    valorNovo: valorCobranca(params.plano, ciclo, moeda),
  };
}

/**
 * Cancela um downgrade agendado: solta (release) o Subscription Schedule, o
 * que mantém a subscription no plano ATUAL (fase 1), renovando normalmente.
 * Devolve true se havia um schedule pra soltar.
 */
export async function cancelarDowngrade(params: {
  subscriptionId: string;
}): Promise<boolean> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId);
  const scheduleId = idDeStripe(sub.schedule);
  if (!scheduleId) return false;
  await stripe.subscriptionSchedules.release(scheduleId);
  return true;
}

/**
 * Cobra UMA unidade excedente (ex.: contrato além do limite do ciclo) no cartão
 * salvo da assinatura, NA HORA (off-session). Valor = PRECO_EXCEDENTE na moeda
 * REAL da assinatura (R$ 9,99 / US$ 5). Idempotente pelo `idempotencyKey` (o
 * mesmo clique/retry não cobra 2×). Lança se não houver cartão ou o pagamento
 * não for aprovado.
 */
export async function cobrarExcedente(params: {
  subscriptionId: string;
  descricao: string;
  idempotencyKey: string;
}): Promise<{ moeda: Moeda; valor: number; paymentIntentId: string }> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ["items.data.price", "default_payment_method"],
  });
  const item = sub.items.data[0];
  const moeda: Moeda = item?.price?.currency === "usd" ? "usd" : "brl";
  const customerId = idDeStripe(sub.customer);
  if (!customerId) throw new Error("Assinatura sem cliente na Stripe.");

  // Cartão: o default da assinatura, ou o default do cliente.
  let pmId = idDeStripe(sub.default_payment_method as string | { id: string } | null);
  if (!pmId) {
    const cust = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
    pmId = idDeStripe(
      (cust.invoice_settings?.default_payment_method as string | { id: string } | null) ?? null
    );
  }
  if (!pmId) throw new Error("Nenhum cartão salvo para cobrar o excedente.");

  const valor = PRECO_EXCEDENTE[moeda];
  const pi = await stripe.paymentIntents.create(
    {
      amount: valor,
      currency: moeda,
      customer: customerId,
      payment_method: pmId,
      off_session: true,
      confirm: true,
      description: params.descricao,
    },
    { idempotencyKey: params.idempotencyKey }
  );
  if (pi.status !== "succeeded") {
    throw new Error("Pagamento do excedente não foi aprovado.");
  }
  return { moeda, valor, paymentIntentId: pi.id };
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
