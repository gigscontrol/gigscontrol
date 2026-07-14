import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarVendaPorId,
  atualizarVendaPorId,
  removerVendaPorId,
  vendaVisivelParaSessao,
} from "@/lib/services/vendas.service";
import { vendaUpdateSchema } from "@/lib/validators/vendas.schema";
import {
  verificarAcessoVendas,
  podeEditarVenda,
  podeExcluirVenda,
  verificarCriarVenda,
  redigirVendaParaSessao,
} from "@/lib/api/permissoes";
import { buscarVenda as repoBuscarVenda } from "@/lib/repositories/vendas.repo";
import { respostaDeErro } from "@/lib/api/erros";
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
    // Escopo por artista: 404 (não vaza) se a venda está fora do que a sessão vê.
    if (!(await vendaVisivelParaSessao(r.sessao.supabase, r.sessao, params.id)))
      return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 });
    const saida = redigirVendaParaSessao(r.sessao, venda);
    return NextResponse.json({ venda: saida });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar venda.");
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

  // IDOR de destino: se o PATCH move a venda (e o cachê/parcelas) para OUTRO
  // artista, exige permissão de criação no DESTINO — senão daria pra empurrar a
  // venda pra dentro de um artista sem vínculo. Espelha shows/[id] e agenda-items/[id].
  if (
    parsed.data.artist_id !== undefined &&
    (parsed.data.artist_id ?? null) !== row.artist_id
  ) {
    const bloqDestino = verificarCriarVenda(r.sessao, parsed.data.artist_id ?? null);
    if (bloqDestino) return bloqDestino;
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
    return NextResponse.json({ venda: redigirVendaParaSessao(r.sessao, venda) });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar venda.");
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
    await removerVendaPorId(r.sessao.supabase, params.id, r.sessao.userId);
    await auditAndNotify(r.sessao, {
      modulo: "venda",
      tipo: "remover",
      entidadeId: row.id,
      entidadeNome: row.numero,
      descricao: `Removeu venda ${row.numero}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover venda.");
  }
}
