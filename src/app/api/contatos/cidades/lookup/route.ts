import { NextResponse } from "next/server";
import { z } from "zod";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { lookupOuCriarCidade } from "@/lib/services/cidades.service";
import { respostaDeErro } from "@/lib/api/erros";

/**
 * POST /api/contatos/cidades/lookup
 *
 * Lookup-or-create UNIFICADO de cidade (Brasil via IBGE OU mundo via
 * GeoNames). Traduz a cidade escolhida no autocomplete pro UUID local
 * (FK em orcamentos/vendas/shows/casas/contratantes).
 *
 * Body: { ibgeId?, geonameId?, nome, uf, pais, latitude?, longitude? }
 * Resp: { cidade: { id, nome, estado, pais, latitude?, longitude?, ... } }
 */
const schema = z.object({
  ibgeId: z.string().min(1).max(20).optional(),
  geonameId: z.string().min(1).max(20).optional(),
  nome: z.string().min(1).max(120),
  // Opcional com default: cidade do GeoNames pode vir SEM estado/província
  // (adminName1 vazio) — exigir string derrubava a venda inteira do Paraguai
  // com 400 "Dados inválidos" no resolverCidade.
  uf: z.string().max(120).optional().default(""),
  pais: z.string().length(2),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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
    const cidade = await lookupOuCriarCidade(r.sessao.supabase, r.sessao.workspaceId, {
      ...parsed.data,
      pais: parsed.data.pais.toUpperCase(),
    });
    return NextResponse.json({ cidade });
  } catch (e) {
    return respostaDeErro(e, "Falha ao registrar cidade.");
  }
}
