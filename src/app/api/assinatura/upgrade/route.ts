import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  PLANOS,
  ehUpgrade,
  creditoDiasUpgrade,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";

/**
 * POST /api/assinatura/upgrade  { plano }
 *
 * MODELO PRÉ-PAGO por validade. Não há mais rateio/proration da Stripe. O
 * upgrade é: paga-se o plano NOVO por um ciclo inteiro via checkout normal
 * (qualquer gateway) e a sobra de valor do plano atual (os dias ainda não
 * usados) vira DIAS EXTRAS do plano novo.
 *
 * Esta rota NÃO cobra nada: só valida (admin, é upgrade de verdade) e calcula o
 * `creditoDias` (crédito de upgrade em dias), devolvendo
 * `{ checkout: true, plano, ciclo, creditoDias }`. O front dispara o checkout
 * passando `credito_dias` no metadata; o WEBHOOK RECALCULA o crédito
 * server-side no momento do pagamento (não confia no metadata cru) e concede
 * diasDoCiclo + creditoDias.
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
    .select("plano, ciclo, status, acesso_ate")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
      plano: string | null;
      ciclo: string | null;
      status: string | null;
      acesso_ate: string | null;
    }>();

  // Valida o plano atual contra os planos conhecidos (não confia em texto livre).
  const atual: PlanoId = PLANOS.some((p) => p.id === sub?.plano)
    ? (sub!.plano as PlanoId)
    : "individual";
  const novo = parsed.data.plano;
  if (!ehUpgrade(atual, novo)) {
    return NextResponse.json({ erro: "Só dá pra SUBIR de plano por aqui." }, { status: 400 });
  }

  // Ciclo do plano atual (o upgrade mantém o ciclo). Moeda = a do último
  // pagamento (mesma do crédito). Sem histórico → BRL default.
  const ciclo: CicloCobranca = sub?.ciclo === "anual" ? "anual" : "mensal";
  const moeda = await moedaDoUltimoPagamento(admin, r.sessao.workspaceId);

  // Dias restantes da validade atual → viram o crédito (convertido pro preço/dia
  // do plano novo). Sem validade em dia → sem crédito.
  const diasRestantes = diasRestantesDe(sub?.acesso_ate ?? null);
  const creditoDias = creditoDiasUpgrade({ atual, novo, ciclo, moeda, diasRestantes });

  return NextResponse.json({ checkout: true, plano: novo, ciclo, creditoDias, moeda });
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
