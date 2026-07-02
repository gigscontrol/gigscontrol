import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarVendasDoWorkspace,
  criarVendaCompleta,
  VendaDuplicadaError,
} from "@/lib/services/vendas.service";
import { vendaCreateSchema } from "@/lib/validators/vendas.schema";
import {
  verificarAcessoVendas,
  verificarCriarVenda,
} from "@/lib/api/permissoes";
import { auditAndNotify } from "@/lib/services/historico.service";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoVendas(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const vendas = await listarVendasDoWorkspace(r.sessao.supabase, r.sessao);
    return NextResponse.json({ vendas });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar vendas." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendas — cria venda transacional:
 * insere venda + parcelas, sincroniza show e marca orçamento aceito.
 */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = vendaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const bloqueio = verificarCriarVenda(r.sessao, parsed.data.artist_id ?? null);
  if (bloqueio) return bloqueio;

  try {
    const venda = await criarVendaCompleta(
      r.sessao.supabase,
      r.sessao.workspaceId,
      r.sessao.userId,
      parsed.data
    );
    await auditAndNotify(r.sessao, {
      modulo: "venda",
      tipo: "criar",
      entidadeId: venda.id,
      entidadeNome: venda.numero,
      descricao: `Criou venda ${venda.numero}`,
    });
    return NextResponse.json({ venda }, { status: 201 });
  } catch (e) {
    if (e instanceof VendaDuplicadaError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar venda." },
      { status: 500 }
    );
  }
}
