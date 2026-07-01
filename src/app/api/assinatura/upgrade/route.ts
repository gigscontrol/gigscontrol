import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { aplicarUpgrade, valorCobranca } from "@/lib/services/stripe.service";
import { ehUpgrade, type PlanoId, type CicloCobranca } from "@/lib/planos";

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
    .select("id, mp_preference_id, plano, ciclo, status")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      id: string;
      mp_preference_id: string | null;
      plano: string | null;
      ciclo: string | null;
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

  const atual = (sub.plano ?? "individual") as PlanoId;
  const novo = parsed.data.plano;
  const ciclo = (sub.ciclo === "anual" ? "anual" : "mensal") as CicloCobranca;
  if (!ehUpgrade(atual, novo)) {
    return NextResponse.json({ erro: "Só dá pra SUBIR de plano por aqui." }, { status: 400 });
  }

  try {
    const { moeda } = await aplicarUpgrade({
      subscriptionId: sub.mp_preference_id,
      plano: novo,
      ciclo,
    });
    // A Stripe já trocou o preço + cobrou o rateio. Sincroniza o plano no DB.
    const valor = valorCobranca(novo, ciclo, moeda);
    await admin.from("workspaces").update({ plano: novo, ciclo }).eq("id", r.sessao.workspaceId);
    await admin.from("subscriptions").update({ plano: novo, ciclo, valor }).eq("id", sub.id);
    return NextResponse.json({ ok: true, plano: novo });
  } catch (e) {
    // error_if_incomplete → cartão recusado / pagamento pendente.
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao cobrar o upgrade. Verifique o cartão." },
      { status: 402 }
    );
  }
}
