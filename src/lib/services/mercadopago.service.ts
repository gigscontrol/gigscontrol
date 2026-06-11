import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { getPlano, type PlanoId, type CicloCobranca } from "@/lib/planos";

/**
 * Integração com o Mercado Pago — Checkout Pro (Fase 1).
 *
 * Fluxo:
 *  1. `criarPreferenceCheckout` monta a "preference" (a ordem) e devolve
 *     o `init_point` — a URL hospedada do MP pra onde o cliente é
 *     redirecionado (PIX, boleto ou cartão).
 *  2. Cliente paga lá. O MP chama nosso `notification_url` (webhook).
 *  3. O webhook usa `buscarPagamento` pra confirmar o status real e
 *     ativar a assinatura.
 *
 * O Access Token é lido do ambiente (server-only) — nunca embutido.
 */

function getClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN não configurado no ambiente."
    );
  }
  return new MercadoPagoConfig({ accessToken });
}

/** URL pública do app (back_urls + notification_url), sem barra final. */
function appUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return u.replace(/\/+$/, "");
}

/**
 * Valor TOTAL da cobrança pra um plano + ciclo, em R$.
 *  - mensal: o preço mensal cheio.
 *  - anual: o preço-por-mês do anual × 12 (cobrança única no ano).
 */
export function valorCobranca(planoId: PlanoId, ciclo: CicloCobranca): number {
  const plano = getPlano(planoId);
  if (ciclo === "anual") {
    return Math.round(plano.precoAnualPorMes * 12 * 100) / 100;
  }
  return plano.precoMensal;
}

export type PreferenceCriada = {
  preferenceId: string;
  initPoint: string;
  valor: number;
};

/**
 * Cria a preference do Checkout Pro e devolve o init_point (URL do
 * checkout hospedado) + o id da preference (guardamos na subscription).
 *
 * `external_reference` = workspaceId — é como o webhook sabe qual conta
 * ativar quando o pagamento aprova.
 */
export async function criarPreferenceCheckout(params: {
  workspaceId: string;
  planoId: PlanoId;
  ciclo: CicloCobranca;
  payerEmail?: string;
}): Promise<PreferenceCriada> {
  const { workspaceId, planoId, ciclo, payerEmail } = params;
  const plano = getPlano(planoId);
  const valor = valorCobranca(planoId, ciclo);
  const base = appUrl();

  // O Mercado Pago só aceita auto_return e notification_url com URL
  // pública (https). Em dev (localhost) eles são omitidos — o back_url
  // ainda redireciona, mas sem auto_return; e o webhook só funciona em
  // ambiente público mesmo. Em produção (vercel https) ambos entram.
  const isPublico = base.startsWith("https://");

  const preference = new Preference(getClient());
  const result = await preference.create({
    body: {
      items: [
        {
          id: `${planoId}-${ciclo}`,
          title: `GIGS CONTROL — Plano ${plano.nome} (${ciclo})`,
          quantity: 1,
          unit_price: valor,
          currency_id: "BRL",
        },
      ],
      payer: payerEmail ? { email: payerEmail } : undefined,
      back_urls: {
        success: `${base}/pagamento/retorno?status=success`,
        pending: `${base}/pagamento/retorno?status=pending`,
        failure: `${base}/pagamento/retorno?status=failure`,
      },
      // Volta automático pro app quando aprova (só com URL pública).
      ...(isPublico ? { auto_return: "approved" } : {}),
      // Liga o pagamento à conta — usado no webhook.
      external_reference: workspaceId,
      // Webhook só com URL pública (MP não alcança localhost).
      ...(isPublico
        ? { notification_url: `${base}/api/webhooks/mercadopago` }
        : {}),
      metadata: { workspace_id: workspaceId, plano: planoId, ciclo },
      statement_descriptor: "GIGSCONTROL",
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error("Mercado Pago não retornou a preference (id/init_point).");
  }
  return {
    preferenceId: String(result.id),
    initPoint: result.init_point,
    valor,
  };
}

export type PagamentoMP = {
  id: string;
  /** approved | pending | rejected | in_process | cancelled | refunded ... */
  status: string;
  /** = workspaceId (external_reference que mandamos na preference). */
  externalReference: string | null;
  /** payment_method_id: 'pix' | 'bolbradesco' | 'visa' | 'master' ... */
  metodoId: string | null;
  /** payment_type_id: 'credit_card' | 'debit_card' | 'ticket' | 'bank_transfer' ... */
  tipo: string | null;
  valor: number | null;
  metadata: Record<string, unknown>;
};

/** Consulta o status real de um pagamento (chamado pelo webhook). */
export async function buscarPagamento(paymentId: string): Promise<PagamentoMP> {
  const payment = new Payment(getClient());
  const p = await payment.get({ id: paymentId });
  return {
    id: String(p.id ?? paymentId),
    status: p.status ?? "unknown",
    externalReference: p.external_reference ?? null,
    metodoId: p.payment_method_id ?? null,
    tipo: p.payment_type_id ?? null,
    valor: p.transaction_amount ?? null,
    metadata: (p.metadata as Record<string, unknown>) ?? {},
  };
}

/**
 * Normaliza o payment_type_id do MP pro nosso enum `metodo` da
 * subscription (pix | boleto | credit_card | debit_card).
 */
export function normalizarMetodo(p: PagamentoMP): string | null {
  if (p.tipo === "bank_transfer" || p.metodoId === "pix") return "pix";
  if (p.tipo === "ticket" || p.metodoId === "bolbradesco") return "boleto";
  if (p.tipo === "credit_card") return "credit_card";
  if (p.tipo === "debit_card") return "debit_card";
  return p.tipo ?? null;
}
