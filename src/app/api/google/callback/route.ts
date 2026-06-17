import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarState, trocarCodePorTokens } from "@/lib/google/oauth";
import { salvarConexao } from "@/lib/google/conexao";

/**
 * GET /api/google/callback?code=...&state=...
 *
 * Google redireciona pra cá depois do consentimento (no mesmo navegador do
 * admin, então a sessão está nos cookies). Valida o state, troca o code por
 * tokens, guarda criptografado no artista certo e volta pro perfil.
 */
function voltarPerfil(
  base: string,
  params: { google: "ok" | "erro"; artista?: string; email?: string; msg?: string }
) {
  const url = new URL(`${base.replace(/\/$/, "")}/app/agencia/artistas`);
  url.searchParams.set("google", params.google);
  if (params.artista) url.searchParams.set("artista", params.artista);
  if (params.email) url.searchParams.set("email", params.email);
  if (params.msg) url.searchParams.set("msg", params.msg);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const erroGoogle = searchParams.get("error");

  if (erroGoogle) {
    return voltarPerfil(base, { google: "erro", msg: "Acesso negado no Google." });
  }
  if (!code || !state) {
    return voltarPerfil(base, { google: "erro", msg: "Retorno incompleto do Google." });
  }

  const st = verificarState(state);
  if (!st) {
    return voltarPerfil(base, { google: "erro", msg: "State inválido ou expirado." });
  }

  // Precisa do admin logado (mesmo workspace) pra gravar via RLS.
  const r = await autenticarComWorkspace();
  if ("response" in r) {
    return voltarPerfil(base, { google: "erro", msg: "Sessão expirada — entre e reconecte." });
  }
  if (r.sessao.papel !== "admin" || r.sessao.workspaceId !== st.workspaceId) {
    return voltarPerfil(base, { google: "erro", msg: "Sem permissão." });
  }

  try {
    const tokens = await trocarCodePorTokens(code);
    if (!tokens.refreshToken) {
      return voltarPerfil(base, {
        google: "erro",
        artista: st.artistaId,
        msg: "Google não devolveu refresh token. Remova o acesso em myaccount.google.com/permissions e reconecte.",
      });
    }
    await salvarConexao(r.sessao.supabase, {
      workspaceId: st.workspaceId,
      artistaId: st.artistaId,
      email: tokens.email ?? "(conta Google)",
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    });
    return voltarPerfil(base, {
      google: "ok",
      artista: st.artistaId,
      email: tokens.email ?? undefined,
    });
  } catch (e) {
    return voltarPerfil(base, {
      google: "erro",
      artista: st.artistaId,
      msg: (e as Error).message ?? "Falha ao conectar.",
    });
  }
}
