import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * PATCH /api/perfil/cor — cor de identificação do PRÓPRIO avatar.
 *
 * Endpoint isolado de /api/perfil (que tem whitelist estrita e exclui `cor`
 * de propósito) porque esta cor grava SEMPRE em `profiles.cor`, mesmo pro
 * papel artista — é preferência de UI da CONTA (como o usuário aparece pros
 * outros dentro do app), não dado de pessoa/contrato (que pro artista mora em
 * `artists`). Não confundir com `artists.cor`, que é a cor de identificação
 * do ARTISTA/DJ na Agenda — essa é editada pelo admin em AbaArtistas.
 *
 * Anti-IDOR: não recebe id na URL nem no body — grava sempre em
 * `r.sessao.userId` (a PRÓPRIA linha). Não há superfície pra editar outro
 * usuário por aqui.
 *
 * A escrita em `profiles` está travada por RLS pro service_role/super-admin
 * (migration 57 — lockdown de auto-escalação), então precisa passar pelo
 * client admin igual às outras rotas de perfil/equipe.
 */
const schema = z.object({
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser um hex no formato #rrggbb"),
});

export async function PATCH(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Cor inválida." }, { status: 400 });
  }

  const admin = criarClienteAdmin();

  // Cor de IDENTIDADE. Pro ARTISTA grava em `artists.cor` (a mesma cor da
  // Agenda/roster/avatar — muda em TODO lugar, igual quando o admin edita em
  // AbaArtistas). Pra equipe/admin fica em `profiles.cor`. Anti-IDOR: sempre a
  // PRÓPRIA linha (artistaId/userId da sessão), nunca de outro.
  const ehArtista = r.sessao.papel === "artista" && r.sessao.artistaId;
  const { error } = ehArtista
    ? await admin
        .from("artists")
        .update({ cor: parsed.data.cor })
        .eq("id", r.sessao.artistaId as string)
        .eq("workspace_id", r.sessao.workspaceId)
    : await admin
        .from("profiles")
        .update({ cor: parsed.data.cor })
        .eq("id", r.sessao.userId);
  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cor: parsed.data.cor });
}
