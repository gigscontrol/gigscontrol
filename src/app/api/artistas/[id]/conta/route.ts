import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { pertenceAoWorkspace } from "@/lib/api/pertence";
import { emailEhInternoFake } from "@/lib/services/artistas.service";
import { respostaDeErro } from "@/lib/api/erros";

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
 *    senhaPadrao: boolean,  // true = ainda com a senha aleatória gerada
 *    senhaPadraoValor: string | null,  // plaintext enquanto senhaPadrao=true
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

  // Isolamento multi-tenant: o admin client ignora RLS, então valida à mão.
  if (!(await pertenceAoWorkspace(admin, "artists", params.id, r.sessao.workspaceId))) {
    return NextResponse.json(
      { erro: "Artista sem usuário vinculado." },
      { status: 404 }
    );
  }

  // Acha o profile vinculado a este artista
  const { data: profile, error: errProf } = await admin
    .from("profiles")
    .select("id, senha_padrao, senha_padrao_valor")
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
      // Default-safe: se a coluna não existir num ambiente antigo, trata
      // como `false` (admin não vê alarme falso).
      senhaPadrao: !!(profile as { senha_padrao?: boolean }).senha_padrao,
      senhaPadraoValor:
        (profile as { senha_padrao_valor?: string | null })
          .senha_padrao_valor ?? null,
    });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar conta.");
  }
}
