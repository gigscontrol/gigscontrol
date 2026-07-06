import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  atualizarAgendaItemNoWorkspace,
  removerAgendaItemPorId,
} from "@/lib/services/agendaItems.service";
import { agendaItemCreateSchema } from "@/lib/validators/agendaItems.schema";
import { buscarAgendaItem } from "@/lib/repositories/agendaItems.repo";
import {
  podeCriarAgenda,
  podeEditarAgenda,
  podeExcluirAgenda,
  stripAgendaItemDetalhado,
} from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

type RouteCtx = { params: { id: string } };

/** PATCH /api/agenda-items/:id — atualiza um item (mesmos campos do POST). */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await buscarAgendaItem(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
  if (!podeEditarAgenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para editar este item." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = agendaItemCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // IDOR de destino: mover o item pra OUTRO artista exige permissão no destino.
  if (
    parsed.data.artist_id !== undefined &&
    (parsed.data.artist_id ?? null) !== row.artist_id &&
    !podeCriarAgenda(r.sessao, parsed.data.artist_id ?? null)
  ) {
    return NextResponse.json(
      { erro: "Você não tem permissão para mover este item para esse artista." },
      { status: 403 }
    );
  }

  try {
    const item = await atualizarAgendaItemNoWorkspace(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    // Redige voo/observações na resposta pra quem tem editar mas não
    // ver_detalhado (senão o PATCH vaza o que a lista/GET escondem). O artist_id
    // de destino pode ter mudado — usa o do payload quando presente.
    const artistId = parsed.data.artist_id !== undefined
      ? parsed.data.artist_id ?? null
      : row.artist_id;
    return NextResponse.json({ item: stripAgendaItemDetalhado(item, r.sessao, artistId) });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar item.");
  }
}

/** DELETE /api/agenda-items/:id — soft delete. */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await buscarAgendaItem(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
  if (!podeExcluirAgenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para remover este item." },
      { status: 403 }
    );
  }

  try {
    await removerAgendaItemPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover item.");
  }
}
