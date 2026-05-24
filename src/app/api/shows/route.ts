import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarShowsDoWorkspace,
  criarShowNoWorkspace,
} from "@/lib/services/shows.service";
import { showCreateSchema } from "@/lib/validators/shows.schema";

/**
 * GET /api/shows
 * Lista os shows do workspace ativo.
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  try {
    const shows = await listarShowsDoWorkspace(r.sessao.supabase, r.sessao);
    return NextResponse.json({ shows });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar shows." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shows
 * Cria um show no workspace ativo.
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = showCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const show = await criarShowNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data
    );
    return NextResponse.json({ show }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar show." },
      { status: 500 }
    );
  }
}
