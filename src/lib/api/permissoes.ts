import { NextResponse } from "next/server";
import type { Show, AgendaItem, Venda, Orcamento } from "@/types";
import type { SessaoAutenticada } from "./session";
import {
  podeNaSessao,
  artistasVisiveisNaSessao,
  podeMutar,
} from "./permissao";
import { redigirVendaFinanceiro, redigirTaxaVenda } from "@/lib/mappers/venda";
import { redigirTaxaOrcamento } from "@/lib/mappers/orcamento";

/**
 * Camada de permissões server-side.
 *
 * Modelo ÚNICO (o LEGADO morreu — profiles.funcoes/escopo não existe mais):
 *   - admin / super-admin → tudo (o motor resolve direto).
 *   - artista            → só o próprio artista, governado pela privacidade.
 *   - equipe (operacional) → 100% VÍNCULOS por artista (membros_artista.permissoes).
 *     Sem vínculo que conceda a chave → negado.
 *
 * Convenção:
 *  - `aplicarFiltro*`: aceita um query builder do Supabase e adiciona
 *    `.eq(...)` / `.in(...)` para restringir resultados.
 *  - `verificarAcesso*` / `verificar*` / `exigir*`: retorna `NextResponse` 403
 *    quando não pode; `null` quando OK.
 *  - `pode*`: bool puro para validar acesso a um item específico
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
 * mas NENHUM artista alcançável. O filtro deve devolver zero resultados.
 * Usamos um UUID "impossível" — `eq` com ele garante 0 matches.
 */
const ZERO_RESULTS = "00000000-0000-0000-0000-000000000000";

// ============================================================
// Helpers compartilhados — tudo resolve pelo MOTOR (pode/artistasVisiveis
// via vínculos). Admin/artista/super são tratados dentro do motor.
// ============================================================

/** Alcança algum artista com QUALQUER uma das chaves (acesso ao módulo)? */
function alcancaAlgum(sessao: SessaoAutenticada, chaves: string[]): boolean {
  for (const c of chaves) {
    const v = artistasVisiveisNaSessao(sessao, c);
    if (v === "todos" || v.length > 0) return true;
  }
  return false;
}

/**
 * true se ALGUM vínculo do usuário concede exatamente `chave`. Admin/super →
 * sempre true; artista → sempre false (não tem vínculos operacionais). Base do
 * enforcement de CONTATOS por UNIÃO dos vínculos (D2).
 */
export function temChaveEmAlgumVinculo(
  sessao: SessaoAutenticada,
  chave: string
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  if (sessao.papel === "artista") return false;
  const vinculos = sessao.vinculos ?? {};
  for (const chaves of Object.values(vinculos)) {
    if (chaves.includes(chave)) return true;
  }
  return false;
}

/**
 * Escopo de CONTATOS da EQUIPE, derivado pela UNIÃO dos vínculos (D2):
 *   - `contatos.ver` em ALGUM vínculo        → "todos"    (vê todos os contatos);
 *   - senão `contatos.ver_proprios` em algum → "proprios" (só os que ele criou);
 *   - senão                                  → "nenhum"   (não vê contato algum).
 * Admin/super → "todos" (via temChaveEmAlgumVinculo). Artista NÃO passa por aqui
 * (é governado por privacidade.contatos, ver contatosAcesso.ts).
 */
export function escopoContatosEquipe(
  sessao: SessaoAutenticada
): "todos" | "proprios" | "nenhum" {
  if (temChaveEmAlgumVinculo(sessao, "contatos.ver")) return "todos";
  if (temChaveEmAlgumVinculo(sessao, "contatos.ver_proprios")) return "proprios";
  return "nenhum";
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

// ============================================================
// SHOWS / AGENDA (shows + agenda_items) — visíveis pelos vínculos de agenda.
// artist_id NULL (item geral) = admin-only.
// ============================================================

export function aplicarFiltroShows<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  return filtrarPorArtistasVisiveis(query, sessao, [
    "agenda.ver",
    "agenda.ver_detalhado",
  ]);
}

/** Pode VER a agenda deste artista (básico OU detalhado)? */
export function podeVerAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
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
  return podeNaSessao(sessao, artistId, "agenda.ver_detalhado");
}

/** Pode CRIAR na agenda deste artista? */
export function podeCriarAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return podeNaSessao(sessao, artistId, "agenda.criar");
}

/** Pode EDITAR este item da agenda (respeitando próprios × todos)? */
export function podeEditarAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
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
 * Admin/artista(dono) passam por `podeVerAgendaDetalhado` → sem redação.
 */
export function stripShowDetalhado(show: Show, sessao: SessaoAutenticada): Show {
  if (podeVerAgendaDetalhado(sessao, show.artistaId || null)) return show;
  // Nível básico (agenda.ver sem ver_detalhado): esconde cachê/vínculos E os
  // blocos detalhados novos — booking (PII de hospedagem) e a autoria/motivo do
  // cancelamento. Mantém dia/local/horário/status. Espelha stripAgendaItemDetalhado.
  return {
    ...show,
    valor: undefined,
    orcamentoId: undefined,
    vendaId: undefined,
    booking: undefined,
    cancelamento: undefined,
    cancelamentoHistorico: undefined,
  };
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
// ORÇAMENTOS — leitura própria (vendas.ver_orcamentos), separada de vendas.
// Artista lê os próprios (privacidade.orcamentosVer), resolvido no filtro.
// ============================================================

export function verificarAcessoOrcamentos(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "artista") return null; // artista lê os próprios (filtro)
  if (!alcancaAlgum(sessao, ["vendas.ver_orcamentos", "vendas.ver_proprios"])) {
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
  if (!podeNaSessao(sessao, artistId, "vendas.criar_orcamento")) {
    return NextResponse.json(
      { erro: "Você não tem permissão para criar orçamento neste artista." },
      { status: 403 }
    );
  }
  return null;
}

export function aplicarFiltroOrcamentos<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  // Leitura de ORÇAMENTOS = chave própria (vendas.ver_orcamentos), separada
  // da de vendas. "Próprios" reaproveita vendas.ver_proprios.
  return filtrarEscopoArtista(
    query,
    sessao,
    "vendas.ver_orcamentos",
    "vendas.ver_proprios"
  );
}

export function podeEditarOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  // Respeita próprios × todos (igual editar_venda): sem `editar_todos`, só
  // edita os PRÓPRIOS orçamentos (fecha editar por id o de um colega).
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "vendas.editar_orcamento",
    "vendas.editar_todos"
  );
}

export function podeExcluirOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "vendas.excluir_orcamento",
    "vendas.editar_todos"
  );
}

export function podeConverterOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  _criadoPor: string | null
): boolean {
  return podeNaSessao(sessao, artistId, "vendas.converter");
}

// ============================================================
// VENDAS — leitura por vendas.ver; mutação próprios × todos; cancelar por
// chave própria (vendas.cancelar_venda). Excluir por vendas.excluir_venda.
// ============================================================

export function verificarAcessoVendas(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "artista") return null; // artista lê as próprias (filtro)
  if (!alcancaAlgum(sessao, ["vendas.ver", "vendas.ver_proprios"])) {
    return NextResponse.json(
      { erro: "Você não tem acesso a vendas." },
      { status: 403 }
    );
  }
  return null;
}

export function verificarCriarVenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): NextResponse | null {
  if (!podeNaSessao(sessao, artistId, "vendas.criar_venda")) {
    return NextResponse.json(
      { erro: "Você não tem permissão para criar venda neste artista." },
      { status: 403 }
    );
  }
  return null;
}

export function aplicarFiltroVendas<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  return filtrarEscopoArtista(query, sessao, "vendas.ver", "vendas.ver_proprios");
}

export function podeEditarVenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "vendas.editar_venda",
    "vendas.editar_todos"
  );
}

export function podeExcluirVenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  // Próprios × todos (consistente com editar_venda): sem `editar_todos`, só
  // exclui as PRÓPRIAS vendas.
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "vendas.excluir_venda",
    "vendas.editar_todos"
  );
}

/**
 * Pode CANCELAR esta venda (D5)? Chave própria `vendas.cancelar_venda`,
 * com semântica próprios × todos igual às demais mutações: quem tem
 * `vendas.editar_todos` cancela qualquer venda; o dono (criado_por) cancela
 * a própria com `vendas.cancelar_venda`. Artista: dentro de vendasCriar
 * (resolvido no motor).
 */
export function podeCancelarVenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "vendas.cancelar_venda",
    "vendas.editar_todos"
  );
}

// ============================================================
// CONTATOS — enforcement por UNIÃO dos vínculos (D2). A LISTA/visibilidade é
// derivada em contatosAcesso.ts (usa escopoContatosEquipe). Aqui ficam o gate
// de MÓDULO e o gate de MUTAÇÃO.
// ============================================================

/**
 * Gate do MÓDULO contatos (usado hoje pelo caminho GET): admin passa, artista é
 * barrado, equipe passa (a LISTA é filtrada por escopoContatosEquipe → quem não
 * tem chave de contatos vê vazio). A MUTAÇÃO usa `verificarMutacaoContato`
 * (exige a chave respectiva em algum vínculo).
 */
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

/**
 * Gate de MUTAÇÃO de contato (D2): exige `contatos.<acao>` em ALGUM vínculo.
 *   - admin/super → passa;
 *   - artista     → 403 (nunca muta contatos — comportamento atual mantido);
 *   - equipe      → só se algum vínculo concede a chave da ação.
 */
export function verificarMutacaoContato(
  sessao: SessaoAutenticada,
  acao: "criar" | "editar" | "excluir"
): NextResponse | null {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return null;
  if (sessao.papel === "artista") {
    return NextResponse.json(
      { erro: "Artista não tem acesso a contatos." },
      { status: 403 }
    );
  }
  if (!temChaveEmAlgumVinculo(sessao, `contatos.${acao}`)) {
    return NextResponse.json(
      { erro: "Você não tem permissão para esta ação em contatos." },
      { status: 403 }
    );
  }
  return null;
}

// ============================================================
// CONTRATOS — a tabela `contratos` não tem artist_id: o artista é resolvido pela
// VENDA vinculada (contratos.venda_id → vendas.artist_id). O escopo "próprios"
// usa `contratos.criado_por` (o criador REAL do contrato). Contrato AVULSO
// (venda_id NULL) = sem artista → admin-only.
// ============================================================

/**
 * true = usuário enxerga TODOS os contratos sem precisar resolver artista
 * (admin/super). Permite pular a resolução venda→artista no caminho comum.
 */
export function verTodosContratos(sessao: SessaoAutenticada): boolean {
  return sessao.isSuperAdmin || sessao.papel === "admin";
}

/** Pode VER um contrato deste artista? (artistId vem da venda; null = avulso). */
export function podeVerContrato(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return podeNaSessao(sessao, artistId, "contratos.ver");
}

/** Pode CRIAR contrato no artista? (artistId resolvido do venda_id do body). */
export function verificarCriarContrato(
  sessao: SessaoAutenticada,
  artistId: string | null
): NextResponse | null {
  if (!podeNaSessao(sessao, artistId, "contratos.criar")) {
    return NextResponse.json(
      { erro: "Você não tem permissão para criar contrato neste artista." },
      { status: 403 }
    );
  }
  return null;
}

/** Pode EDITAR o contrato (próprios × todos, dono = contratos.criado_por)? */
export function podeEditarContrato(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "contratos.editar",
    "contratos.editar_todos"
  );
}

/**
 * Pode CANCELAR o contrato (D4)? Chave própria `contratos.cancelar`, com a
 * MESMA semântica de próprios × todos do editar: quem tem `contratos.editar_todos`
 * cancela qualquer um; o dono (criado_por) cancela o próprio com
 * `contratos.cancelar`. (Decisão: reusa `contratos.editar_todos` como chave-todos
 * — não existe `contratos.cancelar_todos`; mantém coerência com o editar.)
 */
export function podeCancelarContrato(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podeMutar(
    sessao,
    artistId,
    criadoPor,
    "contratos.cancelar",
    "contratos.editar_todos"
  );
}

/**
 * Pode EXCLUIR o contrato? ADMIN-ONLY (D4): excluir some do catálogo delegável
 * e do pacote do artista — não passa por chave. `_artistId` é ignorado (mantido
 * só por compatibilidade com o call-site atual até a fase de rotas).
 */
export function podeExcluirContrato(
  sessao: SessaoAutenticada,
  _artistId?: string | null
): boolean {
  return sessao.isSuperAdmin || sessao.papel === "admin";
}

/**
 * Pode LER os MODELOS de contrato (D3)? LER fecha para quem tem acesso a
 * contratos:
 *   - admin/super → sim;
 *   - artista     → privacidade.contratosVer (pode("contratos.ver") do próprio);
 *   - equipe      → alguma chave `contratos.*` em ALGUM vínculo.
 */
export function podeLerModelos(sessao: SessaoAutenticada): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  if (sessao.papel === "artista") {
    return podeNaSessao(sessao, sessao.artistaId, "contratos.ver");
  }
  const vinculos = sessao.vinculos ?? {};
  for (const chaves of Object.values(vinculos)) {
    if (chaves.some((c) => c.startsWith("contratos."))) return true;
  }
  return false;
}

/**
 * Gate para GERENCIAR modelos de contrato — POST/PATCH/DELETE (D3): ADMIN-ONLY
 * explícito. Super-admin passa (opera qualquer tenant).
 */
export function exigirAdminModelos(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return null;
  return NextResponse.json(
    { erro: "Apenas o admin da agência pode gerenciar modelos de contrato." },
    { status: 403 }
  );
}

// ============================================================
// AGÊNCIA / ADMIN — mutações administrativas do workspace (cadastro de
// artistas, gestão de equipe, identidade/config da agência). Escopo é
// WORKSPACE-LEVEL, não por artista: o gate é "é o admin deste workspace"
// (papel === "admin") + o isolamento multi-tenant que cada rota já faz.
// Super-admin da plataforma passa (opera qualquer tenant).
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
// PARCELAS / FINANCEIRO — gate por artista, mapeando a ação → chave do catálogo.
// `artistId`/`criadoPor` vêm da VENDA da parcela (a parcela não tem coluna
// artist_id nem criado_por — a ligação é sempre parcela→venda→artista).
// ============================================================

/**
 * Gate financeiro por artista para PATCH de parcela (informar/desfazer
 * pagamento e ajustes). Mapeia a ação → chave e exige a permissão no artista.
 */
export function podeInformarPagamentoParcela(
  sessao: SessaoAutenticada,
  artistId: string | null,
  acao: "registrar" | "cancelar" | "editar"
): NextResponse | null {
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

/**
 * Pode VER dados financeiros sensíveis deste artista (comprovante bancário)?
 * Qualquer chave financeira de leitura (financeiro.ver, fundida = cachês +
 * pagamentos) OU de mutação de pagamento no artista. Gate do comprovante além
 * do "enxerga a venda". Admin/super passam.
 */
export function podeVerFinanceiro(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  return (
    podeNaSessao(sessao, artistId, "financeiro.ver") ||
    podeNaSessao(sessao, artistId, "financeiro.registrar_pagamento") ||
    podeNaSessao(sessao, artistId, "financeiro.editar_pagamento")
  );
}

/**
 * Pode ver a TAXA de agência / o líquido do artista (D6)? Gate NOVO, separado do
 * `podeVerFinanceiro`:
 *   - admin/super → sim;
 *   - ARTISTA     → `financeiro.ver_taxa` (mapeado no motor para
 *                   privacidade.financeiroVerTaxa; retrocompat = financeiroVer);
 *   - EQUIPE      → acompanha o acesso ao financeiro (comportamento atual — sem
 *                   regressão; a taxa aparece pra quem já via o financeiro).
 * Usado para redigir SÓ a taxa quando o resto do financeiro é visível.
 */
export function podeVerTaxaAgencia(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  if (sessao.papel === "artista") {
    return podeNaSessao(sessao, artistId, "financeiro.ver_taxa");
  }
  return podeVerFinanceiro(sessao, artistId);
}

/**
 * Redige uma VENDA conforme o que a sessão pode ver do financeiro do artista:
 *   - sem `financeiro.ver`            → redigirVendaFinanceiro (tira meta + taxa);
 *   - vê financeiro mas sem taxa (D6) → tira SÓ a taxa/líquido;
 *   - vê tudo                         → a venda intacta.
 */
export function redigirVendaParaSessao(
  sessao: SessaoAutenticada,
  v: Venda
): Venda {
  const artistId = v.artistaId || null;
  if (!podeVerFinanceiro(sessao, artistId)) return redigirVendaFinanceiro(v);
  if (!podeVerTaxaAgencia(sessao, artistId)) return redigirTaxaVenda(v);
  return v;
}

/**
 * Redige um ORÇAMENTO conforme o gate da taxa (D6). Orçamento não tem rastro de
 * pagamento (parcelas/meta), então só a taxa/líquido é sensível: some quando a
 * sessão não pode ver a taxa daquele artista.
 */
export function redigirOrcamentoParaSessao(
  sessao: SessaoAutenticada,
  o: Orcamento
): Orcamento {
  if (!podeVerTaxaAgencia(sessao, o.artistaId || null)) {
    return redigirTaxaOrcamento(o);
  }
  return o;
}

// ============================================================
// ANOTAÇÕES (workspace-level, não por-artista).
//  - Criar PASTA: permissão dedicada `podeCriarAnotacoes` (admin/super sempre).
//  - Gerir a PASTA (renomear/visibilidade/excluir): o dono (criado_por) ou admin.
//  - Editar/excluir uma NOTA: só o AUTOR (admin/super qualquer). Adicionar nota
//    numa pasta que enxerga é liberado (a RLS de leitura da pasta é o gate).
// ============================================================

export function podeCriarPastaAnotacao(sessao: SessaoAutenticada): boolean {
  return sessao.isSuperAdmin || sessao.papel === "admin" || sessao.podeCriarAnotacoes;
}

export function podeGerirPasta(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  return !!criadoPor && criadoPor === sessao.userId;
}

export function podeMexerNaNota(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  return !!criadoPor && criadoPor === sessao.userId;
}
