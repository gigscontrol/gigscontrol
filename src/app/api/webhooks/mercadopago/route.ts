import { NextResponse } from "next/server";
import crypto from "crypto";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { buscarPagamento, normalizarMetodo } from "@/lib/services/mercadopago.service";

/**
 * POST /api/webhooks/mercadopago
 *
 * Recebe as notificações do Mercado Pago. Quando um pagamento aprova,
 * ativa a assinatura do workspace correspondente (via external_reference).
 *
 * Garantias:
 *  - Verificação de assinatura (x-signature) quando MERCADOPAGO_WEBHOOK_SECRET
 *    está setado. Em dev (sem secret), pula a verificação.
 *  - Idempotência via tabela `pagamento_eventos` (índice único em
 *    mp_payment_id) — o mesmo pagamento nunca ativa a conta 2x.
 *  - Sempre responde 200 pra eventos que não são de pagamento aprovado,
 *    pra o MP não ficar reenviando.
 */

// MP manda notificações via query (?type=payment&data.id=...) e/ou body.
type MPBody = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

/** Verifica a assinatura x-signature do Mercado Pago (HMAC-SHA256). */
function assinaturaValida(
  req: Request,
  dataId: string,
  secret: string
): boolean {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  // x-signature = "ts=TIMESTAMP,v1=HASH"
  const partes = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  // Manifest no formato exigido pelo MP. data.id alfanumérico vai em minúsculas.
  const idNorm = /[a-zA-Z]/.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${idNorm};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const queryType = url.searchParams.get("type") ?? url.searchParams.get("topic");
  const queryDataId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id");

  let body: MPBody = {};
  try {
    body = (await request.json()) as MPBody;
  } catch {
    // Algumas notificações vêm sem body (só query) — segue.
  }

  const tipo = body.type ?? queryType ?? "";
  const paymentId = String(body.data?.id ?? queryDataId ?? "");

  // Só nos interessa evento de pagamento com id.
  if (tipo !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Verificação de assinatura (quando o secret está configurado).
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret && !assinaturaValida(request, paymentId, secret)) {
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 401 });
  }

  const admin = criarClienteAdmin();

  try {
    // Consulta o status real no MP (não confia no payload).
    const pg = await buscarPagamento(paymentId);
    const workspaceId = pg.externalReference;

    // Idempotência: registra o evento. Se o mp_payment_id já existe, o
    // índice único barra e a gente sabe que já processou.
    const { error: errInsert } = await admin.from("pagamento_eventos").insert({
      workspace_id: workspaceId,
      provider: "mercadopago",
      tipo,
      mp_payment_id: paymentId,
      status: pg.status,
      raw: pg.metadata,
    });
    if (errInsert) {
      // Violação de unique = já processado. Responde 200 sem reprocessar.
      if (errInsert.code === "23505") {
        return NextResponse.json({ ok: true, jaProcessado: true });
      }
      throw errInsert;
    }

    // Só ativa quando aprovado E temos o workspace.
    if (pg.status === "approved" && workspaceId) {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("id, ciclo")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      const ciclo = (sub?.ciclo as string) ?? "mensal";
      const proxima = new Date();
      if (ciclo === "anual") proxima.setFullYear(proxima.getFullYear() + 1);
      else proxima.setMonth(proxima.getMonth() + 1);
      const proximaStr = proxima.toISOString().slice(0, 10);

      // Ativa a subscription.
      if (sub) {
        await admin
          .from("subscriptions")
          .update({
            status: "ativa",
            provider: "mercadopago",
            mp_payment_id: paymentId,
            metodo: normalizarMetodo(pg),
            proxima_cobranca: proximaStr,
            trial_termina_em: null,
          })
          .eq("id", sub.id);
      }

      // Espelha no workspace.
      await admin
        .from("workspaces")
        .update({ status: "ativa" })
        .eq("id", workspaceId);
    }

    return NextResponse.json({ ok: true, status: pg.status });
  } catch (e) {
    // Erro real (rede/DB) → 500 pra o MP reenviar depois.
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha no webhook." },
      { status: 500 }
    );
  }
}

// MP às vezes faz um GET de teste no endpoint — responde 200.
export async function GET() {
  return NextResponse.json({ ok: true });
}
