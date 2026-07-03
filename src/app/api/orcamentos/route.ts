import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarOrcamentosDoWorkspace,
  criarOrcamentoNoWorkspace,
} from "@/lib/services/orcamentos.service";
import { orcamentoCreateSchema } from "@/lib/validators/orcamentos.schema";
import {
  verificarAcessoOrcamentos,
  verificarCriarOrcamento,
} from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";
import { auditAndNotify } from "@/lib/services/historico.service";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoOrcamentos(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const orcamentos = await listarOrcamentosDoWorkspace(
      r.sessao.supabase,
      r.sessao
    );
    return NextResponse.json({ orcamentos });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar orçamentos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = orcamentoCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const bloqueio = verificarCriarOrcamento(r.sessao, parsed.data.artist_id ?? null);
  if (bloqueio) return bloqueio;

  try {
    const orcamento = await criarOrcamentoNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      r.sessao.userId,
      parsed.data
    );
    await auditAndNotify(r.sessao, {
      modulo: "orcamento",
      tipo: "criar",
      entidadeId: orcamento.id,
      entidadeNome: orcamento.numero,
      descricao: `Criou orçamento ${orcamento.numero}`,
    });
    return NextResponse.json({ orcamento }, { status: 201 });
  } catch (e) {
    // Colisão de número (23505) etc. viram status amigável em vez de 500 cru.
    return respostaDeErro(e, "Falha ao criar orçamento.");
  }
}
