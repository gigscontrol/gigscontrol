import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarShowsDoWorkspace,
  criarShowNoWorkspace,
} from "@/lib/services/shows.service";
import { showCreateSchema } from "@/lib/validators/shows.schema";
import { podeCriarAgenda } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

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
    return respostaDeErro(e, "Falha ao listar shows.");
  }
}

/**
 * POST /api/shows
 * Cria um show no workspace ativo.
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
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

  if (!podeCriarAgenda(r.sessao, parsed.data.artist_id ?? null)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para criar na agenda deste artista." },
      { status: 403 }
    );
  }

  try {
    const show = await criarShowNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ show }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e, "Falha ao criar show.");
  }
}
