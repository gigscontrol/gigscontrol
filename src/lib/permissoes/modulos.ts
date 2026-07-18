/**
 * QUAIS MÓDULOS o usuário alcança — espelho, no CLIENTE, dos gates do SERVIDOR.
 *
 * Antes a Sidebar escondia UM único módulo ("agencia") e mostrava todos os
 * outros pra qualquer papel: o produtor só-agenda via Vendas/Financeiro/
 * Contratos/Contatos no menu, clicava e tomava 403. Este helper responde
 * "esse módulo é alcançável?" usando o MESMO motor (resolver.ts) que o
 * servidor usa, chave a chave.
 *
 * REGRA DE OURO: nunca esconder MAIS do que o servidor barra. Perder acesso
 * legítimo é pior que o bug atual. Por isso cada caso abaixo cita o gate do
 * servidor que está sendo espelhado — quando o servidor NÃO barra (só filtra),
 * o módulo só some quando o filtro devolveria zero por construção.
 *
 * Isomórfico: só depende de `resolver.ts` (que não importa nada de servidor).
 */

import { artistasVisiveis, type CtxPermissao } from "./resolver";

/** Tabs de módulo da Sidebar (espelha ActiveTab de @/types). */
export type TabModulo =
  | "agenda"
  | "vendas"
  | "financeiro"
  | "contratos"
  | "contatos"
  | "agencia";

/**
 * Alcança algum artista com QUALQUER uma das chaves. Gêmeo de `alcancaAlgum`
 * (src/lib/api/permissoes.ts:49) — se um dia mudar lá, muda aqui.
 */
function alcancaAlguma(ctx: CtxPermissao, chaves: string[]): boolean {
  for (const c of chaves) {
    const v = artistasVisiveis(ctx, c);
    if (v === "todos" || v.length > 0) return true;
  }
  return false;
}

/**
 * Algum vínculo concede QUALQUER chave do prefixo (ex.: "contatos.")? Usado
 * nos módulos cujo gate do servidor é por UNIÃO dos vínculos e inclui chaves
 * de MUTAÇÃO — quem só tem `contatos.criar` continua entrando no módulo.
 * Admin/super são resolvidos antes; artista não tem vínculo operacional.
 */
function temPrefixoEmAlgumVinculo(ctx: CtxPermissao, prefixo: string): boolean {
  const vinculos = ctx.vinculos ?? {};
  for (const chaves of Object.values(vinculos)) {
    if (chaves.some((c) => c.startsWith(prefixo))) return true;
  }
  return false;
}

/**
 * O usuário alcança este módulo? Espelha, um a um, o gate do servidor:
 *
 *  - agenda      → sem gate de módulo no servidor; `aplicarFiltroShows` filtra
 *                  por agenda.ver/agenda.ver_detalhado. Zero artistas nas duas
 *                  chaves = agenda vazia por construção.
 *  - vendas      → verificarAcessoVendas + verificarAcessoOrcamentos (403).
 *                  ATENÇÃO: o servidor devolve `null` (libera) pro papel
 *                  artista ANTES de olhar chave — então aqui o artista também
 *                  passa direto, senão a Sidebar esconderia mais que o servidor.
 *  - financeiro  → não há gate de módulo; `podeVerFinanceiro` é a autoridade
 *                  (mesma tripla de chaves). Sem nenhuma delas, todo dado
 *                  financeiro vem redigido.
 *  - contratos   → sem gate na rota; `podeVerContrato` filtra a lista e
 *                  `podeLerModelos` libera modelos com QUALQUER chave
 *                  "contratos." — daí a checagem por prefixo.
 *  - contatos    → verificarAcessoContatos barra o papel ARTISTA (403). Equipe
 *                  entra, mas `escopoContatosEquipe` devolve "nenhum" sem
 *                  chave de contatos → lista vazia por construção.
 *  - agencia     → verificarAdminDoWorkspace: admin/super e mais ninguém.
 */
/** Alcança a AGENDA de shows (dashboard + calendário) por chave de agenda. */
function podeVerAgendaShows(ctx: CtxPermissao): boolean {
  return alcancaAlguma(ctx, ["agenda.ver", "agenda.ver_detalhado"]);
}

/**
 * Alcança ANOTAÇÕES. Espelha `podeVerAnotacao` (api/permissoes.ts): no regime
 * LEGADO — sem nenhuma chave `anotacoes.*` concedida no workspace — a leitura
 * é aberta (a RLS da pasta é o gate), então devolve true. Assim ninguém perde
 * a base de conhecimento que já lia. Quando o admin começar a usar as chaves
 * novas, o regime aperta pra quem tiver vínculo.
 */
function podeVerAnotacoesUI(_ctx: CtxPermissao): boolean {
  // HOJE é sempre true, e isso é INTENCIONAL: `podeVerAnotacao` no servidor
  // devolve true no regime legado (RLS da pasta é o gate) e, no regime de
  // chaves, quem tem a chave também passa. Esconder a subpágina aqui revogaria
  // em silêncio a base de conhecimento de quem já a lia — pior que o bug que
  // esta tarefa conserta. É o ÚNICO ponto a mexer se o dono decidir fechar
  // Anotações por permissão (a chave `anotacoes.ver` já existe para isso).
  return true;
}

/**
 * Subpáginas visíveis de um módulo. Hoje só a AGENDA precisa: ela hospeda
 * "Anotações", que tem gate PRÓPRIO — quem não tem chave de agenda mas lê
 * anotações vê a tab só com essa subpágina (em vez de perder a porta).
 * Módulo sem regra especial devolve tudo (o gate é o do módulo).
 */
export function subPaginasVisiveis<T extends { page: string }>(
  ctx: CtxPermissao,
  tab: TabModulo,
  subPages: T[]
): T[] {
  if (ctx.isSuperAdmin || ctx.papel === "admin") return subPages;
  if (tab !== "agenda") return subPages;
  const shows = podeVerAgendaShows(ctx) || ctx.papel === "artista";
  const notas = podeVerAnotacoesUI(ctx);
  return subPages.filter((s) =>
    s.page === "agenda-anotacoes" ? notas : shows
  );
}

export function podeVerModulo(ctx: CtxPermissao, tab: TabModulo): boolean {
  // Admin e super-admin (inclusive em modo visitante) veem tudo, como hoje.
  if (ctx.isSuperAdmin || ctx.papel === "admin") return true;

  switch (tab) {
    case "agencia":
      return false;

    case "agenda":
      // ANOTAÇÕES NÃO É MÓDULO PRÓPRIO: é a subpágina `agenda-anotacoes` DENTRO
      // da tab Agenda (Sidebar.tsx). Esconder a tab por falta de `agenda.ver`
      // fecharia a ÚNICA porta pra uma tela que o servidor libera por outro
      // gate (`podeVerAnotacao` + RLS da pasta) — e no regime LEGADO (o de 100%
      // dos usuários hoje, já que as chaves acabaram de nascer) esse gate
      // devolve `true` pra qualquer um do workspace. Por isso a tab aparece
      // sempre que QUALQUER subpágina for alcançável; quem não tem chave de
      // agenda vê a tab só com "Anotações" (ver `subPaginasVisiveis`).
      return podeVerAgendaShows(ctx) || podeVerAnotacoesUI(ctx);

    case "vendas":
      if (ctx.papel === "artista") return true; // servidor libera o artista
      return alcancaAlguma(ctx, [
        "vendas.ver",
        "vendas.ver_proprios",
        "vendas.ver_orcamentos",
      ]);

    case "financeiro":
      return alcancaAlguma(ctx, [
        "financeiro.ver",
        "financeiro.registrar_pagamento",
        "financeiro.editar_pagamento",
      ]);

    case "contratos":
      // Artista: governado pela privacidade. `contratosVer` e `contratosCriar`
      // são flags INDEPENDENTES (PrivacidadeDj) e o servidor autoriza a
      // mutação só com `contratosCriar` — então "ver desligado + gerar ligado"
      // é config alcançável, e exigir só `contratos.ver` esconderia um módulo
      // que o servidor deixa usar. Mesma lógica do financeiro (inclui mutação).
      if (ctx.papel === "artista")
        return alcancaAlguma(ctx, ["contratos.ver", "contratos.criar"]);
      return (
        alcancaAlguma(ctx, ["contratos.ver"]) ||
        temPrefixoEmAlgumVinculo(ctx, "contratos.")
      );

    case "contatos":
      if (ctx.papel === "artista") return false; // servidor devolve 403
      return temPrefixoEmAlgumVinculo(ctx, "contatos.");

    default:
      return false;
  }
}
