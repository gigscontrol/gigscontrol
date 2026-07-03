import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { resumoAssinantesDoWorkspace } from "@/lib/services/contratoSignatarios.service";
import { listarContratosDoWorkspace } from "@/lib/services/contratos.service";
import { verTodosContratos } from "@/lib/api/permissoes";

/**
 * GET /api/contratos/assinantes
 *
 * Resumo dos assinantes de TODOS os contratos do workspace, agrupado por
 * contrato: { [contratoId]: [{ nome, status, aberturas }] }. Usado pra pintar
 * as bolinhas de status (cinza/laranja/verde) nas listas de contrato numa
 * única chamada (em vez de N por contrato).
 *
 * Escopado por artista: quem não vê todos os contratos (operacional com vínculo
 * / artista) só recebe o resumo dos contratos que enxerga na lista.
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const assinantes = await resumoAssinantesDoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId
    );
    if (verTodosContratos(r.sessao)) {
      return NextResponse.json({ assinantes });
    }
    // Restringe o resumo aos contratos visíveis pelo usuário.
    const visiveis = await listarContratosDoWorkspace(r.sessao.supabase, r.sessao);
    const idsVisiveis = new Set(visiveis.map((c) => c.id));
    const filtrado = Object.fromEntries(
      Object.entries(assinantes).filter(([contratoId]) => idsVisiveis.has(contratoId))
    );
    return NextResponse.json({ assinantes: filtrado });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar assinantes." },
      { status: 500 }
    );
  }
}
