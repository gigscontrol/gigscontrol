import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/workspace/iniciar-trial
 *
 * Marca a subscription do workspace como TRIAL grátis de 7 dias.
 * Usado na Etapa 2 do onboarding quando o admin escolhe "Começar
 * teste grátis" num plano em vez de pagar agora.
 *
 * Atualiza `workspaces.plano` pra o plano escolhido e mexe na
 * subscription: status='trial', trial_termina_em = now + 7d.
 *
 * Body: { plano: 'individual' | 'agencia' | 'plus' }
 */

// Trial grátis de 7 dias é EXCLUSIVO do plano Individual.
// Outros planos vão direto pro /pagamento mock.
const schema = z.object({
  plano: z.literal("individual"),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode iniciar o trial." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Teste grátis disponível apenas no plano Individual." },
      { status: 400 }
    );
  }

  const admin = criarClienteAdmin();
  const workspaceId = r.sessao.workspaceId;
  const fimTrial = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Atualiza workspaces.plano
    const { error: errWs } = await admin
      .from("workspaces")
      .update({ plano: parsed.data.plano, status: "trial" })
      .eq("id", workspaceId);
    if (errWs) throw errWs;

    // 2. Cria/atualiza subscription
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (sub) {
      const { error } = await admin
        .from("subscriptions")
        .update({
          plano: parsed.data.plano,
          status: "trial",
          trial_termina_em: fimTrial,
          inicio_em: new Date().toISOString().slice(0, 10),
        })
        .eq("id", sub.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("subscriptions").insert({
        workspace_id: workspaceId,
        plano: parsed.data.plano,
        ciclo: "mensal",
        status: "trial",
        trial_termina_em: fimTrial,
        inicio_em: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, trialTerminaEm: fimTrial });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao iniciar trial." },
      { status: 500 }
    );
  }
}
