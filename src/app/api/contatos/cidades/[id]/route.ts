import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarCidadePorId,
  atualizarCidadePorId,
  removerCidadePorId,
} from "@/lib/services/cidades.service";
import { cidadeUpdateSchema } from "@/lib/validators/contatos.schema";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const cidade = await buscarCidadePorId(r.sessao.supabase, params.id);
    if (!cidade)
      return NextResponse.json({ erro: "Cidade não encontrada." }, { status: 404 });
    return NextResponse.json({ cidade });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar cidade." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = cidadeUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const cidade = await atualizarCidadePorId(r.sessao.supabase, params.id, parsed.data);
    return NextResponse.json({ cidade });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar cidade." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  try {
    await removerCidadePorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover cidade." },
      { status: 500 }
    );
  }
}
