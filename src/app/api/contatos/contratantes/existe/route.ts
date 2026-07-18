import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";
import { respostaDeErro } from "@/lib/api/erros";
import { variantesTelefone } from "@/lib/telefone";

/**
 * GET /api/contatos/contratantes/existe?documento=X | ?telefone=Y | ?nome=Z
 *
 * Atalho ANTI-DUPLICATA. Ao montar um orçamento/venda, se a pessoa digita um
 * contratante que NÃO está na lista visível dela (visibilidade derivada), a UI
 * chama aqui: busca no workspace INTEIRO (RLS escopa por tenant), ignorando a
 * visibilidade derivada, mas SÓ por match forte (documento exato ou nome exato)
 * — pra oferecer "já existe, quer usar?" em vez de criar um contato duplicado.
 * Não é um browse: sem documento/nome, não devolve nada.
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;
  // Artista NÃO é barrado aqui — espelha o GET de listagem (contratantes/route.ts:20).
  // O `contratantes` do contexto do artista é filtrado por visibilidade derivada,
  // então este endpoint é o ÚNICO caminho que reencontra o contato já cadastrado
  // pelo telefone (D1). Barrado, o artista cai no ramo "novo" → o POST de criação
  // 403a → a venda inteira falha. Não vira browse: uma linha só, por match forte.
  if (r.sessao.papel !== "artista") {
    const g = verificarAcessoContatos(r.sessao);
    if (g) return g;
  }

  const url = new URL(request.url);
  const documento = url.searchParams.get("documento")?.trim() || "";
  const telefone = url.searchParams.get("telefone")?.trim() || "";
  const nome = url.searchParams.get("nome")?.trim() || "";
  if (!documento && !telefone && !nome) {
    return NextResponse.json({ existe: false, contratante: null });
  }

  try {
    let q = r.sessao.supabase
      .from("contratantes")
      // endereco/pais entram porque o popup de divergência compara campo-a-campo
      // contra o cadastro — sem eles, tudo "diverge" contra undefined.
      .select("id, nome, documento, telefone, email, cidade_id, endereco, pais")
      .is("deletado_em", null)
      .limit(1);
    // Match do mais forte pro mais fraco: documento (CPF/CNPJ) → telefone
    // → nome exato (case-insensitive). Escapa %/_/\ no nome pra o `ilike` virar
    // igualdade case-insensitive de verdade — senão `?nome=%` casaria QUALQUER
    // contratante do tenant e vazaria PII de contatos fora da visibilidade.
    // Telefone: `.in()` com as VARIANTES exatas (com/sem 9, com/sem DDI 55) —
    // o banco tem números salvos sem o nono dígito e a igualdade exata nunca
    // casava. Conjunto finito de formas exatas: nada de curinga, o endpoint
    // continua sem browse.
    const nomeExato = nome.replace(/[\\%_]/g, (m) => `\\${m}`);
    q = documento
      ? q.eq("documento", documento)
      : telefone
        ? q.in("telefone", variantesTelefone(telefone))
        : q.ilike("nome", nomeExato);
    const { data, error } = await q;
    if (error) throw error;
    const c = (data ?? [])[0] ?? null;
    return NextResponse.json({ existe: !!c, contratante: c });
  } catch (e) {
    return respostaDeErro(e, "Falha ao buscar contratante.");
  }
}
