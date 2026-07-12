import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  PLANOS,
  ehUpgrade,
  creditoDiasUpgrade,
  diasDeCiclo,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";

/**
 * POST /api/assinatura/preview-upgrade  { plano }
 *
 * Prévia do upgrade no modelo PRÉ-PAGO por validade: quantos DIAS de acesso o
 * pagamento do plano novo concede — o ciclo inteiro (30/365) MAIS o crédito em
 * dias da sobra de valor do plano atual (`creditoDias`). Não altera nada.
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
    .select("plano, ciclo, acesso_ate")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      plano: string | null;
      ciclo: string | null;
      acesso_ate: string | null;
    }>();

  const atual: PlanoId = PLANOS.some((p) => p.id === sub?.plano)
    ? (sub!.plano as PlanoId)
    : "individual";
  const novo = parsed.data.plano;
  if (!ehUpgrade(atual, novo)) {
    return NextResponse.json({ erro: "Só dá pra SUBIR de plano por aqui." }, { status: 400 });
  }

  const ciclo: CicloCobranca = sub?.ciclo === "anual" ? "anual" : "mensal";
  const moeda = await moedaDoUltimoPagamento(admin, r.sessao.workspaceId);
  const diasRestantes = diasRestantesDe(sub?.acesso_ate ?? null);
  const creditoDias = creditoDiasUpgrade({ atual, novo, ciclo, moeda, diasRestantes });
  const diasConcedidos = diasDeCiclo(ciclo) + creditoDias;

  return NextResponse.json({
    atual,
    novo,
    ciclo,
    moeda,
    diasRestantes,
    creditoDias,
    diasConcedidos,
  });
}

/** Dias restantes (arredonda pra cima) a partir da validade; 0 se vencida/nula. */
function diasRestantesDe(acessoAte: string | null): number {
  if (!acessoAte) return 0;
  const ms = new Date(acessoAte).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
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
