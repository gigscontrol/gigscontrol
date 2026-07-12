import { randomUUID } from "node:crypto";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * Service central do modelo PRÉ-PAGO por validade.
 *
 * TUDO que estende o acesso (Stripe intl, Mercado Pago BR, cortesia) passa por
 * aqui e chama a RPC `registrar_pagamento_estender` (migração 84), que é
 * IDEMPOTENTE por (provider, provider_payment_id): reprocessar o mesmo webhook
 * nunca concede dias 2x. A validade soma DIAS CORRIDOS a partir do maior entre
 * (acesso_ate atual, agora) — nunca encurta.
 *
 * Regra de dias por ciclo: mensal = 30, anual = 365 (dias corridos, NÃO
 * setMonth — evita meses de tamanho variável). `diasExtras` soma crédito de
 * upgrade (upgrade = crédito em DIAS).
 */

export type ProviderPagamento = "stripe" | "mercadopago" | "cortesia" | "cupom";

/** Resultado da RPC de extensão. `jaProcessado` = webhook repetido (no-op). */
export type ResultadoExtensao =
  | { jaProcessado: true }
  | { jaProcessado: false; acessoAte: string };

/** Converte o ciclo em dias corridos base (mensal=30, anual=365). */
export function diasDoCiclo(ciclo: string | null | undefined): number {
  return ciclo === "anual" ? 365 : 30;
}

/**
 * Registra um pagamento e ESTENDE a validade do workspace (idempotente).
 *
 * @param diasExtras crédito adicional em dias (ex: sobra de upgrade). Somado
 *   aos dias do ciclo.
 */
export async function registrarPagamentoEEstenderAcesso(params: {
  workspaceId: string;
  provider: ProviderPagamento;
  providerPaymentId: string;
  plano?: string | null;
  ciclo?: string | null;
  valor?: number | null;
  moeda?: string | null;
  metodo?: string | null;
  diasExtras?: number;
}): Promise<ResultadoExtensao> {
  const {
    workspaceId,
    provider,
    providerPaymentId,
    plano = null,
    ciclo = null,
    valor = null,
    moeda = null,
    metodo = null,
    diasExtras = 0,
  } = params;

  const dias = diasDoCiclo(ciclo) + (diasExtras || 0);

  const admin = criarClienteAdmin();
  const { data, error } = await admin.rpc("registrar_pagamento_estender", {
    p_workspace_id: workspaceId,
    p_provider: provider,
    p_provider_payment_id: providerPaymentId,
    p_plano: plano,
    p_ciclo: ciclo,
    p_valor: valor,
    p_moeda: moeda,
    p_metodo: metodo,
    p_dias: dias,
  });
  if (error) throw error;

  const res = data as { ja_processado: boolean; acesso_ate?: string };
  if (res.ja_processado) return { jaProcessado: true };
  return { jaProcessado: false, acessoAte: res.acesso_ate as string };
}

/**
 * Concede DIAS de acesso como cortesia (sem pagamento real). Usa provider
 * 'cortesia' com um providerPaymentId único, então cada concessão é uma
 * extensão nova (não colide idempotência com pagamentos reais).
 *
 * @param motivo registrado só como parte do id de cortesia (auditoria leve).
 */
export async function concederDiasCortesia(
  workspaceId: string,
  dias: number,
  motivo: string
): Promise<ResultadoExtensao> {
  const admin = criarClienteAdmin();
  const providerPaymentId = `cortesia_${randomUUID()}`;
  const { data, error } = await admin.rpc("registrar_pagamento_estender", {
    p_workspace_id: workspaceId,
    p_provider: "cortesia",
    p_provider_payment_id: providerPaymentId,
    p_plano: null,
    p_ciclo: motivo,
    p_valor: null,
    p_moeda: null,
    p_metodo: null,
    p_dias: dias,
  });
  if (error) throw error;

  const res = data as { ja_processado: boolean; acesso_ate?: string };
  if (res.ja_processado) return { jaProcessado: true };
  return { jaProcessado: false, acessoAte: res.acesso_ate as string };
}
