import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { buscarVendaPorId } from "@/lib/services/vendas.service";
import { buscarVenda as repoBuscarVenda } from "@/lib/repositories/vendas.repo";
import { listarParcelasDaVenda } from "@/lib/repositories/parcelas.repo";
import { podeCancelarVenda, redigirVendaParaSessao } from "@/lib/api/permissoes";
import { auditAndNotify } from "@/lib/services/historico.service";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/**
 * POST /api/vendas/:id/cancelar — CANCELA a venda (D5).
 *
 * Gated por `podeCancelarVenda` (autoria v2: `vendas.cancelar_proprios` para a
 * venda criada por ele × `vendas.cancelar_outros` para a de outros; admin
 * sempre). Cancelar ≠ excluir — excluir venda é admin-only. Efeitos:
 *   1) vendas.status = 'cancelada' — a venda some dos dashboards e do "a receber",
 *      mas continua no histórico com badge;
 *   2) as parcelas NÃO pagas são canceladas usando o MESMO mecanismo do
 *      cancelamento avulso de parcela (parcelas.meta.cancelamento via
 *      merge_parcela_meta), com motivo "Venda cancelada". As já pagas ficam
 *      como estão (o dinheiro já entrou — permanece no "recebido").
 *
 * Body (opcional): { motivo?: string } — anexado ao motivo do cancelamento.
 */
export async function POST(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await repoBuscarVenda(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 });
  if (!podeCancelarVenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para cancelar esta venda." },
      { status: 403 }
    );
  }

  // Motivo é opcional; se vier, é anexado. Body ausente/inválido → sem motivo.
  let motivo = "";
  try {
    const raw = (await request.json()) as { motivo?: unknown } | null;
    const m = raw?.motivo;
    if (typeof m === "string") motivo = m.trim().slice(0, 1000);
  } catch {
    // sem corpo — segue sem motivo
  }

  // Idempotência: já cancelada → devolve o estado atual sem re-carimbar parcelas.
  if (row.status === "cancelada") {
    const atual = await buscarVendaPorId(r.sessao.supabase, params.id);
    if (!atual)
      return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 });
    const saidaAtual = redigirVendaParaSessao(r.sessao, atual);
    return NextResponse.json({ venda: saidaAtual });
  }

  const agora = new Date().toISOString();
  const motivoParcela = motivo ? `Venda cancelada — ${motivo}` : "Venda cancelada";

  try {
    // 1) Marca a venda como cancelada (cliente da sessão → RLS/escopo continuam
    //    valendo, igual ao PATCH normal da venda).
    const { error: upErr } = await r.sessao.supabase
      .from("vendas")
      .update({ status: "cancelada", atualizado_em: agora })
      .eq("id", params.id);
    if (upErr) throw upErr;

    // 2) Cancela as parcelas NÃO pagas (as pagas ficam — dinheiro já entrou).
    //    Reusa EXATAMENTE o formato de parcelas.meta.cancelamento do PATCH avulso
    //    de parcela (merge atômico via merge_parcela_meta).
    const parcelas = await listarParcelasDaVenda(r.sessao.supabase, params.id);
    let parcelasCanceladas = 0;
    let parcelasPagasMantidas = 0;
    for (const p of parcelas) {
      if (p.status_base === "pago") {
        parcelasPagasMantidas++;
        continue;
      }
      if (p.meta?.cancelamento?.cancelado) continue; // já cancelada avulsa
      const { error: mErr } = await r.sessao.supabase.rpc("merge_parcela_meta", {
        p_id: p.id,
        p_patch: {
          cancelamento: {
            cancelado: true,
            motivo: motivoParcela,
            canceladoPor: r.sessao.userId,
            canceladoPorNome: r.sessao.userNome ?? undefined,
            canceladoEm: agora,
          },
        },
        p_remove: null,
        p_cobranca: null,
      });
      if (mErr) throw mErr;
      parcelasCanceladas++;
    }

    await auditAndNotify(r.sessao, {
      modulo: "venda",
      tipo: "cancelar",
      entidadeId: row.id,
      entidadeNome: row.numero,
      descricao: motivo
        ? `Cancelou a venda ${row.numero} — motivo: ${motivo}`
        : `Cancelou a venda ${row.numero}`,
      // Rastro (D6): o motivo e o destino das parcelas ficam registrados.
      dados: {
        versao: 1,
        motivo: motivo || null,
        parcelasCanceladas,
        parcelasPagasMantidas,
      },
    });

    // Devolve a venda já com status/parcelas atualizados (redigida se não vê financeiro).
    const venda = await buscarVendaPorId(r.sessao.supabase, params.id);
    if (!venda)
      return NextResponse.json({ erro: "Venda não encontrada." }, { status: 404 });
    const saida = redigirVendaParaSessao(r.sessao, venda);
    return NextResponse.json({ venda: saida });
  } catch (e) {
    return respostaDeErro(e, "Falha ao cancelar venda.");
  }
}
