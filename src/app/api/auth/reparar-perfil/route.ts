import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { setupWorkspaceParaNovoUsuario } from "@/lib/services/signup.service";

/**
 * POST /api/auth/reparar-perfil
 *
 * Auto-cura de conta órfã. Alguns cadastros por e-mail/senha ficaram só no
 * Supabase Auth (e-mail confirmado), SEM profile/workspace: o /auth/callback
 * da confirmação de e-mail não chegou a estabelecer sessão e rodar o setup.
 * No login isso caía em "Conta sem perfil configurado".
 *
 * Aqui, com o usuário JÁ autenticado (sessão válida logo após o
 * signInWithPassword), recriamos o que faltou a partir do user_metadata que
 * foi gravado no signup (nome_agencia, plano, ciclo). É idempotente — se o
 * profile já existe, `setupWorkspaceParaNovoUsuario` devolve criado:false.
 */
export async function POST() {
  const supabase = criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  try {
    const admin = criarClienteAdmin();
    const r = await setupWorkspaceParaNovoUsuario(admin, {
      id: user.id,
      email: user.email ?? "",
      user_metadata: user.user_metadata ?? null,
    });
    return NextResponse.json({ ok: true, criado: r.criado });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao reparar perfil." },
      { status: 500 }
    );
  }
}
