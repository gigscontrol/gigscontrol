import type { SupabaseClient } from "@supabase/supabase-js";
import { cripto, decripto } from "./cripto";
import { renovarAccessToken } from "./oauth";

/**
 * Camada de persistência da conexão Google Calendar por artista.
 *
 * Os tokens ficam na tabela `artist_google_calendar`, CRIPTOGRAFADOS. Só o
 * backend mexe aqui — o que vai pro client é apenas `{ conectado, email }`.
 */

const TABELA = "artist_google_calendar";

/** Status pro client — só e-mail, nunca os tokens. */
export async function statusConexao(
  supabase: SupabaseClient,
  artistaId: string
): Promise<{ conectado: boolean; email: string | null }> {
  const { data } = await supabase
    .from(TABELA)
    .select("google_email")
    .eq("artist_id", artistaId)
    .maybeSingle();
  const email = (data as { google_email?: string } | null)?.google_email ?? null;
  return { conectado: !!email, email };
}

export async function salvarConexao(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    artistaId: string;
    email: string;
    refreshToken: string;
    accessToken: string;
    expiresIn: number;
    calendarId?: string;
  }
): Promise<void> {
  const expiraEm = new Date(
    Date.now() + (params.expiresIn - 60) * 1000
  ).toISOString();
  const { error } = await supabase.from(TABELA).upsert(
    {
      workspace_id: params.workspaceId,
      artist_id: params.artistaId,
      google_email: params.email,
      refresh_token: cripto(params.refreshToken),
      access_token: cripto(params.accessToken),
      token_expira_em: expiraEm,
      calendar_id: params.calendarId ?? "primary",
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "artist_id" }
  );
  if (error) throw new Error(`Falha ao salvar conexão Google: ${error.message}`);
}

export async function desconectar(
  supabase: SupabaseClient,
  artistaId: string
): Promise<void> {
  const { error } = await supabase.from(TABELA).delete().eq("artist_id", artistaId);
  if (error) throw new Error(`Falha ao desconectar: ${error.message}`);
}

/**
 * Devolve um access token VÁLIDO pro artista (renova via refresh token se
 * expirou) + o calendarId. Retorna null se o artista não tem conexão.
 * Usado pelo backend ao criar o evento (Fase 2).
 */
export async function accessTokenValido(
  supabase: SupabaseClient,
  artistaId: string
): Promise<{ accessToken: string; calendarId: string } | null> {
  const { data } = await supabase
    .from(TABELA)
    .select("refresh_token, access_token, token_expira_em, calendar_id")
    .eq("artist_id", artistaId)
    .maybeSingle();
  if (!data) return null;

  const row = data as {
    refresh_token: string;
    access_token: string | null;
    token_expira_em: string | null;
    calendar_id: string | null;
  };
  const calendarId = row.calendar_id ?? "primary";
  const expira = row.token_expira_em ? new Date(row.token_expira_em).getTime() : 0;

  // Access token ainda válido — usa direto.
  if (row.access_token && expira > Date.now()) {
    return { accessToken: decripto(row.access_token), calendarId };
  }

  // Expirado/ausente — renova com o refresh token e regrava.
  const novo = await renovarAccessToken(decripto(row.refresh_token));
  const expiraEm = new Date(Date.now() + (novo.expiresIn - 60) * 1000).toISOString();
  await supabase
    .from(TABELA)
    .update({
      access_token: cripto(novo.accessToken),
      token_expira_em: expiraEm,
      atualizado_em: new Date().toISOString(),
    })
    .eq("artist_id", artistaId);
  return { accessToken: novo.accessToken, calendarId };
}
