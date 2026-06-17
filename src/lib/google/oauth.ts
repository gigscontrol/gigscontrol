import crypto from "crypto";

/**
 * Cliente OAuth 2.0 do Google (sem dependência externa — usa fetch direto
 * nos endpoints REST). Cobre: montar a URL de consentimento, trocar o
 * `code` por tokens, renovar o access token e extrair o e-mail conectado.
 *
 * Escopos: `calendar.events` (criar/editar eventos) + `openid email` (pra
 * descobrir qual conta foi conectada, via id_token).
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const ESCOPOS = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

function clientId(): string {
  const v = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_OAUTH_CLIENT_ID não configurada.");
  return v;
}

function clientSecret(): string {
  const v = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET não configurada.");
  return v;
}

function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/google/callback`;
}

// ----------------- state assinado (anti-CSRF + contexto) -----------------
//
// O `state` carrega qual artista/workspace está conectando, assinado com
// HMAC (chave = client secret, server-only) pra ninguém forjar o callback.

type StatePayload = { artistaId: string; workspaceId: string; exp: number };

export function assinarState(
  dados: { artistaId: string; workspaceId: string },
  ttlSegundos = 600
): string {
  const payload: StatePayload = {
    ...dados,
    exp: Math.floor(Date.now() / 1000) + ttlSegundos,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", clientSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verificarState(state: string): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const esperado = crypto
    .createHmac("sha256", clientSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as StatePayload;
    if (!p.artistaId || !p.workspaceId) return null;
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

// ----------------- fluxo OAuth -----------------

export function urlAutorizacao(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ESCOPOS.join(" "),
    access_type: "offline", // pede refresh token
    prompt: "consent", // garante refresh token mesmo em reconexão
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type TokensGoogle = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number; // segundos
  email: string | null;
};

export async function trocarCodePorTokens(code: string): Promise<TokensGoogle> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google recusou o code (${res.status}): ${await res.text()}`);
  }
  const d = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token ?? null,
    expiresIn: d.expires_in ?? 3600,
    email: emailDoIdToken(d.id_token),
  };
}

export async function renovarAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao renovar token (${res.status}): ${await res.text()}`);
  }
  const d = (await res.json()) as { access_token: string; expires_in?: number };
  return { accessToken: d.access_token, expiresIn: d.expires_in ?? 3600 };
}

/** Extrai o e-mail do id_token (JWT) sem validar assinatura — só leitura. */
function emailDoIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}
