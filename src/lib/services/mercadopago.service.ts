import { createHmac, randomUUID } from "node:crypto";
import { MercadoPagoConfig, Payment } from "mercadopago";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";

/**
 * Integração com o Mercado Pago — Payment Brick embutido (v1: PIX + cartão).
 *
 * Diferente da Stripe (Checkout hospedado/embedded), aqui o pagamento é criado
 * DIRETO via `POST /v1/payments` a partir do formData que o Payment Brick do
 * front tokeniza no browser. NUNCA transita PAN/CVV pelo backend — só o `token`
 * gerado pelo Brick (SAQ-A).
 *
 * Fluxo:
 *  1. `criarPagamento` cria o pagamento (cartão OU PIX) usando o token/dados do
 *     Brick + `external_reference` = workspaceId (é como o webhook/status sabem
 *     de quem é).
 *  2. Cartão volta approved/in_process/rejected na hora. PIX volta pending com o
 *     QR Code (point_of_interaction.transaction_data).
 *  3. A confirmação real (approved) estende a validade via a RPC central
 *     `registrarPagamentoEEstenderAcesso` (idempotente). Ela é disparada em três
 *     caminhos que deduplicam entre si: síncrono (cartão approved), webhook
 *     (`/api/webhooks/mercadopago`) e polling (`/status`).
 *
 * O Access Token é lido do ambiente (server-only) de forma preguiçosa (lazy) —
 * sem ele, `getMercadoPago()` lança, mas o módulo importa/builda normal.
 */

let _client: MercadoPagoConfig | null = null;

/** Cliente MP (lazy). Lança erro claro se MERCADO_PAGO_ACCESS_TOKEN faltar. */
export function getMercadoPago(): MercadoPagoConfig {
  if (_client) return _client;
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado no ambiente.");
  }
  _client = new MercadoPagoConfig({ accessToken: token });
  return _client;
}

/** true se o Mercado Pago está configurado (token presente). */
export function mercadoPagoConfigurado(): boolean {
  return !!process.env.MERCADO_PAGO_ACCESS_TOKEN;
}

/** Minutos de validade do QR Code PIX antes de expirar. */
const PIX_EXPIRA_MIN = 30;

/**
 * Dados que o Payment Brick tokeniza no browser e envia pro backend. Para
 * cartão: `token`, `installments`, `payment_method_id`, `issuer_id`, `payer`.
 * Para PIX: `payment_method_id: 'pix'` + `payer`. NUNCA contém PAN/CVV — o
 * Brick já trocou o cartão por um `token` de uso único (SAQ-A).
 */
export type FormDataBrick = {
  token?: string;
  installments?: number;
  payment_method_id?: string;
  issuer_id?: string | number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

/** Dados do QR Code PIX (quando o pagamento é PIX). */
export type DadosPix = {
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
};

/** Resultado normalizado de um pagamento MP. */
export type PagamentoMP = {
  id: string;
  /** approved | in_process | pending | rejected | cancelled | refunded ... */
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  /** payment_method_id: 'pix' | 'visa' | 'master' ... */
  metodoId: string | null;
  /** payment_type_id: 'credit_card' | 'bank_transfer' | 'account_money' ... */
  tipo: string | null;
  /** valor em R$ (transaction_amount do MP). */
  valor: number | null;
  metadata: Record<string, unknown>;
  pix: DadosPix | null;
};

/** Extrai o QR Code PIX do point_of_interaction, se houver. */
function extrairPix(p: PaymentResponse): DadosPix | null {
  const td = p.point_of_interaction?.transaction_data;
  if (!td) return null;
  return {
    qrCode: td.qr_code ?? null,
    qrCodeBase64: td.qr_code_base64 ?? null,
    ticketUrl: td.ticket_url ?? null,
  };
}

/** Normaliza a resposta crua do SDK pro nosso tipo. */
function normalizar(p: PaymentResponse): PagamentoMP {
  return {
    id: String(p.id ?? ""),
    status: p.status ?? "unknown",
    statusDetail: p.status_detail ?? null,
    externalReference: p.external_reference ?? null,
    metodoId: p.payment_method_id ?? null,
    tipo: p.payment_type_id ?? null,
    valor: p.transaction_amount ?? null,
    metadata: (p.metadata as Record<string, unknown>) ?? {},
    pix: extrairPix(p),
  };
}

/**
 * Cria um pagamento no Mercado Pago (cartão OU PIX) a partir do formData do
 * Brick. `valor` é em CENTAVOS (padrão do resto do sistema); o MP cobra em R$,
 * então dividimos por 100 no `transaction_amount`.
 *
 * NUNCA logamos/persistimos dados de cartão — só o `token` do Brick transita, e
 * ele é de uso único (SAQ-A). `external_reference` = workspaceId e o metadata
 * (workspace_id/plano/ciclo) viajam junto pra o webhook/status reconciliarem.
 */
export async function criarPagamento(params: {
  workspaceId: string;
  plano: string;
  ciclo: string;
  /** valor em CENTAVOS. */
  valor: number;
  formDataDoBrick: FormDataBrick;
}): Promise<PagamentoMP> {
  const { workspaceId, plano, ciclo, valor, formDataDoBrick } = params;
  const ehPix = formDataDoBrick.payment_method_id === "pix";

  const body: Record<string, unknown> = {
    ...formDataDoBrick,
    transaction_amount: valor / 100,
    description: `GIGS CONTROL — ${plano} (${ciclo})`,
    external_reference: workspaceId,
    metadata: { workspace_id: workspaceId, plano, ciclo },
    statement_descriptor: "GIGSCONTROL",
  };
  // PIX expira em 30 min (evita QR eterno). Cartão não usa expiração.
  if (ehPix) {
    body.date_of_expiration = new Date(
      Date.now() + PIX_EXPIRA_MIN * 60_000
    ).toISOString();
  }

  const payment = new Payment(getMercadoPago());
  const p = await payment.create({
    // O SDK tipa o body de forma estrita; o formData do Brick é dinâmico.
    body: body as Parameters<Payment["create"]>[0]["body"],
    requestOptions: { idempotencyKey: randomUUID() },
  });
  return normalizar(p);
}

/** Consulta um pagamento pelo id (usado por webhook e polling de status). */
export async function buscarPagamento(id: string): Promise<PagamentoMP> {
  const payment = new Payment(getMercadoPago());
  const p = await payment.get({ id });
  return normalizar(p);
}

/**
 * Normaliza o payment_type_id do MP pro nosso enum `metodo`.
 * v1 só tem PIX + cartão, mas mapeamos os tipos conhecidos por robustez.
 */
export function normalizarMetodo(
  paymentTypeId: string | null | undefined
): string | null {
  switch (paymentTypeId) {
    case "bank_transfer":
      return "pix";
    case "credit_card":
      return "credit_card";
    case "debit_card":
      return "debit_card";
    case "ticket":
      return "boleto";
    default:
      return paymentTypeId ?? null;
  }
}

/**
 * Valida a assinatura `x-signature` do webhook do Mercado Pago (HMAC-SHA256).
 *
 * Gotcha documentado do sdk-nodejs: o manifest tem o formato EXATO
 *   `id:<data.id da QUERY, em minúsculo>;request-id:<x-request-id>;ts:<ts do x-signature>;`
 * e o HMAC (hex) é comparado ao componente `v1` do header `x-signature`
 * (formato `ts=...,v1=...`). O secret é MERCADO_PAGO_WEBHOOK_SECRET.
 *
 * @param headers headers da request (x-signature, x-request-id).
 * @param queryDataId `data.id` vindo da QUERY STRING da notificação.
 * @returns true se confere; false se falta secret/header ou não bate.
 */
export function validarAssinaturaWebhook(
  headers: Headers,
  queryDataId: string | null
): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const xSignature = headers.get("x-signature");
  const xRequestId = headers.get("x-request-id");
  if (!xSignature || !queryDataId) return false;

  // x-signature = "ts=<timestamp>,v1=<hash>"
  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of xSignature.split(",")) {
    const [chave, valor] = parte.split("=").map((s) => s.trim());
    if (chave === "ts") ts = valor;
    else if (chave === "v1") v1 = valor;
  }
  if (!ts || !v1) return false;

  // Manifest com formato exato (data.id em minúsculo). request-id opcional no
  // fio, mas incluímos o segmento sempre (vazio se ausente) pra bater o padrão.
  const manifest = `id:${queryDataId.toLowerCase()};request-id:${xRequestId ?? ""};ts:${ts};`;
  const esperado = createHmac("sha256", secret).update(manifest).digest("hex");

  // Comparação em tempo ~constante sem depender de tamanhos iguais no
  // timingSafeEqual (que lança se diferirem).
  if (esperado.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) {
    diff |= esperado.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}
