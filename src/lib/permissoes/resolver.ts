/**
 * MOTOR DE PERMISSÕES — a fonte ÚNICA da verdade de acesso.
 *
 * Usado no SERVIDOR (segurança, nas rotas/services) E no CLIENTE (esconder/
 * desabilitar botão). A pergunta é sempre a mesma:
 *
 *   pode(ctx, artistaId, "financeiro.editar_pagamento")  ->  boolean
 *
 * Regras:
 *   - super-admin / admin  → tudo.
 *   - artista (papel)      → só o próprio artista.
 *   - demais               → o que o VÍNCULO (usuário × artista) concede.
 *   - sem vínculo          → sem acesso (exceto admin).
 *
 * FALLBACK: enquanto os vínculos ainda não são carregados na sessão (Fase 1/2),
 * `vinculos` vem `undefined` e o motor cai no comportamento LEGADO (papel +
 * funcoes + escopo) — assim o app se comporta EXATAMENTE como hoje até a virada.
 */

import type { Papel } from "@/lib/permissoes";
import type { Funcoes } from "@/lib/mappers/usuario";
import type { EscopoSessao } from "@/lib/api/session";

export type CtxPermissao = {
  isSuperAdmin: boolean;
  papel: Papel;
  /** Artista dono, quando papel === "artista". */
  artistaId: string | null;
  /**
   * Vínculos por artista → chaves de permissão concedidas.
   * `undefined` = ainda não carregado → usa o fallback legado.
   */
  vinculos?: Record<string, string[]>;
  // ---- Legado (só usado no fallback) ----
  funcoes?: Funcoes;
  escopo?: EscopoSessao;
};

type FuncaoLegada = "vendedor" | "financeiro" | "produtor";

function djLegado(ctx: CtxPermissao, funcao: FuncaoLegada, artistaId: string): boolean {
  const arr = ctx.funcoes?.[funcao] ?? [];
  return arr.includes(artistaId);
}

/**
 * Comportamento LEGADO (papel/funcoes) — espelha o que o app faz HOJE, pra que
 * ligar o motor antes da migração 100% não mude nada. Só é chamado quando não
 * há vínculos carregados.
 */
function fallbackLegado(ctx: CtxPermissao, artistaId: string, chave: string): boolean {
  const modulo = chave.split(".")[0];
  switch (modulo) {
    case "agenda":
      // Hoje a agenda não tem trava por função — toda a equipe opera.
      return true;
    case "vendas":
      return djLegado(ctx, "vendedor", artistaId) || djLegado(ctx, "financeiro", artistaId);
    case "financeiro":
      return djLegado(ctx, "financeiro", artistaId);
    case "contratos":
      // Hoje contratos é admin-only (admin já retornou true antes daqui).
      return false;
    case "contatos":
      // Hoje qualquer não-artista acessa contatos.
      return ctx.papel !== "artista";
    case "agencia":
      return false; // administrativo = admin-only
    default:
      return false;
  }
}

/**
 * O usuário PODE fazer `chave` no `artistaId`?
 */
export function pode(ctx: CtxPermissao, artistaId: string | null, chave: string): boolean {
  if (ctx.isSuperAdmin || ctx.papel === "admin") return true;

  if (ctx.papel === "artista") {
    // Dono vê/opera o próprio artista. (Refino por artists.privacidade fica
    // pra Fase 3; hoje o artista já é escopado ao próprio.)
    return !!artistaId && artistaId === ctx.artistaId;
  }

  if (!artistaId) return false;

  if (ctx.vinculos) {
    return (ctx.vinculos[artistaId] ?? []).includes(chave);
  }

  return fallbackLegado(ctx, artistaId, chave);
}

/**
 * Quais artistas o usuário pode ALCANÇAR (opcionalmente exigindo `chave`).
 * Retorna "todos" (admin) ou a lista de artist_ids. Use pra filtrar queries
 * (.in("artist_id", ids)).
 */
export function artistasVisiveis(
  ctx: CtxPermissao,
  chave?: string
): "todos" | string[] {
  if (ctx.isSuperAdmin || ctx.papel === "admin") return "todos";
  if (ctx.papel === "artista") return ctx.artistaId ? [ctx.artistaId] : [];

  if (ctx.vinculos) {
    return Object.keys(ctx.vinculos).filter(
      (a) => !chave || (ctx.vinculos![a] ?? []).includes(chave)
    );
  }

  // Fallback legado: união dos DJs das funções.
  const set = new Set<string>();
  for (const f of ["vendedor", "financeiro", "produtor"] as const) {
    for (const dj of ctx.funcoes?.[f] ?? []) set.add(dj);
  }
  return [...set];
}

/** Açúcar: monta o ctx a partir de uma sessão do servidor. */
export function ctxDaSessao(sessao: {
  isSuperAdmin: boolean;
  papel: Papel;
  artistaId: string | null;
  funcoes: Funcoes;
  escopo: EscopoSessao;
  vinculos?: Record<string, string[]>;
}): CtxPermissao {
  return {
    isSuperAdmin: sessao.isSuperAdmin,
    papel: sessao.papel,
    artistaId: sessao.artistaId,
    vinculos: sessao.vinculos,
    funcoes: sessao.funcoes,
    escopo: sessao.escopo,
  };
}
