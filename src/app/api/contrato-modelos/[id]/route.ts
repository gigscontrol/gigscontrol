import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarModeloPorId,
  atualizarModeloPorId,
  removerModeloPorId,
} from "@/lib/services/contratoModelos.service";
import { contratoModeloUpdateSchema } from "@/lib/validators/contratoModelos.schema";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const modelo = await buscarModeloPorId(r.sessao.supabase, params.id);
    if (!modelo)
      return NextResponse.json({ erro: "Modelo não encontrado." }, { status: 404 });
    return NextResponse.json({ modelo });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar modelo." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas administradores podem editar modelos." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratoModeloUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const existente = await buscarModeloPorId(r.sessao.supabase, params.id);
    if (!existente)
      return NextResponse.json({ erro: "Modelo não encontrado." }, { status: 404 });
    const modelo = await atualizarModeloPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    return NextResponse.json({ modelo });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar modelo." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas administradores podem remover modelos." },
      { status: 403 }
    );
  }

  try {
    const existente = await buscarModeloPorId(r.sessao.supabase, params.id);
    if (!existente)
      return NextResponse.json({ erro: "Modelo não encontrado." }, { status: 404 });
    await removerModeloPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover modelo." },
      { status: 500 }
    );
  }
}
