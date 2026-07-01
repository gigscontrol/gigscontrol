import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { aplicarUpgrade, valorCobranca } from "@/lib/services/stripe.service";
import { PLANOS, ehUpgrade, type PlanoId } from "@/lib/planos";

/**
 * POST /api/assinatura/upgrade  { plano }
 *
 * Sobe a assinatura pro `plano` com RATEIO (proration) e cobra a diferença
 * NA HORA no cartão salvo (Stripe). Atualiza o plano no DB
 * (workspaces + subscriptions) — o webhook customer.subscription.updated
 * sincroniza status/datas mas não muda o plano.
 *
 * Só UPGRADE (plano superior). Downgrade não passa por aqui.
 */
const schema = z.object({
  plano: z.enum(["individual", "equipe", "time", "agencia", "agencia-plus", "agencia-max"]),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Apenas admin pode mudar o plano." }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }

  const admin = criarClienteAdmin();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, mp_preference_id, plano, status")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      id: string;
      mp_preference_id: string | null;
      plano: string | null;
      status: string | null;
    }>();

  if (!sub?.mp_preference_id) {
    return NextResponse.json({ erro: "Sem assinatura na Stripe." }, { status: 409 });
  }
  if (sub.status !== "ativa") {
    return NextResponse.json(
      { erro: "A assinatura precisa estar ativa (paga) pra fazer upgrade." },
      { status: 409 }
    );
  }

  // Valida o plano atual contra os planos conhecidos (não confia em texto livre do banco).
  const atual: PlanoId = PLANOS.some((p) => p.id === sub.plano)
    ? (sub.plano as PlanoId)
    : "individual";
  const novo = parsed.data.plano;
  if (!ehUpgrade(atual, novo)) {
    return NextResponse.json({ erro: "Só dá pra SUBIR de plano por aqui." }, { status: 400 });
  }

  try {
    // Ciclo + moeda saem do estado REAL da assinatura no Stripe (dentro de aplicarUpgrade).
    const { moeda, ciclo } = await aplicarUpgrade({
      subscriptionId: sub.mp_preference_id,
      plano: novo,
    });
    // A Stripe já trocou o preço + cobrou o rateio (irreversível). Sincroniza o DB;
    // se algum write falhar, o webhook (customer.subscription.updated) reconcilia pelo preço.
    const valor = valorCobranca(novo, ciclo, moeda);
    const [w1, w2] = await Promise.all([
      admin.from("workspaces").update({ plano: novo, ciclo }).eq("id", r.sessao.workspaceId),
      admin.from("subscriptions").update({ plano: novo, ciclo, valor }).eq("id", sub.id),
    ]);
    if (w1.error || w2.error) {
      console.error(
        "[upgrade] Stripe cobrou mas o sync no DB falhou (o webhook vai reconciliar):",
        w1.error?.message,
        w2.error?.message
      );
    }
    return NextResponse.json({ ok: true, plano: novo, ciclo });
  } catch (e) {
    // error_if_incomplete → cartão recusado / pagamento pendente.
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao cobrar o upgrade. Verifique o cartão." },
      { status: 402 }
    );
  }
}
