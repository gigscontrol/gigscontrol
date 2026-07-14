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
  podeConverterOrcamento,
  redigirVendaParaSessao,
} from "@/lib/api/permissoes";
import { buscarOrcamento } from "@/lib/repositories/orcamentos.repo";
import { respostaDeErro } from "@/lib/api/erros";
import { auditAndNotify } from "@/lib/services/historico.service";

export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoVendas(r.sessao);
  if (bloqueio) return bloqueio;
  try {
    const vendas = await listarVendasDoWorkspace(r.sessao.supabase, r.sessao);
    // Rastreamento financeiro (comprovante/quem pagou/cobranças) só pra quem tem
    // autorização de ver o financeiro daquele artista; os demais recebem a venda
    // redigida (cachê/valores permanecem — o vendedor precisa do negócio). A
    // TAXA/líquido (D6) some também pra quem vê o financeiro mas não a taxa.
    const saida = vendas.map((v) => redigirVendaParaSessao(r.sessao, v));
    return NextResponse.json({ vendas: saida });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar vendas.");
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

  // Conversão de orçamento (orcamento_id presente): criarVendaCompleta marca o
  // orçamento como aceito e mexe no show dele. Exige a chave `converter` no
  // artista do ORÇAMENTO e que a venda seja do MESMO artista — senão dá pra
  // referenciar orçamento de outro artista e mutá-lo (IDOR cross-artista).
  if (parsed.data.orcamento_id) {
    const orc = await buscarOrcamento(r.sessao.supabase, parsed.data.orcamento_id);
    if (!orc)
      return NextResponse.json({ erro: "Orçamento não encontrado." }, { status: 404 });
    if ((parsed.data.artist_id ?? null) !== (orc.artist_id ?? null))
      return NextResponse.json(
        { erro: "O artista da venda não confere com o do orçamento." },
        { status: 400 }
      );
    if (!podeConverterOrcamento(r.sessao, orc.artist_id, orc.criado_por))
      return NextResponse.json(
        { erro: "Você não tem permissão para converter este orçamento." },
        { status: 403 }
      );
  }

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
    return NextResponse.json(
      { venda: redigirVendaParaSessao(r.sessao, venda) },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof VendaDuplicadaError) {
      return NextResponse.json({ erro: e.message }, { status: 409 });
    }
    return respostaDeErro(e, "Falha ao criar venda.");
  }
}
