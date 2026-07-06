import { NextResponse } from "next/server";
import { autenticar } from "@/lib/api/session";
import { respostaDeErro } from "@/lib/api/erros";
import {
  listarMinhasNotificacoes,
  contarMinhasNaoLidas,
} from "@/lib/services/notificacoes.service";

/**
 * GET /api/notificacoes?apenasNaoLidas=1&limit=&offset=
 * Lista as notificações do usuário logado + contagem de não lidas.
 *
 * Diferente da maioria das rotas, NÃO exige workspace (qualquer
 * usuário autenticado, inclusive super-admin sem workspace ativo,
 * tem caixa pessoal).
 */
export async function GET(request: Request) {
  const r = await autenticar();
  if ("response" in r) return r.response;

  const url = new URL(request.url);
  const apenasNaoLidas = url.searchParams.get("apenasNaoLidas") === "1";
  const limit = clampInt(url.searchParams.get("limit"), 1, 200, 50);
  const offset = clampInt(url.searchParams.get("offset"), 0, 100000, 0);

  try {
    const [notificacoes, naoLidas] = await Promise.all([
      listarMinhasNotificacoes(r.sessao.supabase, r.sessao.userId, {
        apenasNaoLidas,
        limit,
        offset,
      }),
      contarMinhasNaoLidas(r.sessao.supabase, r.sessao.userId),
    ]);
    return NextResponse.json({ notificacoes, naoLidas });
  } catch (e) {
    return respostaDeErro(e, "Falha ao listar notificações.");
  }
}

function clampInt(
  raw: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
