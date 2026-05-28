import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { lookupOuCriarCidadePorIbge } from "@/lib/services/cidades.service";

/**
 * POST /api/contatos/cidades/lookup-ibge
 *
 * Recebe os dados de uma cidade do catálogo IBGE escolhida pelo usuário
 * no autocomplete e devolve a cidade correspondente na tabela `cidades`
 * do workspace — criando se ainda não existe (com geocode OSM).
 *
 * É o "tradutor" entre o ID do IBGE (texto, nacional) e o UUID local
 * (FK em orcamentos/vendas/shows/etc).
 *
 * Body:  { ibgeId: string; nome: string; uf: string }
 * Resp:  { cidade: { id, nome, estado, regiao, latitude?, longitude?, ibgeId } }
 */

const schema = z.object({
  ibgeId: z.string().min(1).max(20),
  nome: z.string().min(1).max(120),
  uf: z.string().length(2),
});

export async function POST(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  const bloqueio = verificarAcessoContatos(r.sessao);
  if (bloqueio) return bloqueio;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: "Dados inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const cidade = await lookupOuCriarCidadePorIbge(
      r.sessao.supabase,
      r.sessao.workspaceId,
      {
        ibgeId: parsed.data.ibgeId,
        nome: parsed.data.nome,
        uf: parsed.data.uf.toUpperCase(),
      }
    );
    return NextResponse.json({ cidade });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao registrar cidade." },
      { status: 500 }
    );
  }
}
