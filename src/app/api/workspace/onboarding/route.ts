import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { getPlano, type PlanoId } from "@/lib/planos";

/**
 * GET /api/workspace/onboarding
 *
 * Devolve o status atual do onboarding + checklist calculado:
 *  - onboardingCompleto: flag manual em workspaces (true quando admin
 *    clicou "Concluir" ou "Pular")
 *  - subscriptionStatus: trial/ativa — controla se mostra /pagamento
 *  - plano: dados pra mostrar na tela de pagamento
 *  - checklist: estado calculado em tempo real dos passos do
 *    onboarding (logo, artista, contato, equipe)
 *
 * Usado por:
 *  - /pagamento — pra mostrar o plano + saber se já está ativo
 *  - /onboarding — pra renderizar a checklist
 *  - /app — pra decidir se redireciona pra onboarding
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  // Onboarding é só do admin — outros papéis pulam direto pro app
  if (r.sessao.papel !== "admin") {
    return NextResponse.json({
      onboardingCompleto: true,
      subscriptionStatus: "ativa",
      naoAdmin: true,
    });
  }

  const admin = criarClienteAdmin();
  const workspaceId = r.sessao.workspaceId;

  try {
    // Workspace + plano + identidade (pra etapa 3 saber o que já tá preenchido)
    const { data: ws, error: errWs } = await admin
      .from("workspaces")
      .select(
        "id, nome, plano, logo_url, onboarding_completo, whatsapp, " +
          "cor_acento, cidade_ibge_id, cidade_nome, cidade_uf"
      )
      .eq("id", workspaceId)
      .single<{
        id: string;
        nome: string;
        plano: string;
        logo_url: string | null;
        onboarding_completo: boolean;
        whatsapp: string | null;
        cor_acento: string | null;
        cidade_ibge_id: string | null;
        cidade_nome: string | null;
        cidade_uf: string | null;
      }>();
    if (errWs || !ws) {
      return NextResponse.json(
        { erro: "Workspace não encontrado." },
        { status: 404 }
      );
    }

    // Subscription (status de pagamento + trial)
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status, ciclo, trial_termina_em")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    // Counts em paralelo
    const [{ count: nArtistas }, { count: nContratantes }, { count: nCasas }, { count: nEquipe }] =
      await Promise.all([
        admin
          .from("artists")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .is("deletado_em", null),
        admin
          .from("contratantes")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .is("deletado_em", null),
        admin
          .from("casas")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .is("deletado_em", null),
        admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .is("deletado_em", null)
          .not("papel", "in", "(admin,artista)"),
      ]);

    const plano = ws.plano ? getPlano(ws.plano as PlanoId) : null;

    return NextResponse.json({
      onboardingCompleto: !!ws.onboarding_completo,
      subscriptionStatus: sub?.status ?? "trial",
      trialTerminaEm: sub?.trial_termina_em ?? null,
      plano: plano
        ? {
            id: plano.id,
            nome: plano.nome,
            precoMensal: plano.precoMensal,
            tagline: plano.tagline,
          }
        : null,
      planoEscolhido: ws.plano,
      checklist: {
        contaCriada: true, // sempre
        planoEscolhido: !!ws.plano && (sub?.status === "ativa" || sub?.status === "trial"),
        agenciaConfigurada:
          !!ws.whatsapp && !!ws.cidade_ibge_id, // mínimos pra etapa 3
        temArtista: (nArtistas ?? 0) > 0,
        temEquipe: (nEquipe ?? 0) > 0,
        // Mantém os antigos pra compat — não vai mais ser usado
        temContato: (nContratantes ?? 0) + (nCasas ?? 0) > 0,
        logoSubida: !!ws.logo_url,
      },
      identidade: {
        nomeAgencia: ws.nome,
        whatsapp: ws.whatsapp,
        corAcento: ws.cor_acento,
        cidadeIbgeId: ws.cidade_ibge_id,
        cidadeNome: ws.cidade_nome,
        cidadeUf: ws.cidade_uf,
        logoUrl: ws.logo_url,
      },
      nomeAgencia: ws.nome,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao ler status do onboarding." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/onboarding
 *
 * Marca o onboarding como completo. Idempotente — chamar 2x não faz
 * mal. Disparado quando o admin clica "Concluir" no checklist, ou
 * "Pular por agora".
 */
export async function POST() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode concluir o onboarding." },
      { status: 403 }
    );
  }
  const admin = criarClienteAdmin();
  try {
    const { error } = await admin
      .from("workspaces")
      .update({ onboarding_completo: true })
      .eq("id", r.sessao.workspaceId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao concluir onboarding." },
      { status: 500 }
    );
  }
}
