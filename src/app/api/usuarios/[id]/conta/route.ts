import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { emailEhInternoFake } from "@/lib/services/artistas.service";

/**
 * GET /api/usuarios/[id]/conta
 *
 * Devolve dados da conta auth do membro da equipe — usado pelo modal
 * de edição em AbaEquipe pra mostrar se a senha ainda é a padrão
 * (gerada pelo sistema) e, em caso afirmativo, o valor em plaintext
 * pra admin conseguir copiar de novo.
 *
 * Equivalente ao /api/artistas/[id]/conta. Apenas admin.
 *
 * Resposta:
 *  {
 *    email: string,
 *    emailVerificado: boolean,
 *    ultimoLogin: string | null,
 *    senhaPadrao: boolean,           // true = ainda com a senha aleatória gerada
 *    senhaPadraoValor: string | null // plaintext enquanto senhaPadrao=true
 *  }
 */
type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas admin pode ver a conta de membros da equipe." },
      { status: 403 }
    );
  }

  const admin = criarClienteAdmin();

  // Garante que o usuário pertence ao mesmo workspace do admin
  // (isolamento por workspace — admin de uma agência não pode ver
  // dados de equipe de outra).
  const { data: profile, error: errProf } = await admin
    .from("profiles")
    .select("id, workspace_id, papel, senha_padrao, senha_padrao_valor")
    .eq("id", params.id)
    .maybeSingle();

  if (errProf || !profile) {
    return NextResponse.json(
      { erro: "Usuário não encontrado." },
      { status: 404 }
    );
  }

  if (profile.workspace_id !== r.sessao.workspaceId) {
    return NextResponse.json(
      { erro: "Usuário pertence a outro workspace." },
      { status: 403 }
    );
  }

  try {
    const { data, error } = await admin.auth.admin.getUserById(params.id);
    if (error || !data.user) {
      throw new Error(error?.message ?? "Falha ao ler conta do usuário.");
    }
    const user = data.user;
    const email = user.email ?? "";
    return NextResponse.json({
      email,
      emailVerificado: !!user.email_confirmed_at,
      // Membros novos nascem com e-mail fake interno (login por handle).
      // A UI usa isso pra mostrar "Sem e-mail" em vez do endereço fake.
      emailFakeInterno: emailEhInternoFake(email),
      ultimoLogin: user.last_sign_in_at ?? null,
      senhaPadrao: !!(profile as { senha_padrao?: boolean }).senha_padrao,
      senhaPadraoValor:
        (profile as { senha_padrao_valor?: string | null })
          .senha_padrao_valor ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar conta." },
      { status: 500 }
    );
  }
}
