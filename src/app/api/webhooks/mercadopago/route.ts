import { NextResponse } from "next/server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  buscarPagamento,
  mpWebhookSecret,
  normalizarMetodo,
  validarAssinaturaWebhook,
} from "@/lib/services/mercadopago.service";
import {
  registrarPagamentoEEstenderAcesso,
  suspenderWorkspace,
} from "@/lib/services/pagamentos.service";

/**
 * POST /api/webhooks/mercadopago
 *
 * Recebe as notificações do Mercado Pago. O payload NÃO traz o status do
 * pagamento — só o id — então SEMPRE consultamos `GET /v1/payments/{id}` pra
 * saber o status real. Só `approved` estende a validade (via a RPC central,
 * idempotente).
 *
 * Garantias (espelham o webhook Stripe):
 *  - Assinatura `x-signature` validada (HMAC-SHA256). Inválida → 401. Só
 *    pulamos a validação se o secret NÃO está setado E não é produção (dev
 *    local sem secret); em produção sem secret = 401.
 *  - Idempotência via `pagamento_eventos` (índice único em mp_payment_id):
 *    registra-ANTES-processa; se o processamento falhar, o registro é removido
 *    pra o MP reenviar. O mesmo pagamento nunca estende 2× (e a RPC ainda
 *    deduplica por baixo).
 *  - Responde 200 rápido nos casos não-erro (inclusive tipos ignorados).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lê data.id + type de query OU body (o MP manda de formas diferentes). */
function extrairNotificacao(
  url: URL,
  body: unknown
): { type: string | null; dataId: string | null } {
  const q = url.searchParams;
  const b = (body ?? {}) as Record<string, unknown>;
  const bData = (b.data ?? {}) as Record<string, unknown>;

  const type =
    q.get("type") ??
    q.get("topic") ??
    (typeof b.type === "string" ? b.type : null) ??
    (typeof b.topic === "string" ? b.topic : null);

  const dataId =
    q.get("data.id") ??
    q.get("id") ??
    (bData.id != null ? String(bData.id) : null) ??
    (b.id != null ? String(b.id) : null);

  return { type, dataId };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const raw = await request.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }

  const { type, dataId } = extrairNotificacao(url, body);

  // Validação de assinatura. O manifest usa o data.id da QUERY (padrão MP).
  const queryDataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const temSecret = !!mpWebhookSecret();
  const ehProd = process.env.NODE_ENV === "production";
  if (temSecret || ehProd) {
    // Em prod sem secret → não dá pra validar → 401 (fecha o furo).
    if (!validarAssinaturaWebhook(request.headers, queryDataId)) {
      return NextResponse.json(
        { erro: "Assinatura inválida." },
        { status: 401 }
      );
    }
  }

  // Só notificações de pagamento nos interessam.
  if (type !== "payment") {
    return NextResponse.json({ ok: true, ignorado: type });
  }
  if (!dataId) {
    return NextResponse.json({ ok: true, semId: true });
  }

  const admin = criarClienteAdmin();

  // Idempotência: registra o evento ANTES de processar. mp_payment_id é único →
  // reenvio do mesmo pagamento colide (23505) e a gente sabe que já tratou.
  const { error: errInsert } = await admin.from("pagamento_eventos").insert({
    provider: "mercadopago",
    tipo: type,
    mp_payment_id: dataId,
    status: "received",
    raw: (body ?? {}) as Record<string, unknown>,
  });
  if (errInsert) {
    if (errInsert.code === "23505") {
      // O MP manda VÁRIAS notificações pro MESMO payment id (payment.created
      // pending do PIX, depois payment.updated approved). Um registro anterior
      // ainda NÃO-approved não pode barrar a notificação da aprovação — senão
      // um PIX pago com o browser fechado (sem polling) nunca estenderia a
      // validade. Reprocessar é seguro: a RPC deduplica a extensão por baixo.
      const { data: anterior } = await admin
        .from("pagamento_eventos")
        .select("status")
        .eq("provider", "mercadopago")
        .eq("mp_payment_id", dataId)
        .maybeSingle<{ status: string | null }>();
      if (anterior?.status === "approved") {
        return NextResponse.json({ ok: true, jaProcessado: true });
      }
      // Segue pro processamento (sem novo insert; o update final anexa o status).
    } else {
      return NextResponse.json(
        { erro: errInsert.message ?? "Falha ao registrar evento." },
        { status: 500 }
      );
    }
  }

  try {
    // O payload não traz status — SEMPRE consulta o pagamento real.
    const pag = await buscarPagamento(dataId);

    if (pag.status === "approved" && pag.externalReference) {
      const md = pag.metadata as { plano?: string; ciclo?: string; excedente?: unknown };
      const ehExcedente = md.excedente === true || md.excedente === "true";

      if (ehExcedente) {
        // EXCEDENTE (contrato avulso): registra o pagamento SEM conceder dias e
        // sem tocar plano/validade — status 'excedente_disponivel' = crédito de
        // 1 contrato pronto pra o POST de /api/contratos consumir. Espelha o
        // webhook Stripe. UNIQUE(provider, payment id) barra reentrega (23505).
        const { error } = await admin.from("pagamentos").insert({
          workspace_id: pag.externalReference,
          provider: "mercadopago",
          provider_payment_id: String(pag.id),
          plano: null,
          ciclo: null,
          valor: pag.valor != null ? Math.round(pag.valor * 100) : null,
          moeda: "brl",
          metodo: normalizarMetodo(pag.tipo),
          dias_concedidos: 0,
          status: "excedente_disponivel",
        });
        if (error && error.code !== "23505") throw error;
      } else {
        // O espelho de workspaces.plano acontece DENTRO do service (comum aos
        // 3 caminhos — síncrono, webhook, polling — e a todos os gateways), com
        // validação de plano conhecido. Fix auditoria 27/08/2026, achado M1:
        // antes o espelho só rodava aqui e só quando o webhook processava
        // primeiro — como o síncrono/polling quase sempre vence, era pulado.
        await registrarPagamentoEEstenderAcesso({
          workspaceId: pag.externalReference,
          provider: "mercadopago",
          providerPaymentId: String(pag.id),
          plano: md.plano ?? null,
          ciclo: md.ciclo ?? null,
          valor: pag.valor != null ? Math.round(pag.valor * 100) : null,
          moeda: "brl",
          metodo: normalizarMetodo(pag.tipo),
        });
      }
    } else if (
      (pag.status === "refunded" || pag.status === "charged_back") &&
      pag.externalReference
    ) {
      // Reembolso/chargeback no MP (fix auditoria 27/08/2026, achado A2 —
      // antes esses status eram só logados e o cliente mantinha o acesso até o
      // fim da validade). Espelha o comportamento do Stripe: marca o ledger e
      // suspende o workspace na hora. `cancelled` NÃO suspende — é o status de
      // pagamento que nunca foi aprovado (ex.: PIX expirado sem pagar).
      await admin
        .from("pagamentos")
        .update({ status: "reembolsado" })
        .eq("provider", "mercadopago")
        .eq("provider_payment_id", String(pag.id));
      console.warn(
        `[webhook mp] payment=${pag.id} status=${pag.status} ws=${pag.externalReference} — suspendendo por reembolso/chargeback.`
      );
      await suspenderWorkspace(pag.externalReference);
    }

    // Anexa o workspace + status ao evento registrado (auditoria).
    await admin
      .from("pagamento_eventos")
      .update({ workspace_id: pag.externalReference, status: pag.status })
      .eq("provider", "mercadopago")
      .eq("mp_payment_id", dataId);

    return NextResponse.json({ ok: true, status: pag.status });
  } catch (e) {
    // Falhou DEPOIS de registrar → remove o registro pra o MP reenviar (senão o
    // índice único barraria o reenvio e a aprovação se perderia).
    await admin
      .from("pagamento_eventos")
      .delete()
      .eq("provider", "mercadopago")
      .eq("mp_payment_id", dataId);
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha no webhook." },
      { status: 500 }
    );
  }
}

// Health check (o MP pode fazer um GET no endpoint).
export async function GET() {
  return NextResponse.json({ ok: true });
}
