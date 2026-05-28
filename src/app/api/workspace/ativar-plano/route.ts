import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/workspace/ativar-plano
 *
 * Mock de ativação de plano. Atualiza `subscriptions.status` de 'trial'
 * pra 'ativa' (cria a row se não existir). NÃO cobra nada — é só o
 * placeholder pra quando o Stripe entrar.
 *
 * Em produção real, isso vai ser disparado pelo webhook do Stripe
 * quando o pagamento for confirmado.
 */
export async function POST() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode ativar o plano." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();
  const workspaceId = r.sessao.workspaceId;

  try {
    // Pega o plano do workspace pra calcular o valor
    const { data: ws, error: errWs } = await admin
      .from("workspaces")
      .select("plano, ciclo")
      .eq("id", workspaceId)
      .single();
    if (errWs || !ws) {
      return NextResponse.json(
        { erro: "Workspace não encontrado." },
        { status: 404 }
      );
    }

    // Já existe subscription?
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, status")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (sub) {
      // Atualiza pra ativa
      const { error } = await admin
        .from("subscriptions")
        .update({
          status: "ativa",
          inicio_em: new Date().toISOString().slice(0, 10),
        })
        .eq("id", sub.id);
      if (error) throw error;
    } else {
      // Cria nova
      const { error } = await admin.from("subscriptions").insert({
        workspace_id: workspaceId,
        plano: ws.plano,
        ciclo: ws.ciclo ?? "mensal",
        status: "ativa",
        inicio_em: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao ativar plano." },
      { status: 500 }
    );
  }
}
