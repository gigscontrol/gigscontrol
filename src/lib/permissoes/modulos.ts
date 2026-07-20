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
import { CHAVES_SETORES_AGENDA } from "./setoresAgenda";

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
 *                  Ambos exigem QUALQUER das 7 chaves v2 de vendas no artista
 *                  (VENDAS_CHAVES_MODULO) — a autoria só filtra o que aparece.
 *                  ATENÇÃO: o servidor devolve `null` (libera) pro papel
 *                  artista ANTES de olhar chave — então aqui o artista também
 *                  passa direto, senão a Sidebar esconderia mais que o servidor.
 *  - financeiro  → não há gate de módulo; `podeVerFinanceiro` é a autoridade
 *                  (QUALQUER das 8 chaves v2 no artista). Sem nenhuma delas,
 *                  todo dado financeiro vem redigido.
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
  // Qualquer SETOR da ficha do show dá acesso à agenda — espelha
  // `aplicarFiltroShows` no servidor. As chaves de 2 níveis viraram legado e
  // são expandidas na leitura da sessão (`expandirLegadoAgenda`).
  return alcancaAlguma(ctx, [...CHAVES_SETORES_AGENDA]);
}

/**
 * Alcança ANOTAÇÕES. O dono mandou FECHAR a leitura (L1) — este era o "único
 * ponto a mexer" e é agora. Espelha `podeVerAnotacao` (api/permissoes.ts), mas
 * sempre pelo lado MAIS PERMISSIVO: o cliente não sabe de pasta nem de show, e
 * esconder a subpágina de quem o servidor deixaria entrar fecharia a única
 * porta pra /app/agenda/anotacoes. Então mostra a porta quando ele PODE ter
 * conteúdo:
 *   - `anotacoes.*` em algum vínculo (regra (a), e também criar/editar);
 *   - agenda de shows (regra (b): notas dos shows que ele alcança);
 *   - MEMBRO EXPLÍCITO de alguma pasta (regra (c)) — via o flag
 *     `temPastaCompartilhada`, carregado uma vez na sessão (auth-context);
 *   - booleano legado `pode_criar_anotacoes` (quem já trabalha na base).
 * O servidor filtra a lista de verdade — a tela pode aparecer vazia, o que é
 * aceitável; o inverso (sumir a porta de quem tem acesso) não é.
 */
function podeVerAnotacoesUI(ctx: CtxPermissao): boolean {
  if (ctx.podeCriarAnotacoes) return true; // legado — nunca revogado
  if (temPrefixoEmAlgumVinculo(ctx, "anotacoes.")) return true;
  if (ctx.temPastaCompartilhada) return true; // regra (c) — compartilhamento explícito
  return podeVerAgendaShows(ctx) || ctx.papel === "artista";
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
      // gate (`podeVerAnotacao` + RLS da pasta). Por isso a tab aparece sempre
      // que QUALQUER subpágina for alcançável; quem não tem chave de agenda mas
      // alcança anotações vê a tab só com "Anotações" (ver `subPaginasVisiveis`).
      return podeVerAgendaShows(ctx) || podeVerAnotacoesUI(ctx);

    case "vendas":
      if (ctx.papel === "artista") return true; // servidor libera o artista
      // Espelha VENDAS_CHAVES_MODULO (api/permissoes.ts) — as 7 chaves v2 do
      // módulo. Qualquer uma no artista abre a tab; a autoria filtra a lista.
      return alcancaAlguma(ctx, [
        "vendas.criar",
        "vendas.editar_proprios",
        "vendas.cancelar_proprios",
        "vendas.ver_outros",
        "vendas.editar_outros",
        "vendas.converter_outros",
        "vendas.cancelar_outros",
      ]);

    case "financeiro":
      // Espelha `podeVerFinanceiro` (FIN_CHAVES_MODULO) — as 8 chaves v2.
      return alcancaAlguma(ctx, [
        "financeiro.ver_proprios",
        "financeiro.editar_proprios",
        "financeiro.informar_proprios",
        "financeiro.fixar_proprios",
        "financeiro.ver_outros",
        "financeiro.editar_outros",
        "financeiro.informar_outros",
        "financeiro.fixar_outros",
      ]);

    case "contratos":
      // Artista: governado pela privacidade. `contratosVer` e `contratosCriar`
      // são flags INDEPENDENTES (PrivacidadeDj, resolvidas por `podeArtista`) e
      // o servidor autoriza a mutação só com `contratosCriar` — então "ver
      // desligado + gerar ligado" é config alcançável, e exigir só
      // `contratos.ver` esconderia um módulo que o servidor deixa usar.
      if (ctx.papel === "artista")
        return alcancaAlguma(ctx, ["contratos.ver", "contratos.criar"]);
      // Equipe: espelha `podeLerModelos` — QUALQUER chave "contratos." em algum
      // vínculo (workspace-level, união). Cobre as chaves v2 novas (criar,
      // cancelar_proprios/_outros, ver_outros, criar_modelo, excluir_modelo).
      return temPrefixoEmAlgumVinculo(ctx, "contratos.");

    case "contatos":
      if (ctx.papel === "artista") return false; // servidor devolve 403
      return temPrefixoEmAlgumVinculo(ctx, "contatos.");

    default:
      return false;
  }
}
