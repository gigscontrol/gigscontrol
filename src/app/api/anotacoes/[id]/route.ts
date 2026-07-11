import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  atualizarNotaPorId,
  removerNotaPorId,
} from "@/lib/services/anotacoes.service";
import { notaUpdateSchema } from "@/lib/validators/anotacoes.schema";
import { buscarNota } from "@/lib/repositories/anotacoes.repo";
import { podeMexerNaNota } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/** PATCH /api/anotacoes/:id — editar a nota (SÓ o autor; admin qualquer). */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await buscarNota(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Anotação não encontrada." }, { status: 404 });
  if (!podeMexerNaNota(r.sessao, row.criado_por)) {
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
  if (!podeMexerNaNota(r.sessao, row.criado_por)) {
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
