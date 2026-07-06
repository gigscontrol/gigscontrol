import { NextResponse } from "next/server";
import { autenticar } from "@/lib/api/session";
import { respostaDeErro } from "@/lib/api/erros";
import { marcarLidaPorId } from "@/lib/services/notificacoes.service";

type RouteCtx = { params: { id: string } };

/**
 * POST /api/notificacoes/:id/marcar-lida
 * Marca uma notificação específica como lida. Só funciona se o
 * destinatario_id bate com o usuário logado (RLS garante isso).
 */
export async function POST(_request: Request, { params }: RouteCtx) {
  const r = await autenticar();
  if ("response" in r) return r.response;
  try {
    await marcarLidaPorId(r.sessao.supabase, params.id, r.sessao.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao marcar como lida.");
  }
}
