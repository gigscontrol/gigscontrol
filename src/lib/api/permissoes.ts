import { NextResponse } from "next/server";
import type { SessaoAutenticada } from "./session";

/**
 * Camada de permissões server-side.
 *
 * O modelo de papéis tem dois eixos:
 *   1. `papel` (admin / artista / vendedor / financeiro / produtor)
 *      — usado como "função primária" para retro-compat (esse é o valor
 *      que policies antigas e código legado lêem).
 *   2. `funcoes` (mapa { vendedor: djIds[], financeiro: djIds[], produtor: djIds[] })
 *      — a fonte da verdade nova: cada função carrega a lista de DJs
 *      que o usuário atende NAQUELA função.
 *
 * Regra geral: o usuário só "tem acesso ao módulo X" se a função
 * correspondente do módulo aparece em `funcoes` com pelo menos 1 DJ.
 * Admin tem acesso a tudo; artista só vê o próprio.
 *
 * Convenção:
 *  - `aplicarFiltro*`: aceita um query builder do Supabase e adiciona
 *    `.eq(...)` / `.in(...)` para restringir resultados.
 *  - `verificarAcesso*`: retorna `NextResponse` 403 quando o papel não
 *    pode tocar aquele recurso; null quando OK.
 *  - `podeEditar*`: bool puro para validar acesso a um item específico
 *    (depende de `criado_por` ou `artist_id`).
 */

// Tipo genérico de um query builder do supabase-js.
type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  in: (column: string, values: readonly string[]) => QueryBuilder;
};

/**
 * Sentinela usada quando o usuário tem acesso "operacional" a um módulo
 * mas NENHUM DJ configurado. O filtro deve devolver zero resultados.
 * Usamos um UUID "impossível" — `eq` com ele garante 0 matches.
 */
const ZERO_RESULTS = "00000000-0000-0000-0000-000000000000";

function djsDaFuncao(
  sessao: SessaoAutenticada,
  funcao: "vendedor" | "financeiro" | "produtor"
): string[] {
  return sessao.funcoes[funcao] ?? [];
}

function temFuncao(
  sessao: SessaoAutenticada,
  funcao: "vendedor" | "financeiro" | "produtor"
): boolean {
  // "Tem a função" significa que a chave está presente — independente
  // de já ter DJ configurado. Listas vazias contam como acesso ao
  // módulo mas com zero resultados (a UI mostra estado vazio).
  return funcao in sessao.funcoes;
}

// ============================================================
// SHOWS — agenda é compartilhada com produtores; artista vê só os
// próprios; admin vê tudo. Outros papéis vêem tudo (compatibilidade
// com a Etapa anterior — produtor é apenas quem efetivamente filtra).
// ============================================================

export function aplicarFiltroShows<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (sessao.papel === "admin") return query;
  if (sessao.papel === "artista" && sessao.artistaId) {
    return query.eq("artist_id", sessao.artistaId) as Q;
  }
  if (temFuncao(sessao, "produtor")) {
    const djs = djsDaFuncao(sessao, "produtor");
    if (djs.length === 0) return query.eq("artist_id", ZERO_RESULTS) as Q;
    return query.in("artist_id", djs) as Q;
  }
  return query;
}

// ============================================================
// ORÇAMENTOS — papel admin libera tudo; vendedor com `verTodasVendas:
// false` só vê o que criou; artista só os próprios (artist_id).
// Acesso ao MÓDULO Orçamentos exige a função "vendedor".
// ============================================================

export function verificarAcessoOrcamentos(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "admin") return null;
  if (sessao.papel === "artista") return null; // artista lê os próprios
  if (!temFuncao(sessao, "vendedor")) {
    return NextResponse.json(
      { erro: "Você não tem acesso a orçamentos." },
      { status: 403 }
    );
  }
  return null;
}

export function aplicarFiltroOrcamentos<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (sessao.papel === "admin") return query;
  if (sessao.papel === "artista" && sessao.artistaId) {
    return query.eq("artist_id", sessao.artistaId) as Q;
  }
  if (temFuncao(sessao, "vendedor")) {
    const djs = djsDaFuncao(sessao, "vendedor");
    let q = djs.length === 0
      ? (query.eq("artist_id", ZERO_RESULTS) as Q)
      : (query.in("artist_id", djs) as Q);
    if (!sessao.escopo.verTodasVendas) {
      q = q.eq("criado_por", sessao.userId) as Q;
    }
    return q;
  }
  return query;
}

/** Vendedor com escopo restrito só edita o que criou. */
export function podeEditarOrcamento(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.papel === "admin") return true;
  if (!temFuncao(sessao, "vendedor")) return false;
  if (sessao.escopo.verTodasVendas) return true;
  return criadoPor === sessao.userId;
}

// ============================================================
// VENDAS — mesma estrutura de orçamentos.
// Financeiro tem acesso de LEITURA via verificarAcessoVendas (false)
// mas NÃO pode criar (verificarCriarVenda exige função vendedor).
// ============================================================

export function verificarAcessoVendas(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "admin") return null;
  if (sessao.papel === "artista") return null;
  if (temFuncao(sessao, "vendedor") || temFuncao(sessao, "financeiro")) {
    return null;
  }
  return NextResponse.json(
    { erro: "Você não tem acesso a vendas." },
    { status: 403 }
  );
}

export function verificarCriarVenda(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "admin") return null;
  if (!temFuncao(sessao, "vendedor")) {
    return NextResponse.json(
      { erro: "Apenas usuários com função de vendedor podem criar vendas." },
      { status: 403 }
    );
  }
  return null;
}

export function aplicarFiltroVendas<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (sessao.papel === "admin") return query;
  if (sessao.papel === "artista" && sessao.artistaId) {
    return query.eq("artist_id", sessao.artistaId) as Q;
  }
  // União dos DJs vendedor + financeiro (financeiro também lê vendas).
  const djs = new Set<string>();
  for (const f of ["vendedor", "financeiro"] as const) {
    if (temFuncao(sessao, f)) {
      for (const d of djsDaFuncao(sessao, f)) djs.add(d);
    }
  }
  if (djs.size === 0) return query.eq("artist_id", ZERO_RESULTS) as Q;
  let q = query.in("artist_id", Array.from(djs)) as Q;
  // Escopo "ver todas" só aplica pro vendedor; financeiro vê todas as
  // vendas dos DJs dele.
  if (
    temFuncao(sessao, "vendedor") &&
    !temFuncao(sessao, "financeiro") &&
    !sessao.escopo.verTodasVendas
  ) {
    q = q.eq("criado_por", sessao.userId) as Q;
  }
  return q;
}

export function podeEditarVenda(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.papel === "admin") return true;
  if (!temFuncao(sessao, "vendedor")) return false;
  if (sessao.escopo.verTodasVendas) return true;
  return criadoPor === sessao.userId;
}

// ============================================================
// CONTATOS — artista não vê.
// Acesso ao módulo: qualquer função operacional (vendedor / financeiro
// / produtor) tem acesso (continua sendo a "base de relacionamento").
// Vendedor com `verTodosContatos: false` só vê os que criou.
// ============================================================

export function verificarAcessoContatos(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "admin") return null;
  if (sessao.papel === "artista") {
    return NextResponse.json(
      { erro: "Artista não tem acesso a contatos." },
      { status: 403 }
    );
  }
  return null;
}

export function aplicarFiltroContratantes<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (
    temFuncao(sessao, "vendedor") &&
    !sessao.escopo.verTodosContatos
  ) {
    return query.eq("criado_por", sessao.userId) as Q;
  }
  return query;
}

// ============================================================
// PARCELAS — só admin / financeiro / vendedor (dono da venda) editam.
// O endpoint deve adicionalmente verificar se a venda da parcela
// está dentro do conjunto de DJs da função do usuário.
// ============================================================

export function verificarInformarPagamento(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "admin") return null;
  if (temFuncao(sessao, "financeiro")) return null;
  return NextResponse.json(
    { erro: "Apenas admin e financeiro podem informar pagamento." },
    { status: 403 }
  );
}

/**
 * Confere se a venda dada (pelo seu artist_id) está no escopo da função
 * informada. Usado pra autorizar edição granular de parcelas, vendas, etc.
 */
export function djAtendidoPor(
  sessao: SessaoAutenticada,
  funcao: "vendedor" | "financeiro" | "produtor",
  artistId: string | null | undefined
): boolean {
  if (sessao.papel === "admin") return true;
  if (!artistId) return false;
  const djs = djsDaFuncao(sessao, funcao);
  return djs.includes(artistId);
}
