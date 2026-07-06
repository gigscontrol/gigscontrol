import { NextResponse } from "next/server";
import { autenticar } from "@/lib/api/session";
import { respostaDeErro } from "@/lib/api/erros";
import { marcarTodasMinhasLidas } from "@/lib/services/notificacoes.service";

/**
 * POST /api/notificacoes/marcar-todas-lidas
 * Marca todas as notificações não lidas do usuário logado como lidas.
 */
export async function POST() {
  const r = await autenticar();
  if ("response" in r) return r.response;
  try {
    await marcarTodasMinhasLidas(r.sessao.supabase, r.sessao.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e, "Falha ao marcar como lidas.");
  }
}
