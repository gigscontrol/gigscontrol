import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import {
  atualizarAgendaItemNoWorkspace,
  removerAgendaItemPorId,
} from "@/lib/services/agendaItems.service";
import { agendaItemCreateSchema } from "@/lib/validators/agendaItems.schema";

type RouteCtx = { params: { id: string } };

/** PATCH /api/agenda-items/:id — atualiza um item (mesmos campos do POST). */
export async function PATCH(request: Request, { params }: RouteCtx) {
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

  try {
    const item = await atualizarAgendaItemNoWorkspace(
      r.sessao.supabase,
      params.id,
      parsed.data
    );
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao atualizar item." },
      { status: 500 }
    );
  }
}

/** DELETE /api/agenda-items/:id — soft delete. */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  try {
    await removerAgendaItemPorId(r.sessao.supabase, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao remover item." },
      { status: 500 }
    );
  }
}
