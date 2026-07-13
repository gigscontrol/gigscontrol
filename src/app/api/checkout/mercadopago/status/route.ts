import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarPagamento,
  mercadoPagoConfigurado,
  normalizarMetodo,
} from "@/lib/services/mercadopago.service";
import { registrarPagamentoEEstenderAcesso } from "@/lib/services/pagamentos.service";

/**
 * GET /api/checkout/mercadopago/status?paymentId=...
 *
 * Polling do front (principalmente PIX) pra saber quando o pagamento aprovou.
 * Confere que o pagamento é DO WORKSPACE do usuário (external_reference) antes
 * de retornar qualquer coisa. Quando `approved`, também estende a validade —
 * caminho rápido pra o usuário não esperar o webhook; a RPC deduplica.
 *
 * Resposta: { status } (+ paymentId).
 */

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json(
      { erro: "Gateway indisponível." },
      { status: 503 }
    );
  }

  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const workspaceId = r.sessao.workspaceId;

  const paymentId = new URL(request.url).searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json(
      { erro: "paymentId ausente." },
      { status: 400 }
    );
  }

  try {
    const pag = await buscarPagamento(paymentId);

    // O pagamento TEM que ser deste workspace (external_reference) — senão um
    // usuário poderia sondar/estender pagamento de outra conta.
    if (pag.externalReference !== workspaceId) {
      return NextResponse.json(
        { erro: "Pagamento não encontrado." },
        { status: 404 }
      );
    }

    // Caminho rápido do polling: aprovou → estende já (RPC deduplica webhook).
    if (pag.status === "approved") {
      const md = pag.metadata as { plano?: string; ciclo?: string };
      await registrarPagamentoEEstenderAcesso({
        workspaceId,
        provider: "mercadopago",
        providerPaymentId: pag.id,
        plano: md.plano ?? null,
        ciclo: md.ciclo ?? null,
        valor: pag.valor != null ? Math.round(pag.valor * 100) : null,
        moeda: "brl",
        metodo: normalizarMetodo(pag.tipo),
      });
    }

    return NextResponse.json({ status: pag.status, paymentId: pag.id });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao consultar o pagamento." },
      { status: 500 }
    );
  }
}
