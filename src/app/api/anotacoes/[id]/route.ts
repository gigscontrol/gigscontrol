import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  atualizarNotaPorId,
  removerNotaPorId,
  artistasSaoDoWorkspace,
} from "@/lib/services/anotacoes.service";
import { notaUpdateSchema } from "@/lib/validators/anotacoes.schema";
import { buscarNota } from "@/lib/repositories/anotacoes.repo";
import { podeMexerNaNota, podeCriarAnotacao } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/** PATCH /api/anotacoes/:id — editar a nota (SÓ o autor; admin qualquer). */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await buscarNota(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Anotação não encontrada." }, { status: 404 });
  // Autor sempre pode (como antes); `anotacoes.editar` no artista da nota
  // AMPLIA pra mexer na nota de outra pessoa.
  if (!podeMexerNaNota(r.sessao, row.criado_por, row.artist_id, "editar")) {
    return NextResponse.json(
      { erro: "Você só pode editar as suas próprias anotações." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = notaUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Etiqueta de contexto (se veio) tem que ser um artista do próprio workspace.
  if (
    parsed.data.artistId !== undefined &&
    !(await artistasSaoDoWorkspace(r.sessao.supabase, r.sessao.workspaceId, [parsed.data.artistId]))
  ) {
    return NextResponse.json(
      { erro: "Artista inválido para este workspace." },
      { status: 400 }
    );
  }

  // Re-etiquetar a nota para OUTRO artista exige permissão no artista de
  // DESTINO também — senão a troca de etiqueta viraria uma porta lateral.
  if (
    parsed.data.artistId !== undefined &&
    parsed.data.artistId !== row.artist_id &&
    !podeCriarAnotacao(r.sessao, parsed.data.artistId ?? null)
  ) {
    return NextResponse.json(
      { erro: "Você não tem permissão para mover a anotação para este artista." },
      { status: 403 }
    );
  }

  // Nota de PASTA não pode ficar sem título (nota de show pode).
  if (row.pasta_id && parsed.data.titulo !== undefined && !parsed.data.titulo?.trim()) {
    return NextResponse.json({ erro: "Dê um título à anotação." }, { status: 400 });
  }

  try {
    const nota = await atualizarNotaPorId(
      r.sessao.supabase,
      params.id,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ nota });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar anotação.");
  }
}

/** DELETE /api/anotacoes/:id — excluir a nota (SÓ o autor; admin qualquer). */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await buscarNota(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Anotação não encontrada." }, { status: 404 });
  if (!podeMexerNaNota(r.sessao, row.criado_por, row.artist_id, "excluir")) {
    return NextResponse.json(
      { erro: "Você só pode excluir as suas próprias anotações." },
      { status: 403 }
    );
  }

  try {
    await removerNotaPorId(r.sessao.supabase, params.id, r.sessao.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao excluir anotação.");
  }
}
