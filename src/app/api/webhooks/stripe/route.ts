import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  construirEvento,
  getStripe,
  parseLookupKey,
  valorCobranca,
} from "@/lib/services/stripe.service";
import type { PlanoId, CicloCobranca, Moeda } from "@/lib/planos";

/**
 * POST /api/webhooks/stripe
 *
 * Recebe os eventos da Stripe (assinaturas). Ativa/renova/suspende/cancela
 * a assinatura do workspace correspondente.
 *
 * Garantias:
 *  - Verificação OBRIGATÓRIA da assinatura `stripe-signature` via
 *    `construirEvento` (constructEvent). Falha → 400.
 *  - Idempotência via tabela `pagamento_eventos` (índice único em
 *    mp_payment_id, onde guardamos o `event.id` da Stripe) — o mesmo
 *    evento nunca é processado 2x.
 *  - Sempre responde 200 pra eventos tratados/ignorados; 500 só em erro
 *    real de processamento (aí a Stripe reenvia).
 *
 * O workspace é encontrado primariamente via `metadata.workspaceId`
 * (setado na subscription no checkout). Quando o evento não carrega a
 * subscription, ela é recuperada (`subscriptions.retrieve`).
 *
 * reaproveitado: mp_* guarda ids do Stripe (sem migration)
 *  - subscriptions.mp_preference_id  → Stripe subscription id
 *  - subscriptions.mp_payment_id     → Stripe customer id
 *  - pagamento_eventos.mp_payment_id → Stripe event id (idempotência)
 */

// Next/Edge poderia consumir o body; forçamos Node + dynamic pra ler o raw.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubResumo = {
  subscriptionId: string;
  customerId: string | null;
  workspaceId: string | null;
  status: string;
  /** unix seconds do fim do período atual (renovação) ou null. */
  periodEnd: number | null;
  /** Plano/ciclo/moeda derivados do preço REAL da assinatura (lookup_key). */
  plano?: PlanoId | null;
  ciclo?: CicloCobranca | null;
  moeda?: Moeda | null;
};

/** Extrai o id (string) de um campo que pode vir expandido (objeto) ou só id. */
function idDe(
  campo: string | { id: string } | null | undefined
): string | null {
  if (!campo) return null;
  return typeof campo === "string" ? campo : campo.id;
}

/** current_period_end agora vive nos items da subscription (Stripe v22+). */
function periodEndDaSub(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  return item?.current_period_end ?? null;
}

/**
 * Deriva {plano, ciclo, moeda} do `lookup_key` do preço que a assinatura
 * está REALMENTE cobrando (fonte da verdade da Stripe). null se não bater.
 */
function planoInfoDaSub(
  sub: Stripe.Subscription
): { plano: PlanoId; ciclo: CicloCobranca; moeda: Moeda } | null {
  const price = sub.items?.data?.[0]?.price;
  return parseLookupKey(price?.lookup_key ?? null);
}

/** Converte unix seconds → 'YYYY-MM-DD' (coluna date). */
function dataDe(unixSeconds: number | null): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Recupera a subscription e devolve o resumo que usamos pra atualizar o DB. */
async function resumoDaSubscription(
  subscriptionId: string
): Promise<SubResumo> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const info = planoInfoDaSub(sub);
  return {
    subscriptionId: sub.id,
    customerId: idDe(sub.customer),
    workspaceId: (sub.metadata?.workspaceId as string) ?? null,
    status: sub.status,
    periodEnd: periodEndDaSub(sub),
    plano: info?.plano ?? null,
    ciclo: info?.ciclo ?? null,
    moeda: info?.moeda ?? null,
  };
}

/** Mapeia o status da Stripe pro nosso enum de subscriptions. */
function mapStatus(stripeStatus: string): "ativa" | "suspended" | "cancelled" {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "ativa";
  if (stripeStatus === "canceled") return "cancelled";
  // past_due | unpaid | incomplete | incomplete_expired | paused
  return "suspended";
}

type Admin = ReturnType<typeof criarClienteAdmin>;

/** Atualiza a subscription do workspace (e opcionalmente o workspace). */
async function aplicarStatus(
  admin: Admin,
  r: SubResumo,
  statusInterno: "ativa" | "suspended" | "cancelled",
  opts: { espelharNoWorkspace?: boolean; preservarGraca?: boolean } = {}
) {
  if (!r.workspaceId) return;
  const proxima = dataDe(r.periodEnd);

  const patch: Record<string, unknown> = {
    status: statusInterno,
    provider: "stripe",
  };
  // reaproveitado: mp_* guarda ids do Stripe (sem migration)
  if (r.subscriptionId) patch.mp_preference_id = r.subscriptionId;
  if (r.customerId) patch.mp_payment_id = r.customerId;
  if (proxima) patch.proxima_cobranca = proxima;
  if (statusInterno === "ativa") {
    patch.trial_termina_em = null;
    patch.metodo = "credit_card";
  }

  // RECONCILIAÇÃO DE PLANO: alinha plano/ciclo/valor ao preço que a Stripe está
  // REALMENTE cobrando. Só quando ATIVA (checkout/renovação paga) — nunca em
  // graça/suspenso, pra não rebaixar antes da cobrança. É o que fecha o furo do
  // downgrade: ao renovar no preço menor, o plano cai no MESMO instante da
  // cobrança menor (nem antes — mantém benefícios até o fim do período pago —
  // nem depois — não dá pra pagar menos e manter o plano top).
  const reconciliaPlano = statusInterno === "ativa" && !!r.plano && !!r.ciclo;
  if (reconciliaPlano && r.plano && r.ciclo) {
    patch.plano = r.plano;
    patch.ciclo = r.ciclo;
    patch.valor = valorCobranca(r.plano, r.ciclo, r.moeda ?? "brl");
  }

  let q = admin
    .from("subscriptions")
    .update(patch)
    .eq("workspace_id", r.workspaceId);
  // Dunning (past_due/unpaid/paused via subscription.updated) NÃO atropela a
  // graça de 1 dia: quem está em 'graca' fica até o prazo expirar (o bloqueio
  // vem da derivação de estado). Chargeback/fraude NÃO passam preservarGraca,
  // então cortam na hora.
  if (statusInterno === "suspended" && opts.preservarGraca) {
    q = q.neq("status", "graca");
  }
  await q;

  // Se o plano reconciliado é o MESMO que estava agendado como downgrade, o
  // downgrade VIROU (renovou no preço menor) → limpa o registro pendente pra o
  // aviso sumir e liberar novo agendamento. O `.eq("downgrade_para", r.plano)`
  // garante que só limpa quando o alvo chegou (não ao renovar ainda no plano de
  // cima). Se a coluna não existir (pré-migration 46), o erro volta silencioso.
  if (reconciliaPlano && r.plano) {
    await admin
      .from("subscriptions")
      .update({ downgrade_para: null, downgrade_efetivo_em: null })
      .eq("workspace_id", r.workspaceId)
      .eq("downgrade_para", r.plano);
  }

  // workspaces.plano é a fonte da verdade dos limites → tem que refletir o
  // plano reconciliado (independente de espelhar o status).
  if (opts.espelharNoWorkspace || reconciliaPlano) {
    const wsPatch: Record<string, unknown> = {};
    if (opts.espelharNoWorkspace) wsPatch.status = statusInterno;
    if (reconciliaPlano && r.plano && r.ciclo) {
      wsPatch.plano = r.plano;
      wsPatch.ciclo = r.ciclo;
    }
    await admin.from("workspaces").update(wsPatch).eq("id", r.workspaceId);
  }
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

  // Descobre o workspace cedo (quando dá) pra registrar no evento.
  // Só pra eventos que carregam metadata diretamente; senão fica null e a
  // gente resolve dentro do handler via retrieve.
  let workspaceIdEvento: string | null = null;
  const obj = event.data.object as unknown as Record<string, unknown>;
  const md = obj?.metadata as Record<string, unknown> | undefined;
  if (md?.workspaceId) workspaceIdEvento = String(md.workspaceId);

  // Idempotência: registra o evento. event.id é único → se já existe, o
  // índice único barra e a gente sabe que já processou.
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
        const subscriptionId = idDe(session.subscription);
        if (!subscriptionId) break; // sessão não-assinatura — ignora
        const resumo = await resumoDaSubscription(subscriptionId);
        // Fallbacks: a session também carrega customer + workspaceId.
        if (!resumo.customerId) resumo.customerId = idDe(session.customer);
        if (!resumo.workspaceId) {
          resumo.workspaceId =
            (session.metadata?.workspaceId as string) ??
            session.client_reference_id ??
            null;
        }
        await aplicarStatus(admin, resumo, "ativa", {
          espelharNoWorkspace: true,
        });
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        // Renovação: pega a subscription a partir do invoice e ativa.
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdDoInvoice(invoice);
        if (!subscriptionId) break; // invoice avulso (sem assinatura)
        const resumo = await resumoDaSubscription(subscriptionId);
        if (!resumo.customerId) resumo.customerId = idDe(invoice.customer);
        // period_end do invoice é um bom fallback pra proxima_cobranca.
        if (!resumo.periodEnd && typeof invoice.period_end === "number") {
          resumo.periodEnd = invoice.period_end;
        }
        await aplicarStatus(admin, resumo, "ativa", {
          espelharNoWorkspace: true,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdDoInvoice(invoice);
        if (!subscriptionId) break;
        const resumo = await resumoDaSubscription(subscriptionId);
        if (!resumo.workspaceId) break;
        // Renovação falhou → 1 dia de GRAÇA (acesso + aviso) antes de bloquear.
        // Set-once: só transiciona de ATIVA → graça. As retentativas do Stripe
        // disparam payment_failed de novo, mas aí já está "graca" e o prazo é
        // preservado. Uma retentativa que der certo → invoice.paid → "ativa".
        const gracaAte = new Date(Date.now() + 86_400_000).toISOString();
        console.warn(
          `[webhook stripe] invoice.payment_failed sub=${subscriptionId} ws=${resumo.workspaceId} — graça até ${gracaAte}.`
        );
        await admin
          .from("subscriptions")
          .update({ status: "graca", trial_termina_em: gracaAte })
          .eq("workspace_id", resumo.workspaceId)
          .eq("status", "ativa");
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const info = planoInfoDaSub(sub);
        const resumo: SubResumo = {
          subscriptionId: sub.id,
          customerId: idDe(sub.customer),
          workspaceId: (sub.metadata?.workspaceId as string) ?? null,
          status: sub.status,
          periodEnd: periodEndDaSub(sub),
          plano: info?.plano ?? null,
          ciclo: info?.ciclo ?? null,
          moeda: info?.moeda ?? null,
        };
        await aplicarStatus(admin, resumo, "cancelled", {
          espelharNoWorkspace: true,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.status === "past_due") {
          // Stripe em dunning (retentando) → a graça é dona do
          // invoice.payment_failed. Não atropela o prazo aqui.
          break;
        }
        const info = planoInfoDaSub(sub);
        const resumo: SubResumo = {
          subscriptionId: sub.id,
          customerId: idDe(sub.customer),
          workspaceId: (sub.metadata?.workspaceId as string) ?? null,
          status: sub.status,
          periodEnd: periodEndDaSub(sub),
          plano: info?.plano ?? null,
          ciclo: info?.ciclo ?? null,
          moeda: info?.moeda ?? null,
        };
        const interno = mapStatus(sub.status);
        // Espelha cancelamento no workspace; ativa/suspende ficam só na sub
        // (mas a reconciliação de plano dentro de aplicarStatus ainda roda p/ ativa).
        await aplicarStatus(admin, resumo, interno, {
          espelharNoWorkspace: interno === "cancelled",
          preservarGraca: true,
        });
        break;
      }

      case "charge.dispute.created":
      case "radar.early_fraud_warning.created": {
        // Chargeback (disputa no cartão) ou alerta de fraude → suspende o
        // acesso NA HORA, pra cortar uso de má fé. Acha o workspace pelo
        // customer da cobrança (guardado em subscriptions.mp_payment_id).
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
          .select("workspace_id, mp_preference_id")
          .eq("mp_payment_id", customerId)
          .maybeSingle<{
            workspace_id: string | null;
            mp_preference_id: string | null;
          }>();
        if (row?.workspace_id) {
          console.warn(
            `[webhook stripe] ${event.type} charge=${chargeId} ws=${row.workspace_id} — suspendendo por disputa/fraude.`
          );
          await aplicarStatus(
            admin,
            {
              subscriptionId: row.mp_preference_id ?? "",
              customerId,
              workspaceId: row.workspace_id,
              status: "disputed",
              periodEnd: null,
            },
            "suspended",
            { espelharNoWorkspace: true }
          );
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
    // barraria o reenvio e a ativação (cliente já pagou) se perderia.
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
 * Extrai o id da subscription de um invoice. Em versões recentes da API a
 * subscription mora em `invoice.parent.subscription_details.subscription`.
 */
function subscriptionIdDoInvoice(invoice: Stripe.Invoice): string | null {
  const det = invoice.parent?.subscription_details;
  if (det?.subscription) return idDe(det.subscription);
  // Fallback defensivo p/ payloads/versões que ainda exponham no topo.
  const legado = (invoice as unknown as { subscription?: string | { id: string } })
    .subscription;
  return idDe(legado ?? null);
}

// Stripe pode fazer um GET de saúde no endpoint — responde 200.
export async function GET() {
  return NextResponse.json({ ok: true });
}
