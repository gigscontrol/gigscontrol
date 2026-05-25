import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { aceitarOrcamentoPorId } from "@/lib/services/orcamentos.service";
import {
  verificarAcessoOrcamentos,
  podeEditarOrcamento,
} from "@/lib/api/permissoes";
import { buscarOrcamento as repoBuscarOrcamento } from "@/lib/repositories/orcamentos.repo";
import { auditAndNotify } from "@/lib/services/historico.service";

type RouteCtx = { params: { id: string } };

/**
 * POST /api/orcamentos/:id/aceitar
 *
 * Marca o orçamento como aceito e, se ainda não houver, cria o show
 * vinculado na agenda. Atômico do ponto de vista do cliente: só sucede
 * se status + show estiverem ambos OK.
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoOrcamentos(r.sessao);
  if (bloqueio) return bloqueio;

  const row = await repoBuscarOrcamento(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Orçamento não encontrado." }, { status: 404 });
  if (!podeEditarOrcamento(r.sessao, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para aceitar este orçamento." },
      { status: 403 }
    );
  }

  try {
    const resultado = await aceitarOrcamentoPorId(
      r.sessao.supabase,
      r.sessao.workspaceId,
      params.id
    );
    await auditAndNotify(r.sessao, {
      modulo: "orcamento",
      tipo: "aceitar",
      entidadeId: resultado.orcamento.id,
      entidadeNome: resultado.orcamento.numero,
      descricao: `Aceitou orçamento ${resultado.orcamento.numero}`,
    });
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao aceitar orçamento." },
      { status: 500 }
    );
  }
}
