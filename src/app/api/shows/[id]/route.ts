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
  let metaOverride: Record<string, unknown> | undefined;
  if (querCancelar) {
    const motivo = (parsed.data.cancelamentoMotivo ?? "").trim();
    if (!motivo) {
      return NextResponse.json(
        { erro: "Informe o motivo do cancelamento." },
        { status: 400 }
      );
    }
    metaOverride = {
      ...metaAtual,
      cancelamento: {
        por: r.sessao.userId,
        porNome: r.sessao.userNome ?? r.sessao.userEmail ?? "—",
        em: new Date().toISOString(),
        motivo,
      },
    };
  } else if (querReativar) {
    const hist = Array.isArray(metaAtual.cancelamentoHistorico)
      ? metaAtual.cancelamentoHistorico
      : [];
    metaOverride = {
      ...metaAtual,
      cancelamento: null,
      cancelamentoHistorico: metaAtual.cancelamento
        ? [...hist, metaAtual.cancelamento]
        : hist,
    };
  }

  // Booking/hospedagem (Fases 4-5): mescla em meta.booking. O cliente preenche
  // os campos; o servidor carimba quem/quando (audit) e os marcos do fluxo.
  if (parsed.data.booking) {
    const base = metaOverride ?? metaAtual;
    const bAtual =
      base.booking && typeof base.booking === "object"
        ? (base.booking as Record<string, unknown>)
        : {};
    const agora = new Date().toISOString();
    const b = parsed.data.booking;
    metaOverride = {
      ...base,
      booking: {
        ...bAtual,
        ...b,
        atualizadoPor: r.sessao.userNome ?? r.sessao.userEmail ?? "—",
        atualizadoEm: agora,
        solicitadoEm:
          b.status === "solicitado" && !bAtual.solicitadoEm
            ? agora
            : (bAtual.solicitadoEm as string | undefined),
        informadoEm:
          b.status === "informado"
            ? ((bAtual.informadoEm as string | undefined) ?? agora)
            : (bAtual.informadoEm as string | undefined),
      },
    };
  }

  try {
    const show = await atualizarShowPorId(
      r.sessao.supabase,
      params.id,
      parsed.data,
      metaOverride
    );
    // Redige o cachê/venda na resposta pra quem tem editar mas não ver_detalhado
    // (senão a resposta do PATCH vaza o que o GET esconde).
    return NextResponse.json({ show: stripShowDetalhado(show, r.sessao) });
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
    await removerShowPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao remover show.");
  }
}
