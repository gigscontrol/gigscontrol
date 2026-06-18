import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarContratoPorId,
  atualizarContratoPorId,
  removerContratoPorId,
} from "@/lib/services/contratos.service";
import { contratoUpdateSchema } from "@/lib/validators/contratos.schema";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const contrato = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!contrato)
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    return NextResponse.json({ contrato });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar contrato." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas administradores podem editar contratos." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const existente = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!existente)
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    const contrato = await atualizarContratoPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    return NextResponse.json({ contrato });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar contrato." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  if (r.sessao.papel !== "admin") {
    return NextResponse.json(
      { erro: "Apenas administradores podem remover contratos." },
      { status: 403 }
    );
  }

  try {
    const existente = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!existente)
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    await removerContratoPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover contrato." },
      { status: 500 }
    );
  }
}
