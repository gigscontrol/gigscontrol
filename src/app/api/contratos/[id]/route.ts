import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarContratoPorId,
  atualizarContratoPorId,
  removerContratoPorId,
  resolverEscopoContrato,
  ContratoImutavelError,
  ContratoFinalizadoError,
} from "@/lib/services/contratos.service";
import {
  podeVerContrato,
  podeEditarContrato,
  podeCancelarContrato,
  podeExcluirContrato,
  verificarCriarContrato,
} from "@/lib/api/permissoes";
import { contratoUpdateSchema } from "@/lib/validators/contratos.schema";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const contrato = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!contrato)
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    // Gate por artista (via venda). 404 fora do escopo — não vaza existência.
    const { artistId } = await resolverEscopoContrato(r.sessao.supabase, contrato.vendaId);
    if (!podeVerContrato(r.sessao, artistId, contrato.criadoPor))
      return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    return NextResponse.json({ contrato });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar contrato.");
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = contratoUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const existente = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!existente)
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    const { artistId } = await resolverEscopoContrato(
      r.sessao.supabase,
      existente.vendaId
    );
    // Artista vem da venda; o "dono" do escopo "só os que ele criou" é o criador
    // do CONTRATO (contratos.criado_por), não o vendedor da venda vinculada.
    // 404 (não 403) fora de escopo — mesmo padrão do GET e de contatos/[id],
    // pra não virar oráculo de existência de contrato por id.

    // CANCELAR é permissão PRÓPRIA (D4): a transição → "cancelado" passa por
    // contratos.cancelar (não por editar). Um usuário só-cancelar NÃO edita e
    // um usuário só-editar NÃO cancela por esta via. Cancelar contrato já
    // assinado é permitido (o dono quer cancelar mesmo) — o efeito de barrar a
    // assinatura só vale pra quem ainda não assinou, no /assinar/[token].
    const querCancelar =
      parsed.data.status === "cancelado" && existente.status !== "cancelado";
    // Campos que caracterizam uma EDIÇÃO de verdade (fora o próprio status). Se
    // o PATCH mexe em qualquer um, exige contratos.editar — mesmo junto do cancelar.
    const CAMPOS_EDICAO = [
      "modelo_id",
      "venda_id",
      "corpo_preenchido",
      "local_assinatura",
      "data_emissao",
      "data_assinatura",
      "observacoes",
      "pasta_id",
    ] as const;
    const editaConteudo = CAMPOS_EDICAO.some(
      (k) => (parsed.data as Record<string, unknown>)[k] !== undefined
    );
    // "Só cancelar" = flip do status pra cancelado e nada mais. Aí basta a chave
    // de cancelar; qualquer outra coisa (edição de conteúdo, reativar, marcar
    // enviado/assinado, PATCH vazio) exige contratos.editar como antes.
    const soCancelar = querCancelar && !editaConteudo;

    if (
      querCancelar &&
      !podeCancelarContrato(r.sessao, artistId, existente.criadoPor)
    )
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    if (
      !soCancelar &&
      !podeEditarContrato(r.sessao, artistId, existente.criadoPor)
    )
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    // IDOR de destino: re-apontar o contrato para OUTRA venda (logo, outro
    // artista) exige permissão no DESTINO também — senão daria pra plugar o
    // contrato numa venda de um artista sem vínculo. Espelha vendas/orcamentos/[id].
    if (
      parsed.data.venda_id !== undefined &&
      (parsed.data.venda_id ?? null) !== (existente.vendaId ?? null)
    ) {
      const { artistId: artistDestino } = await resolverEscopoContrato(
        r.sessao.supabase,
        parsed.data.venda_id ?? null
      );
      const bloqDestino = verificarCriarContrato(r.sessao, artistDestino);
      if (bloqDestino) return bloqDestino;
    }
    const contrato = await atualizarContratoPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    return NextResponse.json({ contrato });
  } catch (e) {
    if (e instanceof ContratoImutavelError) {
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    return respostaDeErro(e, "Falha ao atualizar contrato.");
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  try {
    const existente = await buscarContratoPorId(r.sessao.supabase, params.id);
    if (!existente)
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    // Excluir contrato é ADMIN-ONLY (D4): não passa por chave nem por artista —
    // some do catálogo delegável e do pacote do artista. Não-admin → 404 (não
    // vira oráculo de existência de contrato por id).
    if (!podeExcluirContrato(r.sessao))
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    await removerContratoPorId(r.sessao.supabase, params.id, r.sessao.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ContratoFinalizadoError) {
      return NextResponse.json({ erro: e.message }, { status: e.status });
    }
    return respostaDeErro(e, "Falha ao remover contrato.");
  }
}
