import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { getPlano, type PlanoId } from "@/lib/planos";
// Fonte única da regra de acesso (mesma usada pelo gate server-side de mutação).
// `estadoAcessoDeSub` trata corretamente a AUSÊNCIA de subscription (legado →
// "ok"); não hardcodar "ativa"/"trial" aqui — o estado é do workspace real.
import { estadoAcessoDeSub } from "@/lib/acesso";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Plano feito" (modelo pré-pago) = tem VALIDADE de acesso futura
 * (`acesso_ate` > agora) — seja por pagamento real (Stripe/MP) ou cortesia
 * (trial de 7d grava acesso_ate). O stub que o checkout cria ANTES do
 * pagamento NÃO tem acesso_ate → NÃO conta (senão dá pra concluir o
 * onboarding sem pagar). O estado 'graça' (venceu há ≤1d) também conta como
 * "pode finalizar" — o gate normal de acesso cuida do resto.
 */
async function planoDoWorkspaceOk(
  admin: SupabaseClient,
  workspaceId: string
): Promise<boolean> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, acesso_ate")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ status: string | null; acesso_ate: string | null }>();
  return estadoAcessoDeSub(sub ?? null) !== "bloqueado";
}

/** Conta artistas ativos (não deletados) do workspace. */
async function contarArtistasAtivos(
  admin: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { count } = await admin
    .from("artists")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("deletado_em", null);
  return count ?? 0;
}

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

  // Onboarding é só do admin — mas TODO usuário precisa do estado de acesso
  // (graça/bloqueio) e de quem é o admin, pra avisar. O estado é do WORKSPACE:
  // se o admin não pagou/venceu, o não-admin também é bloqueado (cascata).
  if (r.sessao.papel !== "admin") {
    const adminDb = criarClienteAdmin();
    const wsId = r.sessao.workspaceId;
    const [{ data: subNA }, { data: adminProfile }] = await Promise.all([
      adminDb
        .from("subscriptions")
        .select("status, acesso_ate")
        .eq("workspace_id", wsId)
        .maybeSingle<{ status: string | null; acesso_ate: string | null }>(),
      adminDb
        .from("profiles")
        .select("nome")
        .eq("workspace_id", wsId)
        .eq("papel", "admin")
        .is("deletado_em", null)
        .limit(1)
        .maybeSingle<{ nome: string | null }>(),
    ]);
    return NextResponse.json({
      onboardingCompleto: true,
      naoAdmin: true,
      subscriptionStatus: subNA?.status ?? null,
      // Estado REAL do workspace (sem hardcode). Ausência de sub = legado → "ok".
      estadoAcesso: estadoAcessoDeSub(subNA ?? null),
      // Validade (modelo pré-pago); null pra legado/stub — front pode ignorar.
      acessoAte: subNA?.acesso_ate ?? null,
      adminContato: adminProfile?.nome ?? null,
    });
  }

  const admin = criarClienteAdmin();
  const workspaceId = r.sessao.workspaceId;

  try {
    // Workspace + plano + identidade (pra etapa 3 saber o que já tá preenchido)
    const { data: ws, error: errWs } = await admin
      .from("workspaces")
      .select(
        "id, nome, slug, plano, ciclo, logo_url, onboarding_completo, whatsapp, " +
          "cor_acento, cidade_ibge_id, cidade_nome, cidade_uf"
      )
      .eq("id", workspaceId)
      .single<{
        id: string;
        nome: string;
        slug: string;
        plano: string;
        ciclo: string | null;
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

    // Subscription (status de pagamento + validade). trial_termina_em fica só
    // como legado exibível; o gate deriva de acesso_ate (modelo pré-pago).
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status, ciclo, trial_termina_em, acesso_ate")
      .eq("workspace_id", workspaceId)
      .maybeSingle<{
        status: string | null;
        ciclo: string | null;
        trial_termina_em: string | null;
        acesso_ate: string | null;
      }>();

    // Dados pessoais do admin logado — pré-preenchem a Etapa 1 (cadastro
    // completo) e o `nome` serve de exemplo no campo de slug.
    const { data: meuProfile } = await admin
      .from("profiles")
      .select(
        "nome, nome_legal, email, pais, documento_tipo, documento, telefone, data_nascimento"
      )
      .eq("id", r.sessao.userId)
      .maybeSingle<{
        nome: string | null;
        nome_legal: string | null;
        email: string | null;
        pais: string | null;
        documento_tipo: string | null;
        documento: string | null;
        telefone: string | null;
        data_nascimento: string | null;
      }>();

    // E-mail verificado? (auth.users.email_confirmed_at)
    const { data: authInfo } = await admin.auth.admin.getUserById(
      r.sessao.userId
    );
    const emailVerificado = !!authInfo?.user?.email_confirmed_at;

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
      // Estado REAL do workspace: ausência de sub = legado → "ok"; trial sem
      // data → "bloqueado". Nunca hardcodar o status.
      estadoAcesso: estadoAcessoDeSub(sub ?? null),
      // Validade do acesso (modelo pré-pago). Mantemos trialTerminaEm (legado).
      acessoAte: sub?.acesso_ate ?? null,
      adminContato: meuProfile?.nome ?? null,
      ciclo: sub?.ciclo ?? ws?.ciclo ?? "mensal",
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
        slug: ws.slug,
        whatsapp: ws.whatsapp,
        corAcento: ws.cor_acento,
        cidadeIbgeId: ws.cidade_ibge_id,
        cidadeNome: ws.cidade_nome,
        cidadeUf: ws.cidade_uf,
        logoUrl: ws.logo_url,
        // Pega só o primeiro nome, lowercase, sem acentos, só [a-z0-9].
        // Usado como exemplo no campo de slug (ex: "joao-twobookings").
        primeiroNomeAdmin:
          meuProfile?.nome
            ?.trim()
            .split(/\s+/)[0]
            ?.normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "") || null,
      },
      pessoa: {
        nome: meuProfile?.nome ?? "",
        nomeLegal: meuProfile?.nome_legal ?? "",
        email: meuProfile?.email ?? "",
        emailVerificado,
        pais: meuProfile?.pais ?? "BR",
        documentoTipo: meuProfile?.documento_tipo ?? null,
        documento: meuProfile?.documento ?? null,
        telefone: meuProfile?.telefone ?? null,
        dataNascimento: meuProfile?.data_nascimento ?? null,
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
 * mal. Disparado pela Etapa 4 (Equipe) do wizard: no fim do fluxo normal
 * ou no "Pular e finalizar".
 *
 * SEGURANÇA DE COBRANÇA: esta flag é a ÚNICA barreira que impede cair na
 * dashboard sem pagar (o guard do /app só manda pro onboarding enquanto
 * ela é false). Por isso VALIDAMOS no servidor antes de marcar:
 *  - precisa de plano pago OU trial real (402 se não);
 *  - precisa de pelo menos 1 artista (409 se não).
 * A única etapa pulável é a Equipe.
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
  const workspaceId = r.sessao.workspaceId;
  try {
    // Idempotência: se já concluiu, não revalida (evita travar quem já
    // está dentro caso a assinatura mude de estado depois).
    const { data: ws, error: errWs } = await admin
      .from("workspaces")
      .select("onboarding_completo")
      .eq("id", workspaceId)
      .single<{ onboarding_completo: boolean }>();
    if (errWs || !ws) {
      return NextResponse.json(
        { erro: "Workspace não encontrado." },
        { status: 404 }
      );
    }
    if (ws.onboarding_completo) {
      return NextResponse.json({ ok: true });
    }

    // 1) Plano pago ou trial real — senão manda de volta pra etapa do plano.
    const planoOk = await planoDoWorkspaceOk(admin, workspaceId);
    if (!planoOk) {
      return NextResponse.json(
        {
          erro:
            "Escolha um plano e conclua o pagamento (ou inicie o teste grátis) antes de finalizar.",
        },
        { status: 402 }
      );
    }

    // 2) Pelo menos 1 artista cadastrado.
    const nArtistas = await contarArtistasAtivos(admin, workspaceId);
    if (nArtistas < 1) {
      return NextResponse.json(
        { erro: "Cadastre pelo menos um artista antes de finalizar." },
        { status: 409 }
      );
    }

    const { error } = await admin
      .from("workspaces")
      .update({ onboarding_completo: true })
      .eq("id", workspaceId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao concluir onboarding." },
      { status: 500 }
    );
  }
}
