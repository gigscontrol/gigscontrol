import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarContratoPorId,
  atualizarContratoPorId,
  removerContratoPorId,
  resolverEscopoContrato,
} from "@/lib/services/contratos.service";
import {
  podeVerContrato,
  podeEditarContrato,
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
    if (!podeVerContrato(r.sessao, artistId))
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
    if (!podeEditarContrato(r.sessao, artistId, existente.criadoPor))
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
    const { artistId } = await resolverEscopoContrato(r.sessao.supabase, existente.vendaId);
    if (!podeExcluirContrato(r.sessao, artistId))
      return NextResponse.json(
        { erro: "Contrato não encontrado." },
        { status: 404 }
      );
    await removerContratoPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover contrato.");
  }
}
