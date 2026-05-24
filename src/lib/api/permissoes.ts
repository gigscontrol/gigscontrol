import { NextResponse } from "next/server";
import type { SessaoAutenticada } from "./session";

/**
 * Camada de permissões server-side — Etapa 10.
 *
 * As verificações abaixo aplicam as regras de papel + escopo direto na
 * query do Supabase, em complemento ao RLS por workspace_id que já
 * existe no banco.
 *
 * Convenção:
 *  - `aplicarFiltro*`: aceita um query builder do Supabase e adiciona
 *    `.eq(...)` quando o usuário não pode ver tudo.
 *  - `verificarAcesso*`: retorna `NextResponse` 403 quando o papel não
 *    pode tocar aquele recurso; null quando OK.
 *  - `podeEditar*`: bool puro para validar acesso a um item específico
 *    (depende de `criado_por`).
 */

// Tipo genérico de um query builder do supabase-js. Não importamos o
// tipo nominal direto pra evitar acoplamento; usamos a forma estrutural.
type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  // Não usamos outras operations aqui; mantemos minimal.
};

// ============================================================
// SHOWS — agenda é compartilhada; artista vê só os próprios.
// Produtor/financeiro/admin/vendedor/sem escopo — vê tudo.
// ============================================================

export function aplicarFiltroShows<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (sessao.papel === "artista" && sessao.artistaId) {
    return query.eq("artist_id", sessao.artistaId) as Q;
  }
  return query;
}

// ============================================================
// ORÇAMENTOS — vendedor com `verTodasVendas: false` só os próprios.
//              Artista só os próprios (artist_id).
//              Produtor: 403 (não tem acesso ao módulo).
// ============================================================

export function verificarAcessoOrcamentos(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "produtor") {
    return NextResponse.json(
      { erro: "Produtor não tem acesso a orçamentos." },
      { status: 403 }
    );
  }
  return null;
}

export function aplicarFiltroOrcamentos<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (sessao.papel === "artista" && sessao.artistaId) {
    return query.eq("artist_id", sessao.artistaId) as Q;
  }
  if (sessao.papel === "vendedor" && !sessao.escopo.verTodasVendas) {
    return query.eq("criado_por", sessao.userId) as Q;
  }
  return query;
}

/** Vendedor com escopo restrito só edita os próprios orçamentos. */
export function podeEditarOrcamento(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.papel === "admin") return true;
  if (sessao.papel === "vendedor") {
    if (sessao.escopo.verTodasVendas) return true;
    return criadoPor === sessao.userId;
  }
  return false;
}

// ============================================================
// VENDAS — mesma regra de orçamentos.
//          Financeiro: leitura ok, criação não.
// ============================================================

export function verificarAcessoVendas(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "produtor") {
    return NextResponse.json(
      { erro: "Produtor não tem acesso a vendas." },
      { status: 403 }
    );
  }
  return null;
}

export function verificarCriarVenda(
  sessao: SessaoAutenticada
): NextResponse | null {
  const podeCriar =
    sessao.papel === "admin" || sessao.papel === "vendedor";
  if (!podeCriar) {
    return NextResponse.json(
      { erro: `Papel ${sessao.papel} não pode criar vendas.` },
      { status: 403 }
    );
  }
  return null;
}

export function aplicarFiltroVendas<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (sessao.papel === "artista" && sessao.artistaId) {
    return query.eq("artist_id", sessao.artistaId) as Q;
  }
  if (sessao.papel === "vendedor" && !sessao.escopo.verTodasVendas) {
    return query.eq("criado_por", sessao.userId) as Q;
  }
  return query;
}

export function podeEditarVenda(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.papel === "admin") return true;
  if (sessao.papel === "vendedor") {
    if (sessao.escopo.verTodasVendas) return true;
    return criadoPor === sessao.userId;
  }
  return false;
}

// ============================================================
// CONTATOS — artista não vê.
//            Vendedor com `verTodosContatos: false` só os que criou.
// ============================================================

export function verificarAcessoContatos(
  sessao: SessaoAutenticada
): NextResponse | null {
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
  if (sessao.papel === "vendedor" && !sessao.escopo.verTodosContatos) {
    return query.eq("criado_por", sessao.userId) as Q;
  }
  return query;
}

// ============================================================
// PARCELAS — só financeiro/admin/vendedor (dono da venda) editam.
// ============================================================

export function verificarInformarPagamento(
  sessao: SessaoAutenticada
): NextResponse | null {
  const pode =
    sessao.papel === "admin" || sessao.papel === "financeiro";
  if (!pode) {
    return NextResponse.json(
      { erro: `Papel ${sessao.papel} não pode informar pagamento.` },
      { status: 403 }
    );
  }
  return null;
}
