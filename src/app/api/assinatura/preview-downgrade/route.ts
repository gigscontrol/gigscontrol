import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { infoSubscription, valorCobranca } from "@/lib/services/stripe.service";
import { excedentesParaPlano, mensagemExcedentes } from "@/lib/services/limites";
import { PLANOS, ehDowngrade, getPlano, type PlanoId } from "@/lib/planos";

/**
 * POST /api/assinatura/preview-downgrade  { plano }
 *
 * Mostra o que aconteceria num downgrade ANTES de confirmar: se o uso atual
 * cabe no destino (senão, o que remover), quando vira (fim do período pago) e
 * o valor que passará a pagar. Não altera nada.
 */
const schema = z.object({
  plano: z.enum(["individual", "equipe", "time", "agencia", "agencia-plus", "agencia-max"]),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Apenas admin." }, { status: 403 });
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
    .select("mp_preference_id, plano, status, downgrade_para")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      mp_preference_id: string | null;
      plano: string | null;
      status: string | null;
      downgrade_para: string | null;
    }>();

  if (!sub?.mp_preference_id) {
    return NextResponse.json({ erro: "Sem assinatura na Stripe." }, { status: 409 });
  }
  if (sub.status !== "ativa") {
    return NextResponse.json(
      { erro: "A assinatura precisa estar ativa (paga)." },
      { status: 409 }
    );
  }

  const atual: PlanoId = PLANOS.some((p) => p.id === sub.plano)
    ? (sub.plano as PlanoId)
    : "individual";
  const novo = parsed.data.plano;
  if (!ehDowngrade(atual, novo)) {
    return NextResponse.json({ erro: "Só dá pra BAIXAR de plano por aqui." }, { status: 400 });
  }

  try {
    const excedentes = await excedentesParaPlano(admin, r.sessao.workspaceId, novo);
    const { moeda, ciclo, periodEnd } = await infoSubscription(sub.mp_preference_id);
    const efetivoEm = periodEnd
      ? new Date(periodEnd * 1000).toISOString().slice(0, 10)
      : null;
    return NextResponse.json({
      cabe: excedentes.length === 0,
      excedentes,
      mensagem: excedentes.length > 0 ? mensagemExcedentes(excedentes, getPlano(novo).nome) : null,
      valorNovo: valorCobranca(novo, ciclo, moeda),
      moeda,
      ciclo,
      efetivoEm,
      jaAgendado: !!sub.downgrade_para,
      atual,
      novo,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao estimar o downgrade." },
      { status: 500 }
    );
  }
}
