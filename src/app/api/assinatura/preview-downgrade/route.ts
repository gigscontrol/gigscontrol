import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { excedentesParaPlano, mensagemExcedentes } from "@/lib/services/limites";
import {
  PLANOS,
  ehDowngrade,
  getPlano,
  valorMensal,
  valorAnual,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";

/**
 * POST /api/assinatura/preview-downgrade  { plano }
 *
 * MODELO PRÉ-PAGO por validade. Mostra o que aconteceria num downgrade ANTES de
 * marcar: se o uso atual cabe no destino (senão, o que remover), quando passa a
 * valer (fim da validade atual = `acesso_ate`) e o valor da PRÓXIMA compra no
 * plano menor. Não altera nada.
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
    .select("plano, ciclo, acesso_ate, downgrade_para")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      plano: string | null;
      ciclo: string | null;
      acesso_ate: string | null;
      downgrade_para: string | null;
    }>();

  const atual: PlanoId = PLANOS.some((p) => p.id === sub?.plano)
    ? (sub!.plano as PlanoId)
    : "individual";
  const novo = parsed.data.plano;
  if (!ehDowngrade(atual, novo)) {
    return NextResponse.json({ erro: "Só dá pra BAIXAR de plano por aqui." }, { status: 400 });
  }

  const excedentes = await excedentesParaPlano(admin, r.sessao.workspaceId, novo);
  const ciclo: CicloCobranca = sub?.ciclo === "anual" ? "anual" : "mensal";
  const moeda = await moedaDoUltimoPagamento(admin, r.sessao.workspaceId);
  const pNovo = getPlano(novo);
  const valorNovo = ciclo === "anual" ? valorAnual(pNovo, moeda) : valorMensal(pNovo, moeda);
  const efetivoEm = sub?.acesso_ate ? sub.acesso_ate.slice(0, 10) : null;

  return NextResponse.json({
    cabe: excedentes.length === 0,
    excedentes,
    mensagem: excedentes.length > 0 ? mensagemExcedentes(excedentes, pNovo.nome) : null,
    valorNovo,
    moeda,
    ciclo,
    efetivoEm,
    jaAgendado: !!sub?.downgrade_para,
    atual,
    novo,
  });
}

/** Moeda do último pagamento do workspace (BRL default se não houver). */
async function moedaDoUltimoPagamento(
  admin: ReturnType<typeof criarClienteAdmin>,
  workspaceId: string
): Promise<Moeda> {
  const { data } = await admin
    .from("pagamentos")
    .select("moeda")
    .eq("workspace_id", workspaceId)
    .not("moeda", "is", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle<{ moeda: string | null }>();
  return data?.moeda === "usd" ? "usd" : "brl";
}
