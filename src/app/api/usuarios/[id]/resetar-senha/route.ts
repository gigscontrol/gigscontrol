import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { resetarSenhaDoUsuario } from "@/lib/services/usuarios.service";

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
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao resetar senha." },
      { status: 500 }
    );
  }
}
