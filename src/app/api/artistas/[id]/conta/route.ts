import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { emailEhInternoFake } from "@/lib/services/artistas.service";

/**
 * GET /api/artistas/[id]/conta
 *
 * Devolve dados da conta auth vinculada ao artista — usado pelo modal
 * de edição pra mostrar o email cadastrado e se foi verificado pelo
 * artista. Só admin.
 *
 * Resposta:
 *  {
 *    email: string,
 *    emailVerificado: boolean,
 *    emailFakeInterno: boolean,
 *    verificadoEm: string | null,
 *    ultimoLogin: string | null,
 *  }
 */
type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode ver a conta do artista." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();

  // Acha o profile vinculado a este artista
  const { data: profile, error: errProf } = await admin
    .from("profiles")
    .select("id")
    .eq("artista_id", params.id)
    .maybeSingle();

  if (errProf || !profile) {
    return NextResponse.json(
      { erro: "Artista sem usuário vinculado." },
      { status: 404 }
    );
  }

  try {
    // Busca os dados do auth user
    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error || !data.user) {
      throw new Error(error?.message ?? "Falha ao ler conta do artista.");
    }
    const user = data.user;
    const email = user.email ?? "";
    return NextResponse.json({
      email,
      emailVerificado: !!user.email_confirmed_at,
      emailFakeInterno: emailEhInternoFake(email),
      verificadoEm: user.email_confirmed_at ?? null,
      ultimoLogin: user.last_sign_in_at ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar conta." },
      { status: 500 }
    );
  }
}
