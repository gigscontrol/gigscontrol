import { NextResponse } from "next/server";
import type { ParcelaMeta } from "@/types";
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

  if (parsed.data.cancelar === true && !parsed.data.cancelamento_motivo?.trim()) {
    return NextResponse.json(
      { erro: "Informe o motivo do cancelamento." },
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
  // Cancelar/reativar cachê e cobrança são ações financeiras distintas do
  // pagar/desfazer, mas mapeiam nas mesmas 3 chaves (registrar/cancelar/editar).
  const acao: "registrar" | "cancelar" | "editar" =
    parsed.data.cancelar !== undefined
      ? "cancelar"
      : parsed.data.registrar_cobranca
        ? "registrar"
        : parsed.data.status_base === "pago"
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

  // Computa a nova `meta` (pagamento/cancelamento/cobrança) a partir da atual +
  // as flags + a sessão (quem/quando). O servidor é a fonte da verdade desses
  // metadados — o cliente não os injeta direto.
  const agora = new Date().toISOString();
  const metaAtual: ParcelaMeta = parcelaRow.meta ?? {};
  let meta: ParcelaMeta | undefined;
  const base = () => meta ?? metaAtual;

  if (parsed.data.status_base === "pago") {
    meta = {
      ...base(),
      pagamento: {
        ...(metaAtual.pagamento ?? {}),
        pagoPor: r.sessao.userId,
        pagoPorNome: r.sessao.userNome ?? undefined,
        pagoEm: agora,
        ...(parsed.data.nota_pagamento !== undefined
          ? { nota: parsed.data.nota_pagamento ?? undefined }
          : {}),
      },
    };
  } else if (parsed.data.status_base === "pendente") {
    meta = { ...base(), pagamento: undefined }; // desfazer → limpa info do pagamento
  } else if (parsed.data.nota_pagamento !== undefined) {
    meta = {
      ...base(),
      pagamento: {
        ...(metaAtual.pagamento ?? {}),
        nota: parsed.data.nota_pagamento ?? undefined,
      },
    };
  }

  if (parsed.data.cancelar === true) {
    meta = {
      ...base(),
      cancelamento: {
        cancelado: true,
        motivo: parsed.data.cancelamento_motivo,
        canceladoPor: r.sessao.userId,
        canceladoPorNome: r.sessao.userNome ?? undefined,
        canceladoEm: agora,
      },
    };
  } else if (parsed.data.cancelar === false) {
    meta = { ...base(), cancelamento: { cancelado: false } };
  }

  if (parsed.data.registrar_cobranca === true) {
    meta = {
      ...base(),
      cobrancas: [
        ...(base().cobrancas ?? []),
        { em: agora, por: r.sessao.userId, porNome: r.sessao.userNome ?? undefined },
      ],
    };
  }

  try {
    const parcela = await atualizarParcelaPorId(
      r.sessao.supabase,
      params.id,
      parsed.data,
      meta
    );
    const nome = `parcela ${parcela.percentual}%`;
    if (parsed.data.status_base === "pago") {
      await auditAndNotify(r.sessao, {
        modulo: "parcela",
        tipo: "pagar",
        entidadeId: parcela.id,
        entidadeNome: nome,
        descricao: `Marcou parcela como paga (${parcela.percentual}% — R$ ${parcela.valor.toLocaleString("pt-BR")})`,
      });
    } else if (parsed.data.status_base === "pendente") {
      await auditAndNotify(r.sessao, {
        modulo: "parcela",
        tipo: "desfazer-pagamento",
        entidadeId: parcela.id,
        entidadeNome: nome,
        descricao: `Desfez pagamento da parcela (${parcela.percentual}%)`,
      });
    } else if (parsed.data.cancelar === true) {
      await auditAndNotify(r.sessao, {
        modulo: "parcela",
        tipo: "cancelar",
        entidadeId: parcela.id,
        entidadeNome: nome,
        descricao: `Cancelou o cachê da parcela (${parcela.percentual}%) — motivo: ${parsed.data.cancelamento_motivo}`,
      });
    } else if (parsed.data.registrar_cobranca === true) {
      await auditAndNotify(r.sessao, {
        modulo: "parcela",
        tipo: "cobranca",
        entidadeId: parcela.id,
        entidadeNome: nome,
        descricao: `Registrou uma cobrança da parcela (${parcela.percentual}%)`,
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
