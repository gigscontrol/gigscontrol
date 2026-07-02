import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { resumoAssinantesDoWorkspace } from "@/lib/services/contratoSignatarios.service";

/**
 * GET /api/contratos/assinantes
 *
 * Resumo dos assinantes de TODOS os contratos do workspace, agrupado por
 * contrato: { [contratoId]: [{ nome, status, aberturas }] }. Usado pra pintar
 * as bolinhas de status (cinza/laranja/verde) nas listas de contrato numa
 * única chamada (em vez de N por contrato).
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const assinantes = await resumoAssinantesDoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId
    );
    return NextResponse.json({ assinantes });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar assinantes." },
      { status: 500 }
    );
  }
}
