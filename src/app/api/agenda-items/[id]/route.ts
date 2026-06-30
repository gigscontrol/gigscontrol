import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { removerAgendaItemPorId } from "@/lib/services/agendaItems.service";

type RouteCtx = { params: { id: string } };

/** DELETE /api/agenda-items/:id — soft delete. */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  const r = await autenticarComWorkspace();
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
