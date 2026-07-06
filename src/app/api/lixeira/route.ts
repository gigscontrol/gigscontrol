import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { respostaDeErro } from "@/lib/api/erros";
import { verificarAdminDoWorkspace } from "@/lib/api/permissoes";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { listarLixeira } from "@/lib/services/lixeira.service";

/**
 * GET /api/lixeira — lista artistas e usuários na lixeira do workspace.
 * Admin-only: a lixeira usa o client admin (ignora RLS) e devolve PII +
 * cachês de itens deletados; espelha o gate admin-only da UI (MiniLixeira).
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const g = verificarAdminDoWorkspace(r.sessao);
  if (g) return g;
  try {
    // Usa admin pra contornar RLS (a lista pode incluir items soft-deleted
    // que policies normais filtram).
    const admin = criarClienteAdmin();
    const lista = await listarLixeira(admin, r.sessao.workspaceId);
    return NextResponse.json(lista);
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar lixeira.");
  }
}
