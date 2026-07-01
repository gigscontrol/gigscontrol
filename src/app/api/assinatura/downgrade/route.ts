import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { agendarDowngrade } from "@/lib/services/stripe.service";
import { excedentesParaPlano, mensagemExcedentes } from "@/lib/services/limites";
import { PLANOS, ehDowngrade, getPlano, type PlanoId } from "@/lib/planos";

/**
 * POST /api/assinatura/downgrade  { plano }
 *
 * Agenda um DOWNGRADE pro fim do período atual (não devolve dinheiro; só vira
 * na próxima renovação). Regras:
 *  - Só admin, assinatura ATIVA (paga), e só pra plano INFERIOR.
 *  - VALIDA o uso atual: se artistas/usuários/modelos excedem o destino,
 *    recusa (409) com a lista do que remover — nada pode passar o limite do
 *    plano-alvo.
 *  - Cria um Stripe Subscription Schedule (mantém o plano atual até o fim do
 *    período, aí cai pro destino sem rateio). Ao renovar no preço menor, o
 *    webhook reconcilia o plano no MESMO instante (fecha o "paga menos, mantém
 *    benefícios"). Enquanto pendente, o cadastro já respeita o limite do destino.
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
    .select("id, mp_preference_id, plano, status, downgrade_para")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      id: string;
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
      { erro: "A assinatura precisa estar ativa (paga) pra agendar downgrade." },
      { status: 409 }
    );
  }
  if (sub.downgrade_para) {
    return NextResponse.json(
      { erro: "Já existe um downgrade agendado. Cancele antes de agendar outro." },
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

  // Uso atual precisa CABER no plano-destino (senão manda remover o excedente).
  const excedentes = await excedentesParaPlano(admin, r.sessao.workspaceId, novo);
  if (excedentes.length > 0) {
    return NextResponse.json(
      { erro: mensagemExcedentes(excedentes, getPlano(novo).nome), excedentes },
      { status: 409 }
    );
  }

  try {
    const { efetivoEm, ciclo, moeda, valorNovo } = await agendarDowngrade({
      subscriptionId: sub.mp_preference_id,
      plano: novo,
    });
    const efetivoData = efetivoEm
      ? new Date(efetivoEm * 1000).toISOString().slice(0, 10)
      : null;
    const { error } = await admin
      .from("subscriptions")
      .update({ downgrade_para: novo, downgrade_efetivo_em: efetivoData })
      .eq("id", sub.id);
    if (error) {
      console.error(
        "[downgrade] schedule criado mas o registro no DB falhou:",
        error.message
      );
    }
    return NextResponse.json({
      ok: true,
      plano: novo,
      efetivoEm: efetivoData,
      valorNovo,
      moeda,
      ciclo,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao agendar o downgrade." },
      { status: 500 }
    );
  }
}
