import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarVendaPorId,
  atualizarVendaPorId,
  removerVendaPorId,
  vendaVisivelParaSessao,
} from "@/lib/services/vendas.service";
import { vendaUpdateSchema } from "@/lib/validators/vendas.schema";
import { diffVenda, type AlteracaoVenda } from "@/lib/services/vendaDiff";
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
    // Snapshot ANTES da edição — insumo do rastro antifraude (o `row` acima é a
    // linha crua, sem parcelas mapeadas).
    const antesVenda = await buscarVendaPorId(r.sessao.supabase, params.id);

    const { venda, parcelasPreservadas } = await atualizarVendaPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );

    // RASTRO (D6): grava QUEM editou, QUANDO e O QUE mudou, campo a campo. O
    // diff é acessório — se ele falhar, a edição já commitou e continua valendo.
    let alteracoes: AlteracaoVenda[] = [];
    try {
      if (antesVenda) {
        alteracoes = await diffVenda(r.sessao.supabase, antesVenda, venda);
      }
    } catch (e) {
      console.error("[historico] falha ao montar o diff da venda (ignorada):", e);
    }

    const resumo = alteracoes.length
      ? ` — ${alteracoes
          .slice(0, 3)
          .map((a) => a.rotulo.toLowerCase())
          .join(", ")}${alteracoes.length > 3 ? ` e mais ${alteracoes.length - 3}` : ""}`
      : "";

    await auditAndNotify(r.sessao, {
      modulo: "venda",
      tipo: "editar",
      entidadeId: venda.id,
      entidadeNome: venda.numero,
      descricao: `Editou venda ${venda.numero}${resumo}`,
      dados: {
        versao: 1,
        alteracoes,
        // Só quando o PATCH mexeu em parcelas — senão a chave nem aparece.
        ...(parsed.data.parcelas !== undefined
          ? {
              parcelas: parcelasPreservadas
                ? { recalculadas: false, motivo: "parcela com histórico financeiro" }
                : { recalculadas: true },
            }
          : {}),
      },
    });

    return NextResponse.json({
      venda: redigirVendaParaSessao(r.sessao, venda),
      parcelasPreservadas,
    });
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
