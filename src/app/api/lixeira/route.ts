import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { listarLixeira } from "@/lib/services/lixeira.service";

/**
 * GET /api/lixeira — lista artistas e usuários na lixeira do workspace.
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    // Usa admin pra contornar RLS (a lista pode incluir items soft-deleted
    // que policies normais filtram).
    const admin = criarClienteAdmin();
    const lista = await listarLixeira(admin, r.sessao.workspaceId);
    return NextResponse.json(lista);
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar lixeira." },
      { status: 500 }
    );
  }
}
