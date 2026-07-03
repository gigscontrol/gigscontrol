import { NextResponse } from "next/server";
import type { Show, AgendaItem } from "@/types";
import type { SessaoAutenticada } from "./session";
import {
  podeNaSessao,
  artistasVisiveisNaSessao,
  podeMutar,
} from "./permissao";

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
  or: (filtro: string) => QueryBuilder;
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
// MODELO NOVO (vínculos por artista) — helpers compartilhados.
// Quando o usuário tem vínculos carregados (ou é admin/artista/super),
// resolvemos pelo MOTOR. Operacional SEM nenhum vínculo cai no LEGADO
// EXATO (funcoes/escopo), pra não mudar nada durante a transição.
// ============================================================

/** Operacional sem nenhum vínculo → usa o caminho legado exato. */
function usarLegado(sessao: SessaoAutenticada): boolean {
  return (
    sessao.vinculos === undefined &&
    !sessao.isSuperAdmin &&
    sessao.papel !== "admin" &&
    sessao.papel !== "artista"
  );
}

/** Alcança algum artista com QUALQUER uma das chaves (acesso ao módulo)? */
function alcancaAlgum(sessao: SessaoAutenticada, chaves: string[]): boolean {
  for (const c of chaves) {
    const v = artistasVisiveisNaSessao(sessao, c);
    if (v === "todos" || v.length > 0) return true;
  }
  return false;
}

/**
 * Filtra uma query por escopo de artista (modelo novo): mostra TUDO dos
 * artistas com `chaveVer`, e só os PRÓPRIOS (criado_por) dos artistas com
 * `chaveVerProprios`. Requer colunas `artist_id` e `criado_por` na tabela.
 */
function filtrarEscopoArtista<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada,
  chaveVer: string,
  chaveVerProprios: string
): Q {
  const todos = artistasVisiveisNaSessao(sessao, chaveVer);
  if (todos === "todos") return query; // admin/super → tudo
  const propRaw = artistasVisiveisNaSessao(sessao, chaveVerProprios);
  const proprios = propRaw === "todos" ? [] : propRaw;
  if (todos.length > 0 && proprios.length > 0) {
    return query.or(
      `artist_id.in.(${todos.join(",")}),and(artist_id.in.(${proprios.join(
        ","
      )}),criado_por.eq.${sessao.userId})`
    ) as Q;
  }
  if (todos.length > 0) return query.in("artist_id", todos) as Q;
  if (proprios.length > 0) {
    return query.in("artist_id", proprios).eq("criado_por", sessao.userId) as Q;
  }
  return query.eq("artist_id", ZERO_RESULTS) as Q; // sem acesso → zero
}

/**
 * Filtra por artistas visíveis pela UNIÃO de várias chaves de visualização
 * (ex.: agenda.ver + agenda.ver_detalhado). Sem escopo "próprios" — é só por
 * artista. Retorna zero quando o usuário não alcança nenhum.
 */
function filtrarPorArtistasVisiveis<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada,
  chaves: string[]
): Q {
  const set = new Set<string>();
  for (const c of chaves) {
    const v = artistasVisiveisNaSessao(sessao, c);
    if (v === "todos") return query; // admin/super → tudo
    for (const a of v) set.add(a);
  }
  if (set.size === 0) return query.eq("artist_id", ZERO_RESULTS) as Q;
  // Item geral (artist_id NULL) = admin-only. Admin/super já saíram com "todos"
  // acima; operacional vê só os artistas que alcança. Sem o `artist_id.is.null`
  // a lista bate com o gate do GET [id] e com a redação — fecha o vazamento do
  // item sem artista pra quem tem vínculo.
  return query.in("artist_id", Array.from(set)) as Q;
}

/** Regra legada de mutar venda/orçamento (vendedor restrito só o que criou). */
function vendaLegadoPodeMutar(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.papel === "admin") return true;
  if (!temFuncao(sessao, "vendedor")) return false;
  if (sessao.escopo.verTodasVendas) return true;
  return criadoPor === sessao.userId;
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
  if (!usarLegado(sessao)) {
    return filtrarPorArtistasVisiveis(query, sessao, [
      "agenda.ver",
      "agenda.ver_detalhado",
    ]);
  }
  // ---- legado (agenda aberta; só produtor filtra) ----
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
// AGENDA (shows + agenda_items) — no LEGADO a agenda é aberta pra toda a
// equipe, então o gate só existe no modelo novo (com vínculo). Sem vínculo
// → libera (comportamento de hoje). artist_id NULL (item geral) = admin-only.
// ============================================================

/** Pode VER a agenda deste artista (básico OU detalhado)? */
export function podeVerAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (usarLegado(sessao)) return true;
  return (
    podeNaSessao(sessao, artistId, "agenda.ver") ||
    podeNaSessao(sessao, artistId, "agenda.ver_detalhado")
  );
}

/** Pode ver os detalhes COMPLETOS (não só dia/local/horário)? */
export function podeVerAgendaDetalhado(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (usarLegado(sessao)) return true;
  return podeNaSessao(sessao, artistId, "agenda.ver_detalhado");
}

/** Pode CRIAR na agenda deste artista? */
export function podeCriarAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (usarLegado(sessao)) return true;
  return podeNaSessao(sessao, artistId, "agenda.criar");
}

/** Pode EDITAR este item da agenda (respeitando próprios × todos)? */
export function podeEditarAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (usarLegado(sessao)) return true;
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "agenda.editar",
    "agenda.editar_todos"
  );
}

/** Pode EXCLUIR este item da agenda (respeitando próprios × todos)? */
export function podeExcluirAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (usarLegado(sessao)) return true;
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "agenda.excluir",
    "agenda.excluir_todos"
  );
}

/**
 * Redige um Show para quem tem apenas `agenda.ver` (básico), sem
 * `agenda.ver_detalhado`: remove o cachê (valor) e os vínculos que revelam
 * valor por join no cliente (vendaId/orcamentoId). Mantém dia/local/horário.
 * Admin/artista(dono)/legado passam por `podeVerAgendaDetalhado` → sem redação.
 */
export function stripShowDetalhado(show: Show, sessao: SessaoAutenticada): Show {
  if (podeVerAgendaDetalhado(sessao, show.djId || null)) return show;
  return { ...show, valor: undefined, orcamentoId: undefined, vendaId: undefined };
}

/**
 * Redige um AgendaItem para quem só tem `agenda.ver`: zera o blob `dados`
 * (voo: passageiros/DOB/localizador/voucher; transporte: motorista/contato) e
 * `observacoes`, preservando tipo/título/data/horários. `artistId` é a coluna
 * canônica (row.artist_id) usada pelos filtros.
 */
export function stripAgendaItemDetalhado(
  item: AgendaItem,
  sessao: SessaoAutenticada,
  artistId: string | null
): AgendaItem {
  if (podeVerAgendaDetalhado(sessao, artistId)) return item;
  return { ...item, dados: undefined, observacoes: undefined };
}

// ============================================================
// ORÇAMENTOS — papel admin libera tudo; vendedor com `verTodasVendas:
// false` só vê o que criou; artista só os próprios (artist_id).
// Acesso ao MÓDULO Orçamentos exige a função "vendedor".
// ============================================================

export function verificarAcessoOrcamentos(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (!usarLegado(sessao)) {
    if (sessao.papel === "artista") return null;
    if (!alcancaAlgum(sessao, ["vendas.ver", "vendas.ver_proprios"])) {
      return NextResponse.json(
        { erro: "Você não tem acesso a orçamentos." },
        { status: 403 }
      );
    }
    return null;
  }
  // ---- legado ----
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

/** Pode CRIAR orçamento no artista? (precisa do artist_id do body). */
export function verificarCriarOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null
): NextResponse | null {
  if (!usarLegado(sessao)) {
    if (!podeNaSessao(sessao, artistId, "vendas.criar_orcamento")) {
      return NextResponse.json(
        { erro: "Você não tem permissão para criar orçamento neste artista." },
        { status: 403 }
      );
    }
    return null;
  }
  return verificarAcessoOrcamentos(sessao); // legado: acesso ao módulo = pode criar
}

export function aplicarFiltroOrcamentos<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  if (!usarLegado(sessao)) {
    return filtrarEscopoArtista(query, sessao, "vendas.ver", "vendas.ver_proprios");
  }
  // ---- legado ----
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

export function podeEditarOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (!usarLegado(sessao)) {
    return podeNaSessao(sessao, artistId, "vendas.editar_orcamento");
  }
  return vendaLegadoPodeMutar(sessao, criadoPor);
}

export function podeExcluirOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (!usarLegado(sessao)) {
    return podeNaSessao(sessao, artistId, "vendas.excluir_orcamento");
  }
  return vendaLegadoPodeMutar(sessao, criadoPor);
}

export function podeConverterOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (!usarLegado(sessao)) {
    return podeNaSessao(sessao, artistId, "vendas.converter");
  }
  return vendaLegadoPodeMutar(sessao, criadoPor);
}

// ============================================================
// VENDAS — mesma estrutura de orçamentos.
// Financeiro tem acesso de LEITURA via verificarAcessoVendas (false)
// mas NÃO pode criar (verificarCriarVenda exige função vendedor).
// ============================================================

export function verificarAcessoVendas(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (!usarLegado(sessao)) {
    if (sessao.papel === "artista") return null;
    if (!alcancaAlgum(sessao, ["vendas.ver", "vendas.ver_proprios"])) {
      return NextResponse.json(
        { erro: "Você não tem acesso a vendas." },
        { status: 403 }
      );
    }
    return null;
  }
  // ---- legado ----
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
  sessao: SessaoAutenticada,
  artistId: string | null
): NextResponse | null {
  if (!usarLegado(sessao)) {
    if (!podeNaSessao(sessao, artistId, "vendas.criar_venda")) {
      return NextResponse.json(
        { erro: "Você não tem permissão para criar venda neste artista." },
        { status: 403 }
      );
    }
    return null;
  }
  // ---- legado ----
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
  if (!usarLegado(sessao)) {
    return filtrarEscopoArtista(query, sessao, "vendas.ver", "vendas.ver_proprios");
  }
  // ---- legado ----
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
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (!usarLegado(sessao)) {
    return podeMutar(
      sessao,
      artistId,
      criadoPor,
      "vendas.editar_venda",
      "vendas.editar_todos"
    );
  }
  return vendaLegadoPodeMutar(sessao, criadoPor);
}

export function podeExcluirVenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (!usarLegado(sessao)) {
    return podeNaSessao(sessao, artistId, "vendas.excluir_venda");
  }
  return vendaLegadoPodeMutar(sessao, criadoPor);
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

/**
 * Espelha `aplicarFiltroContratantes` para UM contratante (rotas [id]).
 * As listas já respeitam `verTodosContatos`, mas as rotas [id] não re-aplicavam
 * o escopo — permitindo a um vendedor restrito ler/editar/apagar contratante de
 * um colega pelo id (IDOR de escopo). Mantido idêntico ao filtro de lista: se
 * um dia contatos migrar pro modelo novo (contatos.ver_proprios), os dois mudam
 * juntos. Chame SEMPRE após `verificarAcessoContatos` (que já barra artista).
 */
export function podeVerContratante(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (temFuncao(sessao, "vendedor") && !sessao.escopo.verTodosContatos) {
    return criadoPor === sessao.userId;
  }
  return true;
}

// ============================================================
// CONTRATOS — a tabela `contratos` NÃO tem artist_id nem criado_por. O artista
// é resolvido pela VENDA vinculada (contratos.venda_id → vendas.artist_id) e o
// escopo "próprios" herda vendas.criado_por. Contrato AVULSO (venda_id NULL) =
// sem artista → admin-only (padrão "artist_id NULL = admin-only").
//
// LEGADO (operacional sem vínculo): preserva o comportamento atual EXATO —
// leitura aberta (vê tudo) e mutação admin-only. Assim ninguém é trancado na
// transição; o gate por artista só passa a valer quando o admin dá vínculos.
// ============================================================

/**
 * true = usuário enxerga TODOS os contratos sem precisar resolver artista
 * (admin/super, ou operacional legado com leitura aberta). Permite pular a
 * resolução venda→artista no caminho comum.
 */
export function verTodosContratos(sessao: SessaoAutenticada): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  if (usarLegado(sessao)) return true;
  return false;
}

/** Pode VER um contrato deste artista? (artistId vem da venda; null = avulso). */
export function podeVerContrato(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (usarLegado(sessao)) return true;
  return podeNaSessao(sessao, artistId, "contratos.ver");
}

/** Pode CRIAR contrato no artista? (artistId resolvido do venda_id do body). */
export function verificarCriarContrato(
  sessao: SessaoAutenticada,
  artistId: string | null
): NextResponse | null {
  if (!usarLegado(sessao)) {
    if (!podeNaSessao(sessao, artistId, "contratos.criar")) {
      return NextResponse.json(
        { erro: "Você não tem permissão para criar contrato neste artista." },
        { status: 403 }
      );
    }
    return null;
  }
  // ---- legado: admin-only (comportamento atual) ----
  if (sessao.papel === "admin") return null;
  return NextResponse.json(
    { erro: "Apenas administradores podem criar contratos." },
    { status: 403 }
  );
}

/** Pode EDITAR o contrato (próprios × todos, herdando venda.criado_por)? */
export function podeEditarContrato(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (!usarLegado(sessao)) {
    return podeMutar(
      sessao,
      artistId,
      criadoPor,
      "contratos.editar",
      "contratos.editar_todos"
    );
  }
  return sessao.papel === "admin";
}

/** Pode EXCLUIR o contrato? */
export function podeExcluirContrato(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (!usarLegado(sessao)) {
    return podeNaSessao(sessao, artistId, "contratos.excluir");
  }
  return sessao.papel === "admin";
}

// ============================================================
// AGÊNCIA / ADMIN — mutações administrativas do workspace (cadastro de
// artistas, gestão de equipe, identidade/config da agência). Escopo é
// WORKSPACE-LEVEL, não por artista: o gate correto é "é o admin deste
// workspace" (papel === "admin") + o isolamento multi-tenant que cada
// rota já faz (pertenceAoWorkspace / workspace_id). Super-admin da
// plataforma passa (opera qualquer tenant).
// ============================================================

export function verificarAdminDoWorkspace(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.isSuperAdmin) return null;
  if (sessao.papel === "admin") return null;
  return NextResponse.json(
    { erro: "Apenas o admin da agência pode executar esta ação." },
    { status: 403 }
  );
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
 * Gate financeiro por artista para PATCH de parcela (informar/desfazer
 * pagamento e ajustes). MODELO NOVO: mapeia a ação → chave do catálogo e
 * exige a permissão naquele artista. LEGADO (sem vínculo): mantém a regra
 * atual (admin OU função financeiro) MAS soma djAtendidoPor para fechar o
 * furo de escopo por DJ (financeiro do artista A não mexe em venda do B).
 *
 * `artistId`/`criadoPor` vêm da VENDA da parcela (a parcela não tem coluna
 * artist_id nem criado_por — a ligação é sempre parcela→venda→artista).
 */
export function podeInformarPagamentoParcela(
  sessao: SessaoAutenticada,
  artistId: string | null,
  acao: "registrar" | "cancelar" | "editar"
): NextResponse | null {
  if (!usarLegado(sessao)) {
    const chave =
      acao === "registrar"
        ? "financeiro.registrar_pagamento"
        : acao === "cancelar"
          ? "financeiro.cancelar_pagamento"
          : "financeiro.editar_pagamento";
    if (!podeNaSessao(sessao, artistId, chave)) {
      return NextResponse.json(
        { erro: "Você não tem permissão para alterar pagamentos deste artista." },
        { status: 403 }
      );
    }
    return null;
  }
  // ---- legado: admin OU financeiro, restrito aos DJs da função ----
  if (sessao.papel === "admin") return null;
  if (temFuncao(sessao, "financeiro") && djAtendidoPor(sessao, "financeiro", artistId)) {
    return null;
  }
  return NextResponse.json(
    { erro: "Você não tem permissão para alterar pagamentos deste artista." },
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
