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
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
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

  // escolher-plano é APENAS a pré-seleção do onboarding (antes de existir
  // qualquer subscription). Se já existe subscription (trial, checkout ou
  // assinatura), a troca de plano PRECISA passar pelo fluxo Stripe
  // (upgrade/downgrade) — gravar workspaces.plano direto aqui dessincronizaria
  // do que o Stripe cobra e, em trial, tentaria burlar limites sem pagar.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, status, acesso_ate")
    .eq("workspace_id", r.sessao.workspaceId)
    .maybeSingle<{ id: string; status: string; acesso_ate: string | null }>();
  // Um stub de checkout INCOMPLETO (SEM `acesso_ate` = nunca pagou) nasce só de
  // o admin visitar /pagamento no modo embedded — sem pagar. NÃO é assinatura,
  // então deve poder re-selecionar o plano. Só bloqueia se JÁ tem validade
  // (acesso_ate setado): assinatura paga OU trial grátis de verdade.
  const ehStubIncompleto = !sub?.acesso_ate;
  if (sub && !ehStubIncompleto) {
    return NextResponse.json(
      { erro: "Mude o plano em Configurações › Plano & Assinatura." },
      { status: 409 }
    );
  }

  try {
    const { error } = await admin
      .from("workspaces")
      .update({ plano: parsed.data.plano, ciclo: parsed.data.ciclo })
      .eq("id", r.sessao.workspaceId);
    if (error) throw error;
    // Se há um stub de checkout incompleto, sincroniza plano+ciclo nele também —
    // o status do onboarding lê subscriptions.ciclo ANTES de workspaces.ciclo.
    if (ehStubIncompleto && sub) {
      await admin
        .from("subscriptions")
        .update({ plano: parsed.data.plano, ciclo: parsed.data.ciclo })
        .eq("id", sub.id);
    }
    return NextResponse.json({
      ok: true,
      plano: parsed.data.plano,
      ciclo: parsed.data.ciclo,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao salvar plano." },
      { status: 500 }
    );
  }
}
