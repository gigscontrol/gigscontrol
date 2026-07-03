import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarContratoPorId,
  atualizarContratoPorId,
  removerContratoPorId,
  resolverEscopoContrato,
} from "@/lib/services/contratos.service";
import {
  podeVerContrato,
  podeEditarContrato,
  podeExcluirContrato,
} from "@/lib/api/permissoes";
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
    // Gate por artista (via venda). 404 fora do escopo — não vaza existência.
    const { artistId } = await resolverEscopoContrato(r.sessao.supabase, contrato.vendaId);
    if (!podeVerContrato(r.sessao, artistId))
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    return NextResponse.json({ contrato });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar contrato." },
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
    const { artistId, criadoPor } = await resolverEscopoContrato(
      r.sessao.supabase,
      existente.vendaId
    );
    if (!podeEditarContrato(r.sessao, artistId, criadoPor))
      return NextResponse.json(
        { erro: "Você não tem permissão para editar este contrato." },
        { status: 403 }
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
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  try {
    const existente = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!existente)
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    const { artistId } = await resolverEscopoContrato(r.sessao.supabase, existente.vendaId);
    if (!podeExcluirContrato(r.sessao, artistId))
      return NextResponse.json(
        { erro: "Você não tem permissão para remover este contrato." },
        { status: 403 }
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
