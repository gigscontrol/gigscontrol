import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";

/**
 * POST /api/auth/login-handle  —  { handle: string, senha: string }
 *
 * FALLBACK do login por username (handle "usuario-slug"). Só é chamado
 * quando o login normal falha: o fluxo padrão deriva o e-mail interno
 * determinístico (`handle@interno.gigscontrol.app`) e loga direto — isso
 * cobre 100% de quem NÃO cadastrou um e-mail próprio.
 *
 * Quando o membro cadastra e verifica um e-mail real, o e-mail de auth da
 * conta passa a ser o real (o interno some), então a derivação determinística
 * não bate mais. Aqui resolvemos o handle → e-mail ATUAL da conta pelo
 * service-role (sem devolver o e-mail pro cliente, pra não vazar) e fazemos o
 * signIn no servidor — o cookie de sessão (compartilhado com o browser via
 * @supabase/ssr) é gravado automaticamente.
 *
 * Nunca revela se o handle existe: erro genérico e status 401 em qualquer
 * falha (credenciais, handle inexistente, conta desativada usa 403).
 */
export async function POST(request: Request) {
  let body: { handle?: unknown; senha?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const handle = typeof body.handle === "string" ? body.handle.trim().toLowerCase() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";

  // Esta rota é SÓ para handle (username). Login por e-mail real segue pelo
  // caminho normal do cliente.
  if (!handle || !senha || handle.includes("@")) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }

  // Resolve handle → conta pelo service-role (ignora RLS; leitura mínima).
  const admin = criarClienteAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, status")
    .eq("username", handle)
    .maybeSingle<{ id: string; status: string }>();

  if (!profile) {
    // Não revela que o handle não existe.
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }

  // E-mail ATUAL de auth da conta (pode ser o real já verificado).
  const { data: authInfo, error: errUser } = await admin.auth.admin.getUserById(profile.id);
  const emailAtual = authInfo?.user?.email ?? null;
  if (errUser || !emailAtual) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }

  // signIn no SERVIDOR: grava o cookie de sessão (lido depois pelo browser).
  const supabase = criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailAtual,
    password: senha,
  });
  if (error || !data.user) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, is_super_admin, status")
    .eq("id", data.user.id)
    .single<{ id: string; is_super_admin: boolean; status: string }>();

  if (!perfil) {
    await supabase.auth.signOut();
    return NextResponse.json({ erro: "Conta sem perfil configurado." }, { status: 403 });
  }
  if (perfil.status !== "ativo") {
    await supabase.auth.signOut();
    return NextResponse.json({ erro: "Esta conta está desativada." }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    tipo: perfil.is_super_admin ? "super-admin" : "cliente",
  });
}
