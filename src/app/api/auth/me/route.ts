import { NextResponse } from "next/server";
import { criarClienteServidor } from "@/lib/db/supabase-server";

/**
 * GET /api/auth/me
 *
 * Retorna o perfil do usuário logado + o workspace (quando aplicável).
 * Responde 401 se não houver sessão.
 */
export async function GET() {
  const supabase = criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const { data: profile, error: errProfile } = await supabase
    .from("profiles")
    .select(
      "id, workspace_id, nome, email, papel, is_super_admin, artista_id, escopo_vendedor, status"
    )
    .eq("id", user.id)
    .single();

  if (errProfile || !profile) {
    return NextResponse.json(
      { erro: "Conta sem perfil configurado." },
      { status: 403 }
    );
  }

  let workspace = null;
  if (!profile.is_super_admin && profile.workspace_id) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, nome, plano, slug, criado_em")
      .eq("id", profile.workspace_id)
      .single();
    workspace = ws ?? null;
  }

  return NextResponse.json({
    usuario: {
      id: profile.id,
      nome: profile.nome,
      email: profile.email,
      papel: profile.papel,
      ativo: profile.status === "ativo",
      artistaId: profile.artista_id,
      escopoVendedor: profile.escopo_vendedor,
    },
    tipo: profile.is_super_admin ? "super-admin" : "cliente",
    workspace,
  });
}
