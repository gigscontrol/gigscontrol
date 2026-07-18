import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarNotasDoWorkspace,
  criarNotaNoWorkspace,
  artistasSaoDoWorkspace,
  contextoDeAnotacoes,
} from "@/lib/services/anotacoes.service";
import { notaCreateSchema } from "@/lib/validators/anotacoes.schema";
import { buscarPasta, contarNotasDoShow } from "@/lib/repositories/anotacoes.repo";
import { buscarShow as repoBuscarShow } from "@/lib/repositories/shows.repo";
import {
  podeVerAgenda,
  podeVerAnotacao,
  podeCriarAnotacao,
} from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

const MAX_NOTAS_POR_SHOW = 4;

/**
 * GET /api/anotacoes — a RLS filtra por pasta e, POR CIMA, o gate de leitura
 * fechado (L1): chave `anotacoes.ver` no artista da nota, OU nota de show cuja
 * agenda ele alcança, OU pasta em que ele é dono/membro explícito (pasta aberta
 * ao workspace libera só as notas sem etiqueta de artista). Ver a doutrina em
 * lib/api/permissoes.ts. O filtro é em memória sobre o array já lido — não mexe
 * no COLS/select do repo.
 */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const todas = await listarNotasDoWorkspace(r.sessao.supabase);
    const ctx = await contextoDeAnotacoes(
      r.sessao.supabase,
      { userId: r.sessao.userId, artistaId: r.sessao.artistaId ?? null },
      todas
    );
    const notas = todas.filter((n) => podeVerAnotacao(r.sessao, n, ctx));
    return NextResponse.json({ notas });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar anotações.");
  }
}

/** POST /api/anotacoes — adiciona uma nota (mensagem) numa pasta que ele enxerga. */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = notaCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Etiqueta de contexto (se veio) tem que ser um artista do próprio workspace.
  if (
    !(await artistasSaoDoWorkspace(r.sessao.supabase, r.sessao.workspaceId, [parsed.data.artistId]))
  ) {
    return NextResponse.json(
      { erro: "Artista inválido para este workspace." },
      { status: 400 }
    );
  }

  // Gate por artista (`anotacoes.criar`). Quem está no regime legado passa —
  // ver a doutrina de compatibilidade em lib/api/permissoes.ts.
  if (!podeCriarAnotacao(r.sessao, parsed.data.artistId ?? null)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para criar anotações deste artista." },
      { status: 403 }
    );
  }

  if (parsed.data.pasta_id) {
    // Nota de PASTA (documento da base de conhecimento) exige título.
    if (!parsed.data.titulo?.trim()) {
      return NextResponse.json(
        { erro: "Dê um título à anotação." },
        { status: 400 }
      );
    }
    // Só adiciona nota em pasta que enxerga (a RLS de leitura da pasta é o gate).
    const pasta = await buscarPasta(r.sessao.supabase, parsed.data.pasta_id);
    if (!pasta)
      return NextResponse.json({ erro: "Pasta não encontrada." }, { status: 404 });
  } else if (parsed.data.show_id) {
    // Nota de SHOW: precisa enxergar a agenda do artista do show + teto de 4.
    const show = await repoBuscarShow(r.sessao.supabase, parsed.data.show_id);
    if (!show)
      return NextResponse.json({ erro: "Show não encontrado." }, { status: 404 });
    if (!podeVerAgenda(r.sessao, show.artist_id)) {
      return NextResponse.json(
        { erro: "Você não tem acesso a este show." },
        { status: 403 }
      );
    }
    const usadas = await contarNotasDoShow(r.sessao.supabase, parsed.data.show_id);
    if (usadas >= MAX_NOTAS_POR_SHOW) {
      return NextResponse.json(
        { erro: `Limite de ${MAX_NOTAS_POR_SHOW} anotações por show atingido.` },
        { status: 409 }
      );
    }
  }

  try {
    const nota = await criarNotaNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ nota }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e, "Falha ao salvar anotação.");
  }
}
