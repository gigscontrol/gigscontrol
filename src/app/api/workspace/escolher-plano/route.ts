import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/workspace/escolher-plano
 *
 * Apenas grava o plano escolhido em `workspaces.plano`. NÃO ativa a
 * subscription — isso fica pro /pagamento (ativar-plano) ou pra
 * iniciar-trial (no caso do Individual).
 *
 * Usado na Etapa 2 do onboarding quando o admin clica "Continuar e
 * pagar" — a gente salva a escolha e redireciona pro /pagamento, que
 * mostra o plano e simula o checkout.
 *
 * Body: { plano: 'individual' | 'equipe' | 'agencia' | 'agencia-plus' | 'agencia-max' }
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
    return NextResponse.json(
      { erro: "Apenas admin pode trocar o plano." },
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
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }

  const admin = criarClienteAdmin();

  // Com assinatura ATIVA, a troca de plano PRECISA passar pelo Stripe
  // (upgrade com rateio ou downgrade agendado). Gravar workspaces.plano direto
  // aqui dessincronizaria do que o Stripe cobra — bloqueia e manda pra aba Plano.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{ status: string | null }>();
  if (sub?.status === "ativa") {
    return NextResponse.json(
      { erro: "Assinatura ativa: mude o plano em Configurações › Plano & Assinatura." },
      { status: 409 }
    );
  }

  try {
    const { error } = await admin
      .from("workspaces")
      .update({ plano: parsed.data.plano })
      .eq("id", r.sessao.workspaceId);
    if (error) throw error;
    return NextResponse.json({ ok: true, plano: parsed.data.plano });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao salvar plano." },
      { status: 500 }
    );
  }
}
