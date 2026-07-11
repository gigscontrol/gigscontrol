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

import { PRIVACIDADE_DJ_PADRAO, type Papel, type PrivacidadeDj } from "@/lib/permissoes";
import type { Funcoes } from "@/lib/mappers/usuario";
import type { EscopoSessao } from "@/lib/api/session";

export type CtxPermissao = {
  isSuperAdmin: boolean;
  papel: Papel;
  /** Artista dono, quando papel === "artista". */
  artistaId: string | null;
  /**
   * Privacidade do artista (papel === "artista"): o que o admin AUTORIZOU o
   * artista a ver/fazer no próprio espaço. `undefined` → usa o padrão seguro
   * (PRIVACIDADE_DJ_PADRAO: vê o próprio, NÃO muta nada).
   */
  privacidade?: PrivacidadeDj;
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
 * O que o ARTISTA pode fazer no PRÓPRIO espaço, governado pela privacidade que
 * o admin configurou (artists.privacidade). LEITURA por padrão liberada; toda
 * MUTAÇÃO exige um switch explícito ("só se autorizado"). Sem privacidade
 * carregada → PRIVACIDADE_DJ_PADRAO (vê o próprio, não muta).
 */
function podeArtista(priv: PrivacidadeDj, chave: string): boolean {
  const [modulo, ...rest] = chave.split(".");
  const acao = rest.join(".");
  const ehLeitura = acao.startsWith("ver");
  switch (modulo) {
    case "agenda":
      // Vê a própria agenda (e detalhes/cachê) sempre. Cria/edita/exclui os
      // próprios eventos só com agendaTotal ligado; senão fica read-only.
      return ehLeitura || priv.agendaTotal;
    case "vendas":
      if (ehLeitura) return priv.vendasVer || priv.orcamentosVer;
      if (acao.includes("orcamento")) return priv.orcamentosCriar;
      return priv.vendasCriar; // criar/editar/excluir_venda + converter
    case "financeiro":
      if (ehLeitura) return priv.financeiroVer;
      return priv.financeiroInformar; // registrar/cancelar/editar_pagamento
    case "contratos":
      if (ehLeitura) return priv.contratosVer;
      return priv.contratosCriar; // criar/editar/excluir
    case "contatos":
      // Leitura governada por priv.contatos: "nenhum" nega, "proprios"/"todos"
      // liberam VER (a lista é filtrada no servidor por escopoContatosDoArtista).
      // Artista nunca MUTA contatos (não cria/edita/exclui).
      if (ehLeitura) return priv.contatos !== "nenhum";
      return false;
    case "agencia":
    default:
      return false; // artista nunca acessa agência por aqui
  }
}

/**
 * Escopo de CONTATOS (contratantes/casas) que o ARTISTA enxerga, governado por
 * `artists.privacidade.contatos` (config do admin):
 *   - "nenhum"   → não vê nenhum contato (lista vazia);
 *   - "proprios" → só os contatos ligados aos SHOWS/vendas/orçamentos DELE
 *                  (derivado por artist_id no servidor);
 *   - "todos"    → todos os contatos do workspace.
 * Sem privacidade carregada → PRIVACIDADE_DJ_PADRAO ("proprios", seguro).
 */
export function escopoContatosDoArtista(
  priv?: PrivacidadeDj
): "nenhum" | "proprios" | "todos" {
  return (priv ?? PRIVACIDADE_DJ_PADRAO).contatos;
}

/**
 * O usuário PODE fazer `chave` no `artistaId`?
 */
export function pode(ctx: CtxPermissao, artistaId: string | null, chave: string): boolean {
  if (ctx.isSuperAdmin || ctx.papel === "admin") return true;

  if (ctx.papel === "artista") {
    // Só o próprio artista, e só o que a privacidade (config do admin) autoriza.
    if (!artistaId || artistaId !== ctx.artistaId) return false;
    return podeArtista(ctx.privacidade ?? PRIVACIDADE_DJ_PADRAO, chave);
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
  if (ctx.papel === "artista") {
    if (!ctx.artistaId) return [];
    // Se uma chave de leitura foi exigida e a privacidade nega esse módulo,
    // o artista não alcança nem o próprio (filtro de leitura devolve zero).
    if (chave && !podeArtista(ctx.privacidade ?? PRIVACIDADE_DJ_PADRAO, chave)) {
      return [];
    }
    return [ctx.artistaId];
  }

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
  privacidade?: PrivacidadeDj;
}): CtxPermissao {
  return {
    isSuperAdmin: sessao.isSuperAdmin,
    papel: sessao.papel,
    artistaId: sessao.artistaId,
    privacidade: sessao.privacidade,
    vinculos: sessao.vinculos,
    funcoes: sessao.funcoes,
    escopo: sessao.escopo,
  };
}
