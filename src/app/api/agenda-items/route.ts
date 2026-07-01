import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  listarAgendaItensDoWorkspace,
  criarAgendaItemNoWorkspace,
} from "@/lib/services/agendaItems.service";
import { agendaItemCreateSchema } from "@/lib/validators/agendaItems.schema";

/** GET /api/agenda-items — lista os itens (evento/voo/transporte) do workspace. */
export async function GET() {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  try {
    const itens = await listarAgendaItensDoWorkspace(r.sessao.supabase);
    return NextResponse.json({ itens });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao listar itens da agenda." },
      { status: 500 }
    );
  }
}

/** POST /api/agenda-items — cria um item no workspace ativo. */
export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
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

  try {
    const item = await criarAgendaItemNoWorkspace(
      r.sessao.supabase,
      r.sessao.workspaceId,
      parsed.data
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao criar item." },
      { status: 500 }
    );
  }
}
