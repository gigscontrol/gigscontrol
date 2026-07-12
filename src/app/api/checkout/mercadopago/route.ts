import { NextResponse } from "next/server";
import { z } from "zod";
import { headers, cookies } from "next/headers";
import { autenticarComWorkspace } from "@/lib/api/session";
import { resolverPais } from "@/lib/regiao";
import { mpDisponivel } from "@/lib/gateway";
import { getPlano, valorMensal, valorAnual } from "@/lib/planos";
import {
  criarPagamento,
  mercadoPagoConfigurado,
  normalizarMetodo,
  type FormDataBrick,
} from "@/lib/services/mercadopago.service";
import { registrarPagamentoEEstenderAcesso } from "@/lib/services/pagamentos.service";

/**
 * POST /api/checkout/mercadopago
 *
 * Cria um pagamento (PIX ou cartão) via Payment Brick a partir do formData que
 * o Brick tokenizou no browser. Mercado Pago é SÓ pro Brasil (regra local
 * `mpDisponivel` — o W4 troca por lib/gateway.ts). Valores em BRL.
 *
 * Cartão → se APPROVED, já estende a validade na hora (a RPC deduplica quando o
 * webhook/polling chegarem). PIX → volta pending com o QR Code; a extensão vem
 * depois pelo webhook/polling.
 *
 * Body: { plano, ciclo, formData }
 */

export const runtime = "nodejs";

const schema = z.object({
  plano: z.enum([
    "individual",
    "equipe",
    "time",
    "agencia",
    "agencia-plus",
    "agencia-max",
  ]),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
  // formData do Brick — shape dinâmico (token, installments, payer, etc.).
  formData: z.record(z.string(), z.unknown()),
});

/** Valor TOTAL da cobrança em CENTAVOS (BRL) pra plano + ciclo. */
function valorCentavos(plano: string, ciclo: string): number {
  const p = getPlano(plano as Parameters<typeof getPlano>[0]);
  const reais = ciclo === "anual" ? valorAnual(p, "brl") : valorMensal(p, "brl");
  return Math.round(reais * 100);
}

export async function POST(request: Request) {
  // Sem envs, o app builda/roda; só a rota responde 503.
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json(
      { erro: "Gateway indisponível." },
      { status: 503 }
    );
  }

  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode iniciar o pagamento." },
      { status: 403 }
    );
  }

  // Mercado Pago só pra Brasil (v1).
  const pais = resolverPais(
    headers().get("x-vercel-ip-country"),
    cookies().get("gc-pais")?.value
  );
  if (!mpDisponivel(pais)) {
    return NextResponse.json(
      { erro: "Mercado Pago disponível apenas no Brasil." },
      { status: 400 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }
  const { plano, ciclo, formData } = parsed.data;
  const workspaceId = r.sessao.workspaceId;
  const valor = valorCentavos(plano, ciclo);

  try {
    const pag = await criarPagamento({
      workspaceId,
      plano,
      ciclo,
      valor,
      formDataDoBrick: formData as FormDataBrick,
    });

    // PIX: volta pending com o QR Code — a extensão vem pelo webhook/polling.
    if (pag.metodoId === "pix" || pag.tipo === "bank_transfer") {
      return NextResponse.json({
        status: "pending",
        paymentId: pag.id,
        qrCode: pag.pix?.qrCode ?? null,
        qrCodeBase64: pag.pix?.qrCodeBase64 ?? null,
        ticketUrl: pag.pix?.ticketUrl ?? null,
      });
    }

    // Cartão APPROVED → estende JÁ (a RPC deduplica webhook/polling depois).
    if (pag.status === "approved") {
      await registrarPagamentoEEstenderAcesso({
        workspaceId,
        provider: "mercadopago",
        providerPaymentId: pag.id,
        plano,
        ciclo,
        valor,
        moeda: "brl",
        metodo: normalizarMetodo(pag.tipo),
      });
    }

    // Cartão: approved | in_process | rejected.
    return NextResponse.json({
      status: pag.status,
      paymentId: pag.id,
      statusDetail: pag.statusDetail,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar o pagamento." },
      { status: 500 }
    );
  }
}
