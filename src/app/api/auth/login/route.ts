import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";

/**
 * POST /api/auth/login
 *
 * Corpo: { email: string, senha: string }
 *
 * Faz signInWithPassword no Supabase Auth. Em caso de sucesso, o cookie
 * de sessão é gravado automaticamente pelo cliente do servidor.
 */
export async function POST(request: Request) {
  let body: { email?: unknown; senha?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";

  if (!email || !senha) {
    return NextResponse.json(
      { erro: "Informe e-mail e senha." },
      { status: 400 }
    );
  }

  // Aceita handle (username) OU e-mail — sem "@" vira o e-mail interno
  // determinístico que o backend gera pra artistas e equipe.
  const emailAuth = email.includes("@")
    ? email
    : `${email.toLowerCase()}@interno.gigscontrol.app`;
  const supabase = criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailAuth,
    password: senha,
  });

  if (error || !data.user) {
    const msg =
      error?.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : error?.message ?? "Não foi possível entrar.";
    return NextResponse.json({ erro: msg }, { status: 401 });
  }

  // Busca o profile para devolver o tipo de conta
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_super_admin, status")
    .eq("id", data.user.id)
    .single<{ id: string; is_super_admin: boolean; status: string }>();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { erro: "Conta sem perfil configurado." },
      { status: 403 }
    );
  }

  if (profile.status !== "ativo") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { erro: "Esta conta está desativada." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    tipo: profile.is_super_admin ? "super-admin" : "cliente",
  });
}
