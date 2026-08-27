import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  validarAssinaturaWebhook,
  mpWebhookSecret,
} from "./mercadopago.service";

/**
 * Assinatura x-signature do webhook do Mercado Pago (HMAC-SHA256 sobre o
 * manifest `id:<data.id minúsculo>;request-id:<x-request-id>;ts:<ts>;`).
 * Este handler já quebrou uma vez em produção (branch
 * fix/webhook-assinatura-nao-fatal) — por isso está aqui primeiro.
 */

const SECRET = "segredo-de-teste-nao-e-real";

function headersAssinados(dataId: string, requestId = "req-1", ts = "1700000000") {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
  return new Headers({
    "x-signature": `ts=${ts},v1=${v1}`,
    "x-request-id": requestId,
  });
}

const envAntes: Record<string, string | undefined> = {};

beforeEach(() => {
  envAntes.novo = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  envAntes.legado = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = SECRET;
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
});

afterEach(() => {
  if (envAntes.novo === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  else process.env.MERCADO_PAGO_WEBHOOK_SECRET = envAntes.novo;
  if (envAntes.legado === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  else process.env.MERCADOPAGO_WEBHOOK_SECRET = envAntes.legado;
});

describe("validarAssinaturaWebhook", () => {
  it("aceita assinatura correta", () => {
    expect(validarAssinaturaWebhook(headersAssinados("12345"), "12345")).toBe(true);
  });

  it("data.id em MAIÚSCULO no manifest vira minúsculo (gotcha do SDK)", () => {
    expect(validarAssinaturaWebhook(headersAssinados("ABC99"), "ABC99")).toBe(true);
  });

  it("rejeita HMAC adulterado", () => {
    const h = headersAssinados("12345");
    const sig = h.get("x-signature")!;
    h.set("x-signature", sig.slice(0, -4) + "beef");
    expect(validarAssinaturaWebhook(h, "12345")).toBe(false);
  });

  it("rejeita quando o data.id da query difere do assinado (replay noutro pagamento)", () => {
    expect(validarAssinaturaWebhook(headersAssinados("12345"), "99999")).toBe(false);
  });

  it("rejeita sem header x-signature ou sem data.id", () => {
    expect(validarAssinaturaWebhook(new Headers(), "12345")).toBe(false);
    expect(validarAssinaturaWebhook(headersAssinados("12345"), null)).toBe(false);
  });

  it("fail-closed: sem secret configurado devolve false", () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    expect(validarAssinaturaWebhook(headersAssinados("12345"), "12345")).toBe(false);
  });

  it("alias legado MERCADOPAGO_WEBHOOK_SECRET também funciona (fix do MP em produção)", () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
    expect(mpWebhookSecret()).toBe(SECRET);
    expect(validarAssinaturaWebhook(headersAssinados("777"), "777")).toBe(true);
  });
});
