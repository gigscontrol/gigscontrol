import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarShowPorId,
  atualizarShowPorId,
  removerShowPorId,
} from "@/lib/services/shows.service";
import { showUpdateSchema } from "@/lib/validators/shows.schema";

type RouteCtx = { params: { id: string } };

/** GET /api/shows/:id */
export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  try {
    const show = await buscarShowPorId(r.sessao.supabase, params.id);
    if (!show) {
      return NextResponse.json(
        { erro: "Show não encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json({ show });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar show." },
      { status: 500 }
    );
  }
}

/** PATCH /api/shows/:id */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = showUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const show = await atualizarShowPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    return NextResponse.json({ show });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar show." },
      { status: 500 }
    );
  }
}

/** DELETE /api/shows/:id */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  try {
    await removerShowPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover show." },
      { status: 500 }
    );
  }
}
