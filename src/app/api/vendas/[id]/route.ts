import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarVendaPorId,
  atualizarVendaPorId,
  removerVendaPorId,
} from "@/lib/services/vendas.service";
import { vendaUpdateSchema } from "@/lib/validators/vendas.schema";
import {
  verificarAcessoVendas,
  podeEditarVenda,
  podeExcluirVenda,
} from "@/lib/api/permissoes";
import { buscarVenda as repoBuscarVenda } from "@/lib/repositories/vendas.repo";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoVendas(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const venda = await buscarVendaPorId(r.sessao.supabase, params.id);
    if (!venda)
      return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 });
    return NextResponse.json({ venda });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar venda." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoVendas(r.sessao);
  if (bloqueio) return bloqueio;

  const row = await repoBuscarVenda(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 });
  if (!podeEditarVenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para editar esta venda." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = vendaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const venda = await atualizarVendaPorId(r.sessao.supabase, params.id, parsed.data);
    await auditAndNotify(r.sessao, {
      modulo: "venda",
      tipo: "editar",
      entidadeId: venda.id,
      entidadeNome: venda.numero,
      descricao: `Editou venda ${venda.numero}`,
    });
    return NextResponse.json({ venda });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar venda." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoVendas(r.sessao);
  if (bloqueio) return bloqueio;

  const row = await repoBuscarVenda(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 });
  if (!podeExcluirVenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para remover esta venda." },
      { status: 403 }
    );
  }

  try {
    await removerVendaPorId(r.sessao.supabase, params.id);
    await auditAndNotify(r.sessao, {
      modulo: "venda",
      tipo: "remover",
      entidadeId: row.id,
      entidadeNome: row.numero,
      descricao: `Removeu venda ${row.numero}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover venda." },
      { status: 500 }
    );
  }
}
