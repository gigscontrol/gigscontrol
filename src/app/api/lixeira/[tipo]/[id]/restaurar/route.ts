import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import {
  restaurarArtistaDaLixeira,
  restaurarUsuarioDaLixeira,
} from "@/lib/services/lixeira.service";

type RouteCtx = { params: { tipo: string; id: string } };

/**
 * POST /api/lixeira/:tipo/:id/restaurar — tira da lixeira.
 * `tipo` ∈ { 'artista', 'usuario' }.
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const admin = criarClienteAdmin();
    if (params.tipo === "artista") {
      await restaurarArtistaDaLixeira(admin, params.id);
    } else if (params.tipo === "usuario") {
      await restaurarUsuarioDaLixeira(admin, params.id);
    } else {
      return NextResponse.json(
        { erro: `Tipo inválido: ${params.tipo}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao restaurar." },
      { status: 500 }
    );
  }
}
