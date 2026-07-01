import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { infoSubscription } from "@/lib/services/stripe.service";
import {
  ehUpgrade,
  estimarUpgrade,
  type PlanoId,
  type CicloCobranca,
} from "@/lib/planos";

/**
 * POST /api/assinatura/preview-upgrade  { plano }
 *
 * Estima quanto o admin paga AGORA pra subir pro `plano` (diferença rateada
 * pelos dias restantes do ciclo). É só uma ESTIMATIVA — o valor exato é
 * calculado pela Stripe na confirmação (/api/assinatura/upgrade).
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
    .select("mp_preference_id, plano, ciclo, status")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{
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
    const { moeda, diasRestantes } = await infoSubscription(sub.mp_preference_id);
    const valorAgora = estimarUpgrade({ atual, novo, ciclo, moeda, diasRestantes });
    return NextResponse.json({ valorAgora, moeda, diasRestantes, ciclo, atual, novo });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao estimar o upgrade." },
      { status: 500 }
    );
  }
}
