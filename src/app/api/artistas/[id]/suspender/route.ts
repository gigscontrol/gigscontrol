import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAdminDoWorkspace } from "@/lib/api/permissoes";
import { alternarSuspensaoArtista } from "@/lib/services/artistas.service";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

/**
 * POST /api/artistas/:id/suspender — toggle do flag acesso_suspenso.
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const g = verificarAdminDoWorkspace(r.sessao);
  if (g) return g;
  try {
    const artista = await alternarSuspensaoArtista(r.sessao.supabase, params.id);
    await auditAndNotify(r.sessao, {
      modulo: "artista",
      tipo: "suspender",
      entidadeId: artista.id,
      entidadeNome: artista.name,
      descricao: artista.acessoSuspenso
        ? `Suspendeu o acesso do artista ${artista.name}`
        : `Reativou o acesso do artista ${artista.name}`,
    });
    return NextResponse.json({ artista });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao alternar suspensão." },
      { status: 500 }
    );
  }
}
