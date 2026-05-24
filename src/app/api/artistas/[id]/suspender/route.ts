import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { alternarSuspensaoArtista } from "@/lib/services/artistas.service";

type RouteCtx = { params: { id: string } };

/**
 * POST /api/artistas/:id/suspender — toggle do flag acesso_suspenso.
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const artista = await alternarSuspensaoArtista(r.sessao.supabase, params.id);
    return NextResponse.json({ artista });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao alternar suspensão." },
      { status: 500 }
    );
  }
}
