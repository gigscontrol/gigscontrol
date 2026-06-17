import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { statusConexao, desconectar } from "@/lib/google/conexao";

/**
 * GET    /api/google/connection?artistaId=...  → { conectado, email }
 * DELETE /api/google/connection?artistaId=...  → desconecta (admin)
 *
 * Status da conexão Google de um artista (só o e-mail — nunca os tokens).
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const artistaId = new URL(request.url).searchParams.get("artistaId");
  if (!artistaId) {
    return NextResponse.json({ erro: "artistaId obrigatório." }, { status: 400 });
  }

  try {
    const status = await statusConexao(r.sessao.supabase, artistaId);
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao consultar conexão." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas o admin pode desconectar." },
      { status: 403 }
    );
  }

  const artistaId = new URL(request.url).searchParams.get("artistaId");
  if (!artistaId) {
    return NextResponse.json({ erro: "artistaId obrigatório." }, { status: 400 });
  }

  try {
    await desconectar(r.sessao.supabase, artistaId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao desconectar." },
      { status: 500 }
    );
  }
}
