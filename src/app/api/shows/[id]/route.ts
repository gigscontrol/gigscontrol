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
  podeVerAgendaDetalhado,
  podeCriarAgenda,
  podeEditarAgenda,
  podeExcluirAgenda,
  stripShowDetalhado,
} from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

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
    return respostaDeErro(e, "Falha ao buscar show.");
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

  // Booking tem PII de hospedagem → gerenciar exige ver_detalhado (não só editar),
  // simétrico ao gate de leitura/download do voucher.
  if (parsed.data.booking && !podeVerAgendaDetalhado(r.sessao, row.artist_id)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para gerenciar a hospedagem deste show." },
      { status: 403 }
    );
  }

  // Auditoria de cancelamento: o SERVIDOR carimba quem/quando (a partir da
  // sessão) em shows.meta — o cliente só manda o motivo, pra ninguém forjar a
  // autoria. Reverter empilha o cancelamento atual no histórico (nada se perde).
  const estavaCancelado = row.status === "cancelado";
  const querCancelar = parsed.data.status === "cancelado" && !estavaCancelado;
  const querReativar =
    parsed.data.status !== undefined &&
    parsed.data.status !== "cancelado" &&
    estavaCancelado;
  const metaAtual =
    row.meta && typeof row.meta === "object"
      ? (row.meta as Record<string, unknown>)
      : {};

  // Deltas de meta: só as chaves que MUDAM. São mescladas atomicamente no banco
  // (merge_show_meta) pra dois PATCH concorrentes não se sobrescreverem. O
  // servidor carimba quem/quando (autoria) — o cliente nunca injeta meta direto.
  const metaPatch: Record<string, unknown> = {};
  if (querCancelar) {
    const motivo = (parsed.data.cancelamentoMotivo ?? "").trim();
    if (!motivo) {
      return NextResponse.json(
        { erro: "Informe o motivo do cancelamento." },
        { status: 400 }
      );
    }
    metaPatch.cancelamento = {
      por: r.sessao.userId,
      porNome: r.sessao.userNome ?? r.sessao.userEmail ?? "—",
      em: new Date().toISOString(),
      motivo,
    };
  } else if (querReativar) {
    const hist = Array.isArray(metaAtual.cancelamentoHistorico)
      ? metaAtual.cancelamentoHistorico
      : [];
    metaPatch.cancelamento = null;
    metaPatch.cancelamentoHistorico = metaAtual.cancelamento
      ? [...hist, metaAtual.cancelamento]
      : hist;
  }

  // Booking/hospedagem: só o delta do sub-objeto (mesclado com || no banco).
  // Marcos (solicitadoEm/informadoEm) entram no delta só quando ainda não existem.
  let bookingPatch: Record<string, unknown> | null = null;
  if (parsed.data.booking) {
    const bAtual =
      metaAtual.booking && typeof metaAtual.booking === "object"
        ? (metaAtual.booking as Record<string, unknown>)
        : {};
    const agora = new Date().toISOString();
    const b = parsed.data.booking;
    bookingPatch = {
      ...b,
      atualizadoPor: r.sessao.userNome ?? r.sessao.userEmail ?? "—",
      atualizadoEm: agora,
    };
    if (b.status === "solicitado" && !bAtual.solicitadoEm) bookingPatch.solicitadoEm = agora;
    if (b.status === "informado" && !bAtual.informadoEm) bookingPatch.informadoEm = agora;
  }

  const COLUNAS_SHOW = [
    "artist_id", "contratante_id", "casa_id", "cidade_id", "data",
    "horario", "status", "valor", "orcamento_id", "venda_id",
  ] as const;
  const temColuna = COLUNAS_SHOW.some(
    (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
  );
  const temMeta = Object.keys(metaPatch).length > 0 || bookingPatch !== null;

  try {
    // Colunas pelo caminho normal (inclui o sync do Google Calendar por status).
    if (temColuna) {
      await atualizarShowPorId(r.sessao.supabase, params.id, parsed.data);
    }
    // Meta pelo merge atômico (RPC security invoker → RLS continua valendo).
    if (temMeta) {
      const { error } = await r.sessao.supabase.rpc("merge_show_meta", {
        p_id: params.id,
        p_patch: metaPatch,
        p_booking_patch: bookingPatch,
      });
      if (error) throw error;
    }
    // Re-lê pra devolver a meta já mesclada. Redige cachê/venda pra quem tem
    // editar mas não ver_detalhado (senão a resposta vaza o que o GET esconde).
    const fresh = await buscarShowPorId(r.sessao.supabase, params.id);
    if (!fresh) {
      return NextResponse.json({ erro: "Show não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ show: stripShowDetalhado(fresh, r.sessao) });
  } catch (e) {
    return respostaDeErro(e, "Falha ao atualizar show.");
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
    await removerShowPorId(r.sessao.supabase, params.id, r.sessao.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover show.");
  }
}
