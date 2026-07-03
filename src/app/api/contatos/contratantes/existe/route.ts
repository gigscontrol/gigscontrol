import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { verificarAcessoContatos } from "@/lib/api/permissoes";

/**
 * GET /api/contatos/contratantes/existe?documento=X | ?nome=Y
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
  const g = verificarAcessoContatos(r.sessao);
  if (g) return g;

  const url = new URL(request.url);
  const documento = url.searchParams.get("documento")?.trim() || "";
  const nome = url.searchParams.get("nome")?.trim() || "";
  if (!documento && !nome) {
    return NextResponse.json({ existe: false, contratante: null });
  }

  try {
    let q = r.sessao.supabase
      .from("contratantes")
      .select("id, nome, documento, telefone, email, cidade_id")
      .is("deletado_em", null)
      .limit(1);
    // Documento é o match mais forte (CPF/CNPJ). Sem ele, nome exato (case-insensitive).
    q = documento ? q.eq("documento", documento) : q.ilike("nome", nome);
    const { data, error } = await q;
    if (error) throw error;
    const c = (data ?? [])[0] ?? null;
    return NextResponse.json({ existe: !!c, contratante: c });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar contratante." },
      { status: 500 }
    );
  }
}
