import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { setupWorkspaceParaNovoUsuario } from "@/lib/services/signup.service";
import { ehEmailInterno } from "@/lib/email-interno";

/**
 * GET /auth/callback?code=...
 *
 * Handler chamado pelo Supabase Auth quando o usuário:
 *  - clica no link de confirmação de email (signup com email/senha)
 *  - completa fluxo OAuth (Google / Facebook)
 *  - clica no link de reset de senha (esse vai direto pra /reset-password
 *    com sessão temporária)
 *
 * Decisão de pra onde redirecionar:
 *  - Já tem profile → /app (login normal de quem já é cadastrado)
 *  - Sem profile mas user_metadata tem nome_agencia + plano_escolhido
 *    (signup email/senha) → cria workspace+profile via
 *    setupWorkspaceParaNovoUsuario → /app
 *  - Sem profile e sem nome_agencia (OAuth 1ª vez) → /signup/completar
 *    pra preencher nome da agência + plano antes do app abrir
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?erro=callback-sem-code", url.origin)
    );
  }

  const supabase = criarClienteServidor();
  const { error: errEx } = await supabase.auth.exchangeCodeForSession(code);
  if (errEx) {
    return NextResponse.redirect(
      new URL(
        `/login?erro=${encodeURIComponent(errEx.message)}`,
        url.origin
      )
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  // ─── Lock de método de login ──────────────────────────────────────────
  // O Supabase VINCULA automaticamente contas com o mesmo e-mail
  // (auto-linking). Sem isso, quem cadastrou com e-mail/senha consegue
  // entrar pelo Facebook só por ter o mesmo e-mail lá — e vice-versa.
  //
  // Regra: o método ORIGINAL do cadastro é a identity de MENOR created_at.
  // Se o provider usado AGORA for diferente do original, derruba a sessão e
  // manda de volta pro /login explicando qual método usar. Nunca deixa a
  // sessão cruzada seguir adiante.
  //
  // Casos que NÃO bloqueiam (de propósito — na dúvida, deixa entrar):
  //  - identities vazio/ausente, ou sem created_at: sem informação pra decidir.
  //  - empate no menor created_at: o "original" seria decidido pela ordem do
  //    array do GoTrue (sem ORDER BY garantido) e alternaria entre requests.
  //  - conta nova de OAuth (1 identity só): original == atual, esse vira o
  //    método dela.
  //  - provider atual não-OAuth (link de confirmação de e-mail): ver abaixo.
  // Este caminho só é percorrido por OAuth e links de confirmação; login
  // por senha (signInWithPassword, inclusive o de username interno de
  // equipe/artista) não passa por aqui e segue intacto.
  const identities = user.identities ?? [];

  // Descarta identities sem created_at: o campo é opcional no SDK, e o antigo
  // `?? 0` transformava a identity SEM data na mais ANTIGA (epoch 1970),
  // elegendo ativamente um metodoOriginal ERRADO e bloqueando conta legítima.
  const ordenadas = identities
    .filter((i) => !!i.created_at)
    .sort(
      (a, b) =>
        new Date(a.created_at as string).getTime() -
        new Date(b.created_at as string).getTime()
    );
  const empateNoMaisAntigo =
    ordenadas.length > 1 &&
    new Date(ordenadas[0].created_at as string).getTime() ===
      new Date(ordenadas[1].created_at as string).getTime();
  const metodoOriginal = empateNoMaisAntigo ? undefined : ordenadas[0]?.provider;

  // Provider usado AGORA. ATENÇÃO: `app_metadata.provider` NÃO serve pra isso
  // — o GoTrue grava esse campo na CRIAÇÃO do usuário e nunca mais mexe (o
  // que acumula os vinculados é o array `app_metadata.providers`, no plural).
  // Como metodoOriginal também é o provider de cadastro, comparar os dois era
  // comparar a mesma informação pela mesma fonte: sempre iguais, o `if` nunca
  // entrava e o lock não existia de fato. A fonte por-login é o
  // `last_sign_in_at` da identity, que o GoTrue carimba na identity usada
  // neste sign-in. Fallback pro campo antigo se vier tudo sem data.
  const maisRecente = identities
    .filter((i) => !!i.last_sign_in_at)
    .sort(
      (a, b) =>
        new Date(b.last_sign_in_at as string).getTime() -
        new Date(a.last_sign_in_at as string).getTime()
    )[0];

  // GUARDA ANTI-LOCKOUT (a mais importante deste arquivo). Só confiamos no
  // carimbo se ele for DESTE sign-in — que acabou de acontecer, milissegundos
  // atrás. Se o mais novo estiver velho, o GoTrue não recarimbou agora e o
  // "mais recente" degrada pra "identity mais nova": aí uma identity Facebook
  // auto-vinculada (o Supabase a cria ANTES deste callback rodar, e ela
  // sobrevive ao bloqueio) venceria pra sempre, e todo login legítimo por
  // Google passaria a ser barrado com "entre com Google" — loop infinito, e
  // conta só-OAuth sem senha fica trancada pra fora. Sem informação confiável
  // sobre quem assinou agora, a resposta é NÃO BLOQUEAR.
  const RECENTE_MS = 5 * 60 * 1000;
  const carimboEhDesteLogin =
    !!maisRecente?.last_sign_in_at &&
    Date.now() - new Date(maisRecente.last_sign_in_at as string).getTime() <=
      RECENTE_MS;
  const porUltimoLogin = carimboEhDesteLogin ? maisRecente?.provider : undefined;
  // Fallback pro campo congelado da criação: ele é IGUAL ao metodoOriginal, então
  // o `if` abaixo nunca dispara — ou seja, o fallback é deliberadamente fail-open.
  const providerAtual =
    porUltimoLogin ?? (user.app_metadata?.provider as string | undefined);

  // Só OAuth morde. Este callback também recebe link de confirmação de e-mail
  // (provider "email"): bloquear ali quebraria o auto-sync de e-mail do membro
  // e a confirmação de e-mail real de quem entrou por OAuth. O vetor que o
  // lock existe pra fechar é o inverso — OAuth entrando em conta de e-mail.
  const ehOAuth = providerAtual === "google" || providerAtual === "facebook";

  if (ehOAuth && metodoOriginal && metodoOriginal !== providerAtual) {
    // scope "local": mata só a sessão cruzada que acabou de nascer nos
    // cookies desta requisição. O padrão do supabase-js é "global", que
    // revogaria as sessões legítimas do usuário em TODOS os dispositivos —
    // uma tentativa de login barrada viraria logout universal, e como o
    // endpoint é público isso seria negação de serviço contra a conta.
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(
      new URL(
        `/login?erro=metodo&use=${encodeURIComponent(metodoOriginal)}`,
        url.origin
      )
    );
  }

  // Já tem profile? Login normal.
  const admin = criarClienteAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle<{ id: string; email: string | null }>();
  if (profile) {
    // Auto-sync do e-mail de acesso: quando o próprio membro confirma o
    // e-mail real que cadastrou (updateUser → link de confirmação → aqui),
    // o auth.users.email vira o real, mas o profiles.email pode continuar
    // com o fake interno. Sem alinhar, a sessão segue mostrando o fake
    // "verificado" (AbaPerfil / AcessoCard). Fonte da verdade = auth.users.
    // Best-effort: nunca bloqueia o login.
    const emailReal = user.email ?? "";
    if (
      emailReal &&
      emailReal !== profile.email &&
      !ehEmailInterno(emailReal)
    ) {
      try {
        await admin
          .from("profiles")
          .update({ email: emailReal })
          .eq("id", user.id);
      } catch (e) {
        console.error(
          "[auth/callback] sync profiles.email falhou:",
          (e as Error).message
        );
      }
    }
    const dest = next.startsWith("/") ? next : "/app";
    return NextResponse.redirect(new URL(dest, url.origin));
  }

  // Sem profile = primeiro acesso.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const temDadosCompletos =
    typeof meta.nome_agencia === "string" &&
    !!(meta.nome_agencia as string).trim() &&
    typeof meta.plano_escolhido === "string";

  if (temDadosCompletos) {
    // Veio do /signup com email/senha — tudo no metadata.
    try {
      await setupWorkspaceParaNovoUsuario(
        admin,
        {
          id: user.id,
          email: user.email ?? "",
          user_metadata: meta,
        },
        request.headers.get("x-vercel-ip-country")
      );
    } catch (e) {
      console.error("[auth/callback] setup falhou:", (e as Error).message);
    }
    // Primeiro acesso → wizard de onboarding. O próprio wizard cuida da
    // escolha de plano e do trial grátis na Etapa 2.
    return NextResponse.redirect(new URL("/onboarding", url.origin));
  }

  // Veio de OAuth (Google/Facebook) sem dados de agência —
  // manda pra tela de completar o cadastro.
  return NextResponse.redirect(new URL("/signup/completar", url.origin));
}
