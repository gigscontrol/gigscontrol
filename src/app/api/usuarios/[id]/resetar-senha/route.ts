import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { resetarSenhaDoUsuario } from "@/lib/services/usuarios.service";
import { audit } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

/**
 * POST /api/usuarios/:id/resetar-senha
 * Gera nova senha temporária e atualiza no Supabase Auth. A nova senha é
 * devolvida UMA vez pra UI mostrar — não fica armazenada em nenhum lugar.
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const admin = criarClienteAdmin();
    const resultado = await resetarSenhaDoUsuario(admin, params.id);
    // Snapshot do nome
    const { data: snap } = await admin
      .from("profiles")
      .select("nome")
      .eq("id", params.id)
      .maybeSingle();
    await audit(r.sessao, {
      modulo: "equipe",
      tipo: "resetar-senha",
      entidadeId: params.id,
      entidadeNome: snap?.nome ?? null,
      descricao: `Resetou a senha de ${snap?.nome ?? "usuário"}`,
    });
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao resetar senha." },
      { status: 500 }
    );
  }
}
