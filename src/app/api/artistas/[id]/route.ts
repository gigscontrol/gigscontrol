import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  atualizarArtistaPorId,
  removerArtistaPorId,
} from "@/lib/services/artistas.service";
import { artistaUpdateSchema } from "@/lib/validators/artistas.schema";

type RouteCtx = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = artistaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const artista = await atualizarArtistaPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    return NextResponse.json({ artista });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar artista." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    await removerArtistaPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover artista." },
      { status: 500 }
    );
  }
}
