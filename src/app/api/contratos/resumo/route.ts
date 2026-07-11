import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { resumoContratosDoWorkspace } from "@/lib/services/contratos.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * GET /api/contratos/resumo?inicio=<iso>&fim=<iso>
 *
 * KPIs do dashboard de Contratos computados NO SERVIDOR (passo 1 da paginação):
 * o cliente recebe só os números + listinhas curtas em vez do array inteiro.
 * `inicio`/`fim` ausentes = "Visão geral" (tudo). Escopado por artista — mesma
 * regra da listagem (`listarContratosDoWorkspace`).
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  try {
    const { searchParams } = new URL(request.url);
    const inicio = searchParams.get("inicio");
    const fim = searchParams.get("fim");
    const resumo = await resumoContratosDoWorkspace(
      r.sessao.supabase,
      r.sessao,
      inicio,
      fim
    );
    return NextResponse.json({ resumo });
  } catch (e) {
    return respostaDeErro(e, "Falha ao resumir contratos.");
  }
}
