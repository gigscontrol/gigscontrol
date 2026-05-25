import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarOrcamentoPorId,
  atualizarOrcamentoPorId,
  removerOrcamentoPorId,
} from "@/lib/services/orcamentos.service";
import { orcamentoUpdateSchema } from "@/lib/validators/orcamentos.schema";
import {
  verificarAcessoOrcamentos,
  podeEditarOrcamento,
} from "@/lib/api/permissoes";
import { buscarOrcamento as repoBuscarOrcamento } from "@/lib/repositories/orcamentos.repo";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoOrcamentos(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const orcamento = await buscarOrcamentoPorId(r.sessao.supabase, params.id);
    if (!orcamento)
      return NextResponse.json({ erro: "Orçamento não encontrado." }, { status: 404 });
    return NextResponse.json({ orcamento });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar orçamento." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoOrcamentos(r.sessao);
  if (bloqueio) return bloqueio;

  // Vendedor com escopo restrito só edita os próprios
  const row = await repoBuscarOrcamento(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Orçamento não encontrado." }, { status: 404 });
  if (!podeEditarOrcamento(r.sessao, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para editar este orçamento." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = orcamentoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const orcamento = await atualizarOrcamentoPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    await auditAndNotify(r.sessao, {
      modulo: "orcamento",
      tipo: "editar",
      entidadeId: orcamento.id,
      entidadeNome: orcamento.numero,
      descricao: `Editou orçamento ${orcamento.numero}`,
    });
    return NextResponse.json({ orcamento });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar orçamento." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoOrcamentos(r.sessao);
  if (bloqueio) return bloqueio;

  const row = await repoBuscarOrcamento(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Orçamento não encontrado." }, { status: 404 });
  if (!podeEditarOrcamento(r.sessao, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para remover este orçamento." },
      { status: 403 }
    );
  }

  try {
    await removerOrcamentoPorId(r.sessao.supabase, params.id);
    await auditAndNotify(r.sessao, {
      modulo: "orcamento",
      tipo: "remover",
      entidadeId: row.id,
      entidadeNome: row.numero,
      descricao: `Removeu orçamento ${row.numero}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover orçamento." },
      { status: 500 }
    );
  }
}
