import { NextResponse } from "next/server";
import type { ParcelaMeta } from "@/types";
import { autenticarComWorkspace } from "@/lib/api/session";
import { criarClienteAdmin } from "@/lib/db/supabase-admin";
import { atualizarParcelaPorId } from "@/lib/services/vendas.service";
import { parcelaUpdateSchema } from "@/lib/validators/vendas.schema";
import { podeInformarPagamentoParcela } from "@/lib/api/permissoes";
import { buscarParcela } from "@/lib/repositories/parcelas.repo";
import { buscarVenda } from "@/lib/repositories/vendas.repo";
import { rowParaParcela } from "@/lib/mappers/venda";
import { auditAndNotify } from "@/lib/services/historico.service";
import { respostaDeErro } from "@/lib/api/erros";

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
  // As 3 chaves financeiras são INDEPENDENTES. O body pode disparar VÁRIOS
  // efeitos ao mesmo tempo, então derivamos o CONJUNTO de ações exigidas e
  // checamos CADA uma — senão uma combinação de flags escala entre as chaves
  // (ex.: quem só registra mandar status_base:'pendente' desfazia o pagamento).
  const editaEstrutura =
    parsed.data.percentual !== undefined ||
    parsed.data.valor !== undefined ||
    parsed.data.data_vencimento !== undefined ||
    // observacao/data_pagamento explícitos também são "editar" — senão viajavam
    // junto de uma flag de cancelar/registrar sem exigir financeiro.editar_pagamento.
    parsed.data.observacao !== undefined ||
    parsed.data.data_pagamento !== undefined;
  const requeridas = new Set<"registrar" | "cancelar" | "editar">();
  if (parsed.data.status_base === "pago") requeridas.add("registrar");
  if (parsed.data.status_base === "pendente") requeridas.add("cancelar"); // desfazer
  if (parsed.data.cancelar !== undefined) requeridas.add("cancelar"); // cancelar/reativar
  if (parsed.data.registrar_cobranca === true) requeridas.add("registrar");
  if (parsed.data.fixar !== undefined) requeridas.add("editar");
  if (editaEstrutura) requeridas.add("editar");
  if (
    parsed.data.nota_pagamento !== undefined &&
    parsed.data.status_base === undefined &&
    parsed.data.cancelar === undefined
  )
    requeridas.add("editar"); // só nota, sem mudar status → edição
  if (requeridas.size === 0) requeridas.add("editar");
  for (const acao of requeridas) {
    const bloqueio = podeInformarPagamentoParcela(r.sessao, venda.artist_id, acao);
    if (bloqueio) return bloqueio;
  }

  // Deltas de meta (só as chaves que MUDAM) — mesclados ATOMICAMENTE no banco
  // (merge_parcela_meta) pra dois PATCH concorrentes não se sobrescreverem (o
  // append de cobrança nunca vira "set"). O servidor carimba quem/quando.
  const agora = new Date().toISOString();
  const metaAtual: ParcelaMeta = parcelaRow.meta ?? {};
  const metaPatch: Record<string, unknown> = {}; // chaves top-level a mesclar (||)
  const metaRemove: string[] = []; // chaves a apagar
  let cobrancaNova: Record<string, unknown> | null = null; // entrada a appendar
  let comprovanteOrfao: string | undefined; // path a apagar do bucket após o update

  if (parsed.data.status_base === "pago") {
    metaPatch.pagamento = {
      ...(metaAtual.pagamento ?? {}),
      pagoPor: r.sessao.userId,
      pagoPorNome: r.sessao.userNome ?? undefined,
      pagoEm: agora,
      ...(parsed.data.nota_pagamento !== undefined
        ? { nota: parsed.data.nota_pagamento ?? undefined }
        : {}),
    };
  } else if (parsed.data.status_base === "pendente") {
    metaRemove.push("pagamento"); // desfazer → limpa a info do pagamento
    comprovanteOrfao = metaAtual.pagamento?.comprovantePath; // apaga do bucket depois
  } else if (parsed.data.nota_pagamento !== undefined) {
    metaPatch.pagamento = {
      ...(metaAtual.pagamento ?? {}),
      nota: parsed.data.nota_pagamento ?? undefined,
    };
  }

  if (parsed.data.cancelar === true) {
    metaPatch.cancelamento = {
      cancelado: true,
      motivo: parsed.data.cancelamento_motivo,
      canceladoPor: r.sessao.userId,
      canceladoPorNome: r.sessao.userNome ?? undefined,
      canceladoEm: agora,
    };
  } else if (parsed.data.cancelar === false) {
    metaPatch.cancelamento = { cancelado: false };
  }

  if (parsed.data.registrar_cobranca === true) {
    const cobrancas = metaAtual.cobrancas ?? [];
    const ultima = cobrancas[cobrancas.length - 1];
    // Idempotência: mesma pessoa cobrando de novo em <60s não empilha duplicata.
    const duplicada =
      !!ultima &&
      ultima.por === r.sessao.userId &&
      new Date(agora).getTime() - new Date(ultima.em).getTime() < 60_000;
    if (!duplicada) {
      cobrancaNova = { em: agora, por: r.sessao.userId, porNome: r.sessao.userNome ?? undefined };
    }
  }

  if (parsed.data.fixar !== undefined) {
    metaPatch.fixada = parsed.data.fixar;
  }

  const COLUNAS_PARCELA = [
    "percentual", "valor", "data_vencimento", "status_base", "data_pagamento", "observacao",
  ] as const;
  const temColuna = COLUNAS_PARCELA.some(
    (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
  );
  const temMeta =
    Object.keys(metaPatch).length > 0 || metaRemove.length > 0 || cobrancaNova !== null;

  try {
    // Colunas pelo caminho normal (status_base também sincroniza data_pagamento).
    if (temColuna) {
      await atualizarParcelaPorId(r.sessao.supabase, params.id, parsed.data);
    }
    // Meta pelo merge atômico (RPC security invoker → o RLS continua valendo).
    if (temMeta) {
      const { error } = await r.sessao.supabase.rpc("merge_parcela_meta", {
        p_id: params.id,
        p_patch: metaPatch,
        p_remove: metaRemove.length > 0 ? metaRemove : null,
        p_cobranca: cobrancaNova,
      });
      if (error) throw error;
    }
    // Re-lê a parcela já com a meta mesclada (fonte da resposta e do audit).
    const freshRow = await buscarParcela(r.sessao.supabase, params.id);
    const parcela = rowParaParcela(freshRow ?? parcelaRow);
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
    // Desfazer pagamento limpa a meta; apaga o comprovante órfão do bucket
    // privado (best-effort, service-role) pra não deixar lixo/PII pra trás.
    if (comprovanteOrfao) {
      await criarClienteAdmin()
        .storage.from("comprovantes")
        .remove([comprovanteOrfao])
        .catch(() => undefined);
    }
    return NextResponse.json({ parcela });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar parcela.");
  }
}
