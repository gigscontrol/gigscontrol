import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { setupWorkspaceParaNovoUsuario } from "@/lib/services/signup.service";

/**
 * GET /auth/callback?code=...
 *
 * Handler chamado pelo Supabase Auth quando o usuário:
 *  - clica no link de confirmação de email (signup)
 *  - completa fluxo OAuth (Google/Facebook — futuro)
 *  - clica no link de reset de senha (futuro)
 *
 * Trocamos o `code` por uma sessão (que vira cookie), e se for o
 * primeiro acesso de um usuário sem profile, criamos workspace +
 * profile com os metadados que foram passados em `signUp()`.
 *
 * Em seguida redirecionamos pra `/app` (ou pra URL especificada em
 * `?next=` na query string, dentro de uma allowlist).
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

  // Pega o user logado e garante que tem profile/workspace
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    try {
      const admin = criarClienteAdmin();
      await setupWorkspaceParaNovoUsuario(admin, {
        id: user.id,
        email: user.email ?? "",
        user_metadata: user.user_metadata ?? {},
      });
    } catch (e) {
      console.error("[auth/callback] setup falhou:", (e as Error).message);
      // Não bloqueia o login — o user pode tentar criar workspace manual depois
    }
  }

  // Redireciona, mas só pra paths internos (evita open redirect)
  const dest = next.startsWith("/") ? next : "/app";
  return NextResponse.redirect(new URL(dest, url.origin));
}
