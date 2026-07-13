import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { regiaoDe, resolverPais } from "@/lib/regiao";
import {
  criarCheckoutExcedente,
  obterOuCriarCustomer,
} from "@/lib/services/stripe.service";
import { PRECO_EXCEDENTE } from "@/lib/planos";

/**
 * POST /api/contratos/excedente-checkout
 *
 * MODELO PRÉ-PAGO. Cria um checkout AVULSO pra pagar UMA unidade de contrato
 * EXCEDENTE (além do limite do ciclo). Ao ser pago, o WEBHOOK registra o
 * pagamento com `dias_concedidos = 0` e status 'excedente_disponivel' (sem
 * estender a validade) — o POST de /api/contratos consome esse crédito
 * atomicamente na próxima tentativa.
 *
 * Gateway: Stripe (Checkout hospedado), disponível em qualquer região — devolve
 * `{ url }` pro front redirecionar. Metadata `{ workspace_id, excedente:'true' }`
 * é o que o webhook reconhece. Só admin.
 *
 * DESVIO: o spec previa também um pagamento avulso via Mercado Pago. O helper do
 * MP (`criarPagamento`) e o polling de status (`/checkout/mercadopago/status`)
 * são de outros WIs (fora da minha alçada) e tratam TODO pagamento aprovado como
 * compra de plano (estenderiam a validade). Sem poder editá-los, o excedente MP
 * concederia dias por engano. Por segurança, o excedente usa só Stripe (hosted,
 * funciona no BR também). Registrado em desvios[].
 */

export const runtime = "nodejs";

export async function POST() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode pagar o contrato excedente." },
      { status: 403 }
    );
  }

  const workspaceId = r.sessao.workspaceId;
  const pais = resolverPais(
    headers().get("x-vercel-ip-country"),
    cookies().get("gc-pais")?.value
  );
  const { moeda } = regiaoDe(pais);

  const admin = criarClienteAdmin();

  try {
    // Reaproveita o customer da Stripe (reaproveitado: mp_* guarda o id Stripe).
    const { data: sub } = await admin
      .from("subscriptions")
      .select("mp_payment_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle<{ mp_payment_id: string | null }>();

    const customerId = await obterOuCriarCustomer({
      workspaceId,
      email: r.sessao.userEmail,
      customerIdExistente: sub?.mp_payment_id ?? null,
    });

    const session = await criarCheckoutExcedente({
      workspaceId,
      customerId,
      moeda,
    });
    if (!session.url) {
      throw new Error("Stripe não retornou a URL do checkout.");
    }

    return NextResponse.json({
      url: session.url,
      valor: PRECO_EXCEDENTE[moeda], // centavos
      moeda,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao iniciar o pagamento do excedente." },
      { status: 500 }
    );
  }
}
