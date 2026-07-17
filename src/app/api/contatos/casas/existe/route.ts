import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";
import { normalizar } from "@/lib/normalizar";

/**
 * GET /api/contatos/casas/existe?nome=X&cidade_id=Y
 *
 * Atalho ANTI-DUPLICATA da casa, espelhando o de contratantes. Ao concretizar
 * uma venda/orçamento a casa nasce junto — mas `listarCasasDoWorkspace` filtra
 * por visibilidade derivada pro artista, então o dedupe client-side é CEGO: o
 * artista não vê a casa que já existe e cria outra igual. Aqui a busca é no
 * workspace inteiro (RLS escopa por tenant), ignorando a visibilidade derivada.
 *
 * Chave de dedupe = (nome normalizado) + cidade_id. Mesma casa na mesma cidade
 * nunca duplica; mesmo nome em cidade diferente = casa diferente. Não é um
 * browse: sem os dois parâmetros, não devolve nada.
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Artista NÃO é barrado aqui — espelha o GET de listagem (casas/route.ts:20).
  // Barrar aqui quebraria o dedupe justamente pra quem mais precisa dele: o
  // `casas` do contexto do artista é filtrado por visibilidade derivada, então
  // este endpoint é o ÚNICO caminho que enxerga a casa que já existe. Sem ele o
  // artista perde o vínculo com a casa (D4). Não vira browse: o retorno é uma
  // linha só, por match forte (nome exato + cidade), e o RLS escopa por tenant.
  if (r.sessao.papel !== "artista") {
    const g = verificarAcessoContatos(r.sessao);
    if (g) return g;
  }

  const url = new URL(request.url);
  const nome = url.searchParams.get("nome")?.trim() || "";
  const cidadeId = url.searchParams.get("cidade_id")?.trim() || "";
  if (!nome || !cidadeId) {
    return NextResponse.json({ existe: false, casa: null });
  }

  try {
    // Compara em JS com o `normalizar` canônico (acento/caixa) — a mesma função
    // do front — e o escopo é uma cidade só, poucas linhas.
    const { data, error } = await r.sessao.supabase
      .from("casas")
      .select("id, nome, tipo, cidade_id")
      .eq("cidade_id", cidadeId)
      .is("deletado_em", null);
    if (error) throw error;

    const alvo = normalizar(nome);
    const casa = (data ?? []).find((c) => normalizar(c.nome ?? "") === alvo) ?? null;
    return NextResponse.json({ existe: !!casa, casa });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar casa.");
  }
}
