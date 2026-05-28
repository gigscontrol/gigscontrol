import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/workspace/ativar-plano
 *
 * Mock de ativação de plano (futuramente disparado pelo webhook do
 * Stripe). Atualiza `workspaces.plano` pro plano escolhido e
 * marca a subscription como 'ativa' (sem trial).
 *
 * Body: { plano?: 'individual' | 'agencia' | 'plus' }
 * Se `plano` não vier, usa o plano que já está no workspace.
 */
// Aceita qualquer um dos 5 planos do catálogo
const schema = z.object({
  plano: z
    .enum(["individual", "equipe", "agencia", "agencia-plus", "agencia-max"])
    .optional(),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode ativar o plano." },
      { status: 403 }
    );
  }

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    // Body opcional — segue com {}
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }

  const admin = criarClienteAdmin();
  const workspaceId = r.sessao.workspaceId;

  try {
    // Resolve o plano (do body ou do workspace existente)
    let planoFinal = parsed.data.plano;
    if (!planoFinal) {
      const { data: ws } = await admin
        .from("workspaces")
        .select("plano")
        .eq("id", workspaceId)
        .single();
      planoFinal = (ws?.plano as
        | "individual"
        | "equipe"
        | "agencia"
        | "agencia-plus"
        | "agencia-max") ?? "individual";
    } else {
      // Veio plano no body — atualiza o workspace também
      await admin
        .from("workspaces")
        .update({ plano: planoFinal, status: "ativa" })
        .eq("id", workspaceId);
    }

    // Cria/atualiza subscription
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (sub) {
      const { error } = await admin
        .from("subscriptions")
        .update({
          plano: planoFinal,
          status: "ativa",
          trial_termina_em: null, // sai do trial
          inicio_em: new Date().toISOString().slice(0, 10),
        })
        .eq("id", sub.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("subscriptions").insert({
        workspace_id: workspaceId,
        plano: planoFinal,
        ciclo: "mensal",
        status: "ativa",
        inicio_em: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, plano: planoFinal });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao ativar plano." },
      { status: 500 }
    );
  }
}
