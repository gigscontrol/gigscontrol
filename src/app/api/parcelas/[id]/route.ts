import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { atualizarParcelaPorId } from "@/lib/services/vendas.service";
import { parcelaUpdateSchema } from "@/lib/validators/vendas.schema";
import { podeInformarPagamentoParcela } from "@/lib/api/permissoes";
import { buscarParcela } from "@/lib/repositories/parcelas.repo";
import { buscarVenda } from "@/lib/repositories/vendas.repo";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

/**
 * PATCH /api/parcelas/:id — informar / desfazer pagamento, ajustar
 * data, observação, etc.
 */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = parcelaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Gate por artista: a parcela não tem artist_id — resolve via venda.
  // Cross-workspace já cai em 404 (RLS no cliente da sessão).
  const parcelaRow = await buscarParcela(r.sessao.supabase, params.id);
  if (!parcelaRow)
    return NextResponse.json({ erro: "Parcela não encontrada." }, { status: 404 });
  const venda = await buscarVenda(r.sessao.supabase, parcelaRow.venda_id);
  if (!venda)
    return NextResponse.json({ erro: "Parcela não encontrada." }, { status: 404 });
  const acao: "registrar" | "cancelar" | "editar" =
    parsed.data.status_base === "pago"
      ? "registrar"
      : parsed.data.status_base === "pendente"
        ? "cancelar"
        : "editar";
  const bloqueio = podeInformarPagamentoParcela(r.sessao, venda.artist_id, acao);
  if (bloqueio) return bloqueio;
  // Chaves financeiras são independentes no modelo novo: quem (des)faz o
  // pagamento não necessariamente pode EDITAR valor/percentual/vencimento.
  // Se a mesma request também mexe nesses campos, exige TAMBÉM editar_pagamento
  // (fecha o escalonamento de capacidade dentro do próprio artista).
  const editaEstrutura =
    parsed.data.percentual !== undefined ||
    parsed.data.valor !== undefined ||
    parsed.data.data_vencimento !== undefined;
  if (editaEstrutura && acao !== "editar") {
    const bloqEdicao = podeInformarPagamentoParcela(r.sessao, venda.artist_id, "editar");
    if (bloqEdicao) return bloqEdicao;
  }

  try {
    const parcela = await atualizarParcelaPorId(r.sessao.supabase, params.id, parsed.data);
    // Registra apenas mudanças de status_base (pagar/desfazer), que são
    // as ações de auditoria relevantes. Ajustes finos (data, obs) não.
    if (parsed.data.status_base === "pago") {
      await auditAndNotify(r.sessao, {
        modulo: "parcela",
        tipo: "pagar",
        entidadeId: parcela.id,
        entidadeNome: `parcela ${parcela.percentual}%`,
        descricao: `Marcou parcela como paga (${parcela.percentual}% — R$ ${parcela.valor.toLocaleString("pt-BR")})`,
      });
    } else if (parsed.data.status_base === "pendente") {
      await auditAndNotify(r.sessao, {
        modulo: "parcela",
        tipo: "desfazer-pagamento",
        entidadeId: parcela.id,
        entidadeNome: `parcela ${parcela.percentual}%`,
        descricao: `Desfez pagamento da parcela (${parcela.percentual}% — R$ ${parcela.valor.toLocaleString("pt-BR")})`,
      });
    }
    return NextResponse.json({ parcela });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar parcela." },
      { status: 500 }
    );
  }
}
