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
      await setupWorkspaceParaNovoUsuario(admin, {
        id: user.id,
        email: user.email ?? "",
        user_metadata: meta,
      });
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
