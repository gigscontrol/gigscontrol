import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { excedentesParaPlano, mensagemExcedentes } from "@/lib/services/limites";
import { PLANOS, ehDowngrade, getPlano, type PlanoId } from "@/lib/planos";

/**
 * POST /api/assinatura/downgrade  { plano }
 *
 * MODELO PRÉ-PAGO por validade. Não há mais Subscription Schedule da Stripe:
 * o plano vale enquanto durar a validade paga. O downgrade aqui só MARCA a
 * intenção — reusa as colunas da mig 46 com semântica nova:
 *  - `downgrade_para`        = plano-alvo a oferecer NA PRÓXIMA COMPRA.
 *  - `downgrade_efetivo_em`  = `acesso_ate` (quando a validade atual acaba).
 *
 * Enquanto marcado, `planoEfetivoParaLimites` já aplica o limite do destino
 * (fecha o "carrega tudo no top, agenda downgrade, mantém recursos"). Por isso
 * VALIDA o uso atual: se artistas/usuários/modelos excedem o destino, recusa
 * (409) com o que remover. Não cobra nem estende nada.
 */
const schema = z.object({
  plano: z.enum([
    "individual",
    "equipe",
    "time",
    "agencia",
    "agencia-plus",
    "agencia-max",
  ]),
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
    .select("id, plano, acesso_ate, downgrade_para")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      id: string;
      plano: string | null;
      acesso_ate: string | null;
      downgrade_para: string | null;
    }>();

  if (!sub) {
    return NextResponse.json({ erro: "Sem assinatura." }, { status: 409 });
  }
  if (sub.downgrade_para) {
    return NextResponse.json(
      { erro: "Já existe um downgrade marcado. Cancele antes de marcar outro." },
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

  // Efetivo no fim da validade atual (só rótulo — o corte real é a expiração).
  const efetivoData = sub.acesso_ate ? sub.acesso_ate.slice(0, 10) : null;
  const { error } = await admin
    .from("subscriptions")
    .update({ downgrade_para: novo, downgrade_efetivo_em: efetivoData })
    .eq("id", sub.id);
  if (error) {
    return NextResponse.json(
      { erro: error.message ?? "Falha ao marcar o downgrade." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, plano: novo, efetivoEm: efetivoData });
}
