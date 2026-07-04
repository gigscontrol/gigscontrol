import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  buscarShowPorId,
  atualizarShowPorId,
  removerShowPorId,
} from "@/lib/services/shows.service";
import { showUpdateSchema } from "@/lib/validators/shows.schema";
import { buscarShow as repoBuscarShow } from "@/lib/repositories/shows.repo";
import {
  podeVerAgenda,
  podeCriarAgenda,
  podeEditarAgenda,
  podeExcluirAgenda,
  stripShowDetalhado,
} from "@/lib/api/permissoes";

type RouteCtx = { params: { id: string } };

/** GET /api/shows/:id */
export async function GET(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  try {
    const show = await buscarShowPorId(r.sessao.supabase, params.id);
    if (!show) {
      return NextResponse.json(
        { erro: "Show não encontrado." },
        { status: 404 }
      );
    }
    // Inclui show SEM artista (djId vazio → null): item geral = admin-only
    // (podeVerAgenda(null) só passa admin/legado). Antes escapava do gate.
    if (!podeVerAgenda(r.sessao, show.djId || null)) {
      return NextResponse.json(
        { erro: "Você não tem acesso a este show." },
        { status: 403 }
      );
    }
    // Redige cachê/vínculos se só tem acesso básico (agenda.ver).
    return NextResponse.json({ show: stripShowDetalhado(show, r.sessao) });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar show." },
      { status: 500 }
    );
  }
}

/** PATCH /api/shows/:id */
export async function PATCH(request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await repoBuscarShow(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Show não encontrado." }, { status: 404 });
  if (!podeEditarAgenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para editar este show." },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const parsed = showUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // IDOR de destino: se o PATCH move o show para OUTRO artista, exige permissão
  // no DESTINO também — senão daria pra empurrar o evento pra dentro de um
  // artista sem vínculo. Só checa quando o artist_id muda de fato.
  if (
    parsed.data.artist_id !== undefined &&
    (parsed.data.artist_id ?? null) !== row.artist_id &&
    !podeCriarAgenda(r.sessao, parsed.data.artist_id ?? null)
  ) {
    return NextResponse.json(
      { erro: "Você não tem permissão para mover este evento para esse artista." },
      { status: 403 }
    );
  }

  try {
    const show = await atualizarShowPorId(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    // Redige o cachê/venda na resposta pra quem tem editar mas não ver_detalhado
    // (senão a resposta do PATCH vaza o que o GET esconde).
    return NextResponse.json({ show: stripShowDetalhado(show, r.sessao) });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar show." },
      { status: 500 }
    );
  }
}

/** DELETE /api/shows/:id */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  const row = await repoBuscarShow(r.sessao.supabase, params.id);
  if (!row)
    return NextResponse.json({ erro: "Show não encontrado." }, { status: 404 });
  if (!podeExcluirAgenda(r.sessao, row.artist_id, row.criado_por)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para remover este show." },
      { status: 403 }
    );
  }

  try {
    await removerShowPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover show." },
      { status: 500 }
    );
  }
}
