import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  construirEvento,
  getStripe,
  valorCobranca,
} from "@/lib/services/stripe.service";
import { registrarPagamentoEEstenderAcesso } from "@/lib/services/pagamentos.service";
import { PLANOS, type PlanoId, type CicloCobranca, type Moeda } from "@/lib/planos";

/**
 * POST /api/webhooks/stripe
 *
 * Recebe os eventos da Stripe no modelo PRÉ-PAGO por validade. Cada pagamento
 * ÚNICO aprovado ESTENDE a validade (acesso_ate) do workspace via a RPC central
 * `registrarPagamentoEEstenderAcesso` (idempotente por provider+payment id).
 *
 * Eventos tratados:
 *  - checkout.session.completed (mode=payment, paid): compra de plano estende a
 *    validade; compra de EXCEDENTE registra pagamento sem conceder dias.
 *  - invoice.paid / invoice.payment_succeeded (LEGADO): renovação de assinante
 *    antigo → estende +30/+365 (transição suave), providerPaymentId = invoice.id.
 *  - charge.dispute.created / radar.early_fraud_warning.created: suspende NA HORA.
 *  - invoice.payment_failed (LEGADO): 1 dia de graça pra assinante antigo.
 *
 * Garantias:
 *  - Verificação OBRIGATÓRIA da assinatura `stripe-signature`. Falha → 400.
 *  - Idempotência dupla: tabela `pagamento_eventos` (event.id único) barra o
 *    reprocessamento do MESMO evento; e a RPC (UNIQUE provider+payment id) barra
 *    a concessão de dias 2× mesmo que o evento chegue por caminhos distintos.
 *  - Sempre responde 200 pra eventos tratados/ignorados; 500 só em erro real
 *    (aí a Stripe reenvia; o registro de idempotência é removido no rollback).
 *
 * reaproveitado: mp_* guarda ids do Stripe (sem migration)
 *  - subscriptions.mp_payment_id     → Stripe customer id
 *  - pagamento_eventos.mp_payment_id → Stripe event id (idempotência)
 */

// Next/Edge poderia consumir o body; forçamos Node + dynamic pra ler o raw.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof criarClienteAdmin>;

/** Extrai o id (string) de um campo que pode vir expandido (objeto) ou só id. */
function idDe(
  campo: string | { id: string } | null | undefined
): string | null {
  if (!campo) return null;
  return typeof campo === "string" ? campo : campo.id;
}

/** true se o texto é um PlanoId conhecido (não confia em texto livre da Stripe). */
function planoValido(v: unknown): v is PlanoId {
  return typeof v === "string" && PLANOS.some((p) => p.id === v);
}

/**
 * Crédito de upgrade em DIAS vindo do metadata — tratado como ENTRADA NÃO
 * CONFIÁVEL: aceita só inteiro não-negativo, com teto de 1 ano corrido pra que
 * um metadata adulterado não conceda validade infinita. (O W6 recalcula a
 * origem do crédito; aqui a postura é sanear, nunca confiar no valor cru.)
 */
function creditoDiasSeguro(v: unknown): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 365);
}

/**
 * Estende a validade a partir de um pagamento de PLANO aprovado. Os dias saem
 * do CICLO (server-side via planos.ts), o valor é recalculado server-side —
 * nada de confiar no metadata cru além de identificar plano/ciclo. Best-effort
 * de salvar customer/valor/mirror do plano no workspace (não bloqueia a RPC).
 */
async function estenderPorPlano(
  admin: Admin,
  params: {
    workspaceId: string;
    providerPaymentId: string;
    plano: PlanoId;
    ciclo: CicloCobranca;
    moeda: Moeda;
    metodo?: string | null;
    customerId?: string | null;
    diasExtras?: number;
  }
) {
  const valorReais = valorCobranca(params.plano, params.ciclo, params.moeda);
  const res = await registrarPagamentoEEstenderAcesso({
    workspaceId: params.workspaceId,
    provider: "stripe",
    providerPaymentId: params.providerPaymentId,
    plano: params.plano,
    ciclo: params.ciclo,
    valor: Math.round(valorReais * 100), // centavos (coluna integer)
    moeda: params.moeda,
    metodo: params.metodo ?? "credit_card",
    diasExtras: params.diasExtras ?? 0,
  });

  // Reprocessamento do mesmo pagamento → a RPC já barrou. Não mexe em nada.
  if (res.jaProcessado) return;

  // Best-effort: a RPC não grava customer ref, valor cache nem espelha o
  // workspaces.plano. Faz aqui (falha silenciosa não impede a extensão).
  const patchSub: Record<string, unknown> = { valor: valorReais };
  if (params.customerId) patchSub.mp_payment_id = params.customerId;
  await admin
    .from("subscriptions")
    .update(patchSub)
    .eq("workspace_id", params.workspaceId);
  await admin
    .from("workspaces")
    .update({ plano: params.plano, ciclo: params.ciclo, status: "ativa" })
    .eq("id", params.workspaceId);
}

/**
 * Suspende o acesso do workspace NA HORA (chargeback / alerta de fraude).
 * Barra sempre via estadoAcessoDe (status suspended → bloqueado mesmo com
 * validade futura). Espelha no workspace.
 */
async function suspenderWorkspace(admin: Admin, workspaceId: string) {
  await admin
    .from("subscriptions")
    .update({ status: "suspended" })
    .eq("workspace_id", workspaceId);
  await admin
    .from("workspaces")
    .update({ status: "suspended" })
    .eq("id", workspaceId);
}

export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ erro: "Assinatura ausente." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = construirEvento(raw, sig);
  } catch (e) {
    // Assinatura inválida / secret errado → 400 (não reprocessa).
    return NextResponse.json(
      { erro: `Assinatura inválida: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();

  // Descobre o workspace cedo (quando dá) pra registrar no evento. Aceita tanto
  // `workspace_id` (novo, snake_case) quanto `workspaceId` (legado) no metadata.
  let workspaceIdEvento: string | null = null;
  const obj = event.data.object as unknown as Record<string, unknown>;
  const md = obj?.metadata as Record<string, unknown> | undefined;
  const mdWs = md?.workspace_id ?? md?.workspaceId;
  if (mdWs) workspaceIdEvento = String(mdWs);

  // Idempotência do EVENTO: registra antes de processar. event.id é único → se
  // já existe, o índice único barra e a gente sabe que já processou.
  const { error: errInsert } = await admin.from("pagamento_eventos").insert({
    workspace_id: workspaceIdEvento,
    provider: "stripe",
    tipo: event.type,
    // reaproveitado: mp_* guarda ids do Stripe (sem migration)
    mp_payment_id: event.id,
    status: event.type,
    raw: event as unknown as Record<string, unknown>,
  });
  if (errInsert) {
    if (errInsert.code === "23505") {
      // Já processado — responde 200 sem reprocessar.
      return NextResponse.json({ ok: true, jaProcessado: true });
    }
    // Falha real ao registrar → 500 pra Stripe reenviar.
    return NextResponse.json(
      { erro: errInsert.message ?? "Falha ao registrar evento." },
      { status: 500 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Modelo pré-pago: só nos interessa o pagamento ÚNICO aprovado.
        if (session.mode !== "payment") break; // sessão não-payment — ignora
        if (session.payment_status !== "paid") break; // ainda não pago

        const meta = (session.metadata ?? {}) as Record<string, string>;
        const workspaceId =
          meta.workspace_id ??
          (meta.workspaceId as string | undefined) ??
          session.client_reference_id ??
          null;
        if (!workspaceId) break;

        const paymentIntentId = idDe(session.payment_intent);
        // Fallback: o id do PI é a chave de idempotência ideal; sem ele, cai no
        // id da própria sessão (também estável e único por compra).
        const providerPaymentId = paymentIntentId ?? session.id;
        const customerId = idDe(session.customer);

        // EXCEDENTE (contrato avulso): registra o pagamento SEM conceder dias e
        // sem mexer no plano/status/validade da assinatura. status
        // 'excedente_disponivel' = crédito de 1 contrato pronto pra consumir.
        if (meta.excedente === "true") {
          const moedaExc = (session.currency === "usd" ? "usd" : "brl") as Moeda;
          const { error } = await admin.from("pagamentos").insert({
            workspace_id: workspaceId,
            provider: "stripe",
            provider_payment_id: providerPaymentId,
            plano: null,
            ciclo: null,
            valor: session.amount_total ?? null, // já em centavos (Stripe)
            moeda: moedaExc,
            metodo: "credit_card",
            dias_concedidos: 0,
            status: "excedente_disponivel",
          });
          // Reentrega do mesmo pagamento → UNIQUE(provider, payment id) barra
          // (23505). Qualquer outro erro sobe pro catch (500 → Stripe reenvia).
          if (error && error.code !== "23505") throw error;
          break;
        }

        // COMPRA DE PLANO: plano/ciclo vêm do metadata (validados server-side);
        // dias derivam do ciclo e valor é recalculado — metadata cru não decide
        // quanto de acesso é concedido.
        if (!planoValido(meta.plano)) break;
        const ciclo: CicloCobranca = meta.ciclo === "anual" ? "anual" : "mensal";
        const moeda: Moeda = (session.currency === "usd" ? "usd" : "brl") as Moeda;
        const diasExtras = creditoDiasSeguro(meta.credito_dias);

        await estenderPorPlano(admin, {
          workspaceId,
          providerPaymentId,
          plano: meta.plano,
          ciclo,
          moeda,
          metodo: "credit_card",
          customerId,
          diasExtras,
        });
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // LEGADO (transição suave): renovação de assinante recorrente antigo.
        // Converte em extensão de validade +30/+365. providerPaymentId =
        // invoice.id (idempotente); ciclo derivado do preço recorrente.
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.id) break;
        const info = infoDoInvoiceLegado(invoice);
        if (!info.workspaceId || !info.plano) break;
        await estenderPorPlano(admin, {
          workspaceId: info.workspaceId,
          providerPaymentId: invoice.id,
          plano: info.plano,
          ciclo: info.ciclo,
          moeda: info.moeda,
          metodo: "credit_card",
          customerId: idDe(invoice.customer),
        });
        break;
      }

      case "invoice.payment_failed": {
        // LEGADO: renovação de assinante antigo falhou. Com o modelo pré-pago o
        // acesso já expira sozinho pela validade — aqui só marcamos suspenso se
        // já não houver validade em dia (não encurtamos nada à força). Mantido
        // como no-op seguro: a expiração natural (acesso_ate) faz o corte.
        break;
      }

      case "charge.dispute.created":
      case "radar.early_fraud_warning.created": {
        // Chargeback (disputa no cartão) ou alerta de fraude → suspende o
        // acesso NA HORA. Acha o workspace pelo customer da cobrança
        // (guardado em subscriptions.mp_payment_id).
        const alvo = event.data.object as unknown as {
          charge?: string | { id: string } | null;
        };
        const chargeId = idDe(alvo.charge ?? null);
        if (!chargeId) break;
        const charge = await getStripe().charges.retrieve(chargeId);
        const customerId = idDe(charge.customer);
        if (!customerId) break;

        const { data: row } = await admin
          .from("subscriptions")
          .select("workspace_id")
          .eq("mp_payment_id", customerId)
          .maybeSingle<{ workspace_id: string | null }>();
        if (row?.workspace_id) {
          console.warn(
            `[webhook stripe] ${event.type} charge=${chargeId} ws=${row.workspace_id} — suspendendo por disputa/fraude.`
          );
          await suspenderWorkspace(admin, row.workspace_id);
        }
        break;
      }

      default:
        // Evento que não tratamos — ok, já está registrado.
        break;
    }

    return NextResponse.json({ ok: true, tipo: event.type });
  } catch (e) {
    // O processamento falhou DEPOIS do registro de idempotência. Remove o
    // registro pra que o retry da Stripe REPROCESSE — senão o índice único
    // barraria o reenvio e a extensão (cliente já pagou) se perderia.
    await admin
      .from("pagamento_eventos")
      .delete()
      .eq("provider", "stripe")
      .eq("mp_payment_id", event.id);
    // Erro real (rede/Stripe/DB) → 500 pra a Stripe reenviar.
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha no webhook." },
      { status: 500 }
    );
  }
}

/**
 * Extrai {workspaceId, plano, ciclo, moeda} de um invoice LEGADO de assinatura
 * recorrente. workspace/plano saem do metadata (do invoice ou da linha);
 * moeda do invoice; ciclo derivado do TAMANHO do período faturado da linha
 * (o SDK v22 não expõe recurring.interval no line item — um período > ~32 dias
 * é anual). É melhor-esforço de transição: o que importa é estender a validade.
 */
function infoDoInvoiceLegado(invoice: Stripe.Invoice): {
  workspaceId: string | null;
  plano: PlanoId | null;
  ciclo: CicloCobranca;
  moeda: Moeda;
} {
  const line = invoice.lines?.data?.[0];
  const md = (invoice.metadata ?? {}) as Record<string, string>;
  const lineMd = (line?.metadata ?? {}) as Record<string, string>;
  const workspaceId =
    md.workspace_id ?? md.workspaceId ?? lineMd.workspace_id ?? lineMd.workspaceId ?? null;

  const planoRaw = md.plano ?? lineMd.plano ?? null;
  const plano = planoValido(planoRaw) ? planoRaw : null;

  // Ciclo pelo tamanho do período faturado (start→end). > 32 dias = anual.
  const inicio = line?.period?.start ?? null;
  const fim = line?.period?.end ?? null;
  let ciclo: CicloCobranca = "mensal";
  if (typeof inicio === "number" && typeof fim === "number" && fim > inicio) {
    const dias = (fim - inicio) / 86_400;
    ciclo = dias > 32 ? "anual" : "mensal";
  } else if (lineMd.ciclo === "anual" || md.ciclo === "anual") {
    ciclo = "anual";
  }

  const moeda: Moeda = invoice.currency === "usd" ? "usd" : "brl";
  return { workspaceId, plano, ciclo, moeda };
}

// Stripe pode fazer um GET de saúde no endpoint — responde 200.
export async function GET() {
  return NextResponse.json({ ok: true });
}
