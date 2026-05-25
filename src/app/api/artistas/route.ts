import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarArtistasDoWorkspace,
  criarArtistaNoWorkspace,
  LimitePlanoAtingidoError,
} from "@/lib/services/artistas.service";
import { artistaCreateSchema } from "@/lib/validators/artistas.schema";
import type { PlanoId } from "@/lib/planos";
import { auditAndNotify } from "@/lib/services/historico.service";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const artistas = await listarArtistasDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ artistas });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar artistas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = artistaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Busca o plano do workspace para checar o limite
  const { data: ws, error: wsError } = await r.sessao.supabase
    .from("workspaces")
    .select("plano")
    .eq("id", r.sessao.workspaceId)
    .single();
  if (wsError || !ws) {
    return NextResponse.json(
      { erro: "Workspace não encontrado." },
      { status: 404 }
    );
  }

  try {
    const artista = await criarArtistaNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      ws.plano as PlanoId,
      parsed.data
    );
    await auditAndNotify(r.sessao, {
      modulo: "artista",
      tipo: "criar",
      entidadeId: artista.id,
      entidadeNome: artista.name,
      descricao: `Cadastrou o artista ${artista.name}`,
    });
    return NextResponse.json({ artista }, { status: 201 });
  } catch (e) {
    if (e instanceof LimitePlanoAtingidoError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar artista." },
      { status: 500 }
    );
  }
}
