import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarCasaPorId,
  atualizarCasaPorId,
  removerCasaPorId,
} from "@/lib/services/casas.service";
import { casaUpdateSchema } from "@/lib/validators/contatos.schema";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const casa = await buscarCasaPorId(r.sessao.supabase, params.id);
    if (!casa) return NextResponse.json({ erro: "Casa não encontrada." }, { status: 404 });
    return NextResponse.json({ casa });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar casa." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = casaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const casa = await atualizarCasaPorId(r.sessao.supabase, params.id, parsed.data);
    return NextResponse.json({ casa });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar casa." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    await removerCasaPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover casa." },
      { status: 500 }
    );
  }
}
