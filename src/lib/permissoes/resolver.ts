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
 *   - artista (papel)      → só o próprio artista, governado pela privacidade.
 *   - demais (operacional) → o que o VÍNCULO (usuário × artista) concede.
 *   - sem vínculo          → sem acesso (exceto admin).
 *
 * O sistema LEGADO (profiles.funcoes/escopo + fallback) foi REMOVIDO: equipe =
 * 100% vínculos por artista (membros_artista.permissoes). Operacional sem
 * vínculo no artista → negado.
 */

import { PRIVACIDADE_DJ_PADRAO, type Papel, type PrivacidadeDj } from "@/lib/permissoes";

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
   * Vínculos por artista → chaves de permissão concedidas. Fonte única de
   * acesso do operacional. Pode vir vazio ({}) ou ausente → operacional é
   * negado em qualquer artista (sem fallback legado).
   */
  vinculos?: Record<string, string[]>;
};

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
    case "vendas": {
      // Orçamentos e vendas são governados por FLAGS INDEPENDENTES.
      const ehOrcamento = acao.includes("orcamento");
      if (ehLeitura) {
        // Leitura ESPECÍFICA de orçamentos (vendas.ver_orcamentos) → orcamentosVer.
        // A chave genérica vendas.ver (sem contexto de qual lista) mantém o
        // comportamento de hoje: libera se pode ver vendas OU orçamentos — a
        // lista combinada é filtrada no servidor.
        if (ehOrcamento) return priv.orcamentosVer;
        return priv.vendasVer || priv.orcamentosVer;
      }
      // Mutação: "orcamento" → orcamentosCriar; as demais (criar_venda,
      // editar_venda, converter, cancelar_venda, excluir_venda, editar_todos)
      // → vendasCriar.
      return ehOrcamento ? priv.orcamentosCriar : priv.vendasCriar;
    }
    case "financeiro":
      // Ver a taxa/líquido é um flag PRÓPRIO (financeiroVerTaxa); o restante da
      // leitura financeira é financeiroVer; mutações = financeiroInformar.
      if (acao === "ver_taxa") return priv.financeiroVerTaxa;
      if (ehLeitura) return priv.financeiroVer;
      return priv.financeiroInformar; // registrar/cancelar/editar_pagamento
    case "contratos":
      // Excluir contrato é ADMIN-ONLY: o artista NUNCA exclui (nem dentro de
      // contratosCriar). criar/editar/editar_todos/cancelar = contratosCriar.
      if (acao === "excluir") return false;
      if (ehLeitura) return priv.contratosVer;
      return priv.contratosCriar;
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

  // Operacional: só o que o VÍNCULO no artista concede. Sem vínculo = negado.
  if (!artistaId) return false;
  return (ctx.vinculos?.[artistaId] ?? []).includes(chave);
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

  // Operacional: os artistas com vínculo (que concedam a chave, se exigida).
  const vinculos = ctx.vinculos ?? {};
  return Object.keys(vinculos).filter(
    (a) => !chave || (vinculos[a] ?? []).includes(chave)
  );
}

/** Açúcar: monta o ctx a partir de uma sessão do servidor. */
export function ctxDaSessao(sessao: {
  isSuperAdmin: boolean;
  papel: Papel;
  artistaId: string | null;
  vinculos?: Record<string, string[]>;
  privacidade?: PrivacidadeDj;
}): CtxPermissao {
  return {
    isSuperAdmin: sessao.isSuperAdmin,
    papel: sessao.papel,
    artistaId: sessao.artistaId,
    privacidade: sessao.privacidade,
    vinculos: sessao.vinculos,
  };
}
