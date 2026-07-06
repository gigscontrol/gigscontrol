import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarAgendaItensDoWorkspace,
  criarAgendaItemNoWorkspace,
} from "@/lib/services/agendaItems.service";
import { agendaItemCreateSchema } from "@/lib/validators/agendaItems.schema";
import { podeCriarAgenda } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";

/** GET /api/agenda-items — lista os itens (evento/voo/transporte) do workspace. */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  try {
    const itens = await listarAgendaItensDoWorkspace(r.sessao.supabase, r.sessao);
    return NextResponse.json({ itens });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar itens da agenda.");
  }
}

/** POST /api/agenda-items — cria um item no workspace ativo. */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

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

  if (!podeCriarAgenda(r.sessao, parsed.data.artist_id ?? null)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para criar na agenda deste artista." },
      { status: 403 }
    );
  }

  try {
    const item = await criarAgendaItemNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data,
      r.sessao.userId
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e, "Falha ao criar item.");
  }
}
