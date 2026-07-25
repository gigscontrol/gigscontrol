import { NextResponse } from "next/server";
import type { Show, AgendaItem, Venda, Orcamento } from "@/types";
import type { SessaoAutenticada } from "./session";
import {
  podeNaSessao,
  artistasVisiveisNaSessao,
  podeMutar,
} from "./permissao";
import { redigirVendaFinanceiro } from "@/lib/mappers/venda";
import {
  CHAVES_SETORES_AGENDA,
  chaveDoSetor,
} from "@/lib/permissoes/setoresAgenda";

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
  if (sessao.isSuperAdmin || sessao.papel === "admin") return "todos";
  // v2: `contatos.ver_outros` = vê TODOS; qualquer chave de escopo PRÓPRIO
  // (ver/editar/excluir_proprios ou criar) = vê só os que ele criou.
  if (temChaveEmAlgumVinculo(sessao, "contatos.ver_outros")) return "todos";
  const proprios = [
    "contatos.ver_proprios",
    "contatos.criar",
    "contatos.editar_proprios",
    "contatos.excluir_proprios",
  ];
  if (proprios.some((c) => temChaveEmAlgumVinculo(sessao, c))) return "proprios";
  return "nenhum";
}

/**
 * Pode VER ESTE contato (workspace-level; autoria = `criado_por`)?
 *   - escopo "todos"    → sempre;
 *   - escopo "proprios" → só se `criadoPor === userId`;
 *   - escopo "nenhum"   → nunca. `criado_por` nulo conta como "de outros".
 */
export function podeVerContato(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  const escopo = escopoContatosEquipe(sessao);
  if (escopo === "todos") return true;
  if (escopo === "nenhum") return false;
  return !!criadoPor && criadoPor === sessao.userId;
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

// ============================================================
// AUTORIA v2 — "criado por ele" × "criado por outros".
//
// O modelo v2 não tem uma chave "ver os próprios" separada: ver/mexer no que é
// DELE vem embutido nas chaves de ação próprias (criar/editar_proprios/…). Os
// helpers abaixo resolvem o eixo de autoria em cima do MOTOR (podeNaSessao),
// por artista, e por UNIÃO dos vínculos (workspace-level, p/ contatos/modelos).
// ============================================================

/**
 * Gate ESTRITO por autoria (por artista): registro do PRÓPRIO usuário
 * (criadoPor === userId) exige `chaveProprios`; de outro (ou criadoPor NULO)
 * exige `chaveOutros`. Admin/super são resolvidos dentro de `podeNaSessao`.
 *
 * Regra: `criado_por` NULO conta como "de outros" (usa `chaveOutros`) — linha
 * sem dono nunca passa pela chave própria.
 */
export function podePorAutoria(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null | undefined,
  chaveProprios: string,
  chaveOutros: string
): boolean {
  const ehProprio = !!criadoPor && criadoPor === sessao.userId;
  return podeNaSessao(sessao, artistId, ehProprio ? chaveProprios : chaveOutros);
}

/**
 * Autoria por UNIÃO DOS VÍNCULOS (workspace-level: contatos e modelos de
 * contrato, que não têm artist_id). Próprio → `chaveProprios` em ALGUM vínculo;
 * de outros (ou criado_por nulo) → `chaveOutros`. Admin/super passam.
 */
export function podePorAutoriaWorkspace(
  sessao: SessaoAutenticada,
  criadoPor: string | null | undefined,
  chaveProprios: string,
  chaveOutros: string
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  const ehProprio = !!criadoPor && criadoPor === sessao.userId;
  return temChaveEmAlgumVinculo(sessao, ehProprio ? chaveProprios : chaveOutros);
}

/** Alcança algum artista com QUALQUER uma das chaves da lista? (por vínculo). */
function alcancaAlgumaChave(
  sessao: SessaoAutenticada,
  chaves: readonly string[]
): boolean {
  return alcancaAlgum(sessao, [...chaves]);
}

/**
 * Filtra uma query por artista + AUTORIA v2 (para vendas/orçamentos/financeiro):
 *   - artistas com `chaveTodos` (ver_outros)          → TUDO;
 *   - artistas com QUALQUER `chavesProprios` (mas sem  → só as linhas do próprio
 *     ver_outros)                                        (criado_por === userId).
 * Requer colunas `artist_id` e `criado_por` na tabela.
 */
function filtrarEscopoAutoria<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada,
  chaveTodos: string,
  chavesProprios: readonly string[]
): Q {
  const todosRaw = artistasVisiveisNaSessao(sessao, chaveTodos);
  if (todosRaw === "todos") return query; // admin/super → tudo
  const todos = todosRaw;
  const todosSet = new Set(todos);
  const propriosSet = new Set<string>();
  for (const chave of chavesProprios) {
    const v = artistasVisiveisNaSessao(sessao, chave);
    if (v === "todos") return query; // admin/super (defensivo)
    for (const a of v) if (!todosSet.has(a)) propriosSet.add(a);
  }
  const proprios = [...propriosSet];
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

/** Chaves "próprias" (autoria dele) de VENDAS/ORÇAMENTOS na v2. */
const VENDAS_CHAVES_PROPRIOS = [
  "vendas.criar",
  "vendas.editar_proprios",
  "vendas.cancelar_proprios",
] as const;

/** Todas as chaves v2 do módulo VENDAS (gate de MÓDULO por união). */
const VENDAS_CHAVES_MODULO = [
  "vendas.criar",
  "vendas.editar_proprios",
  "vendas.cancelar_proprios",
  "vendas.ver_outros",
  "vendas.editar_outros",
  "vendas.converter_outros",
  "vendas.cancelar_outros",
] as const;

/** Chaves "próprias" (autoria dele) do FINANCEIRO na v2. */
const FIN_CHAVES_PROPRIOS = [
  "financeiro.ver_proprios",
  "financeiro.editar_proprios",
  "financeiro.informar_proprios",
  "financeiro.fixar_proprios",
] as const;

/** Todas as chaves v2 do módulo FINANCEIRO. */
const FIN_CHAVES_MODULO = [
  ...FIN_CHAVES_PROPRIOS,
  "financeiro.ver_outros",
  "financeiro.editar_outros",
  "financeiro.informar_outros",
  "financeiro.fixar_outros",
] as const;

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
  // QUALQUER setor da ficha basta pra o show APARECER no calendário — o que
  // cada um vê dentro dele é a redação por setor que decide. Antes eram as
  // duas chaves do modelo de 2 níveis; listar só elas aqui apagaria a agenda
  // inteira de quem foi migrado pros setores.
  return filtrarPorArtistasVisiveis(query, sessao, [...CHAVES_SETORES_AGENDA]);
}

/** Pode VER a agenda deste artista (qualquer setor da ficha)? */
export function podeVerAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return podeVerAlgumSetorAgenda(sessao, artistId);
}

/**
 * Pode ver o setor HOTEL (hospedagem/booking/voucher)?
 *
 * Era `agenda.ver_detalhado` — a chave "vê tudo" do modelo de 2 níveis. Com a
 * visibilidade por SETOR, o que estes chamadores realmente protegem é o dado
 * de hospedagem (nome do hóspede, check-in/out, voucher), então a chave certa
 * é a do setor Hotel. Nome mantido nos call-sites pra não espalhar renomeação.
 */
export function podeVerAgendaDetalhado(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return podeNaSessao(sessao, artistId, chaveDoSetor("hotel"));
}

/** Pode ver ALGUM setor da ficha do show deste artista? */
export function podeVerAlgumSetorAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return CHAVES_SETORES_AGENDA.some((c) => podeNaSessao(sessao, artistId, c));
}

/**
 * Pode ver o dado detalhado de VOO/TRANSPORTE (voucher de voo, blob `dados` do
 * agenda_item: passageiros, DOB, localizador, motorista)? É o setor LOGÍSTICA —
 * NÃO o hotel. Antes tudo isso caía em `podeVerAgendaDetalhado` (=hotel), que
 * over-restringia quem só tinha logística e over-expunha a quem só tinha hotel.
 */
export function podeVerAgendaLogistica(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return podeNaSessao(sessao, artistId, chaveDoSetor("logistica"));
}

/**
 * Pode CRIAR na agenda deste artista? (L5) — vale só para AGENDA_ITEMS:
 * voo, transporte terrestre e evento personalizado. Criar SHOW NÃO passa mais
 * por aqui: usa `podeCriarShow` (vendas.criar_venda).
 */
export function podeCriarAgenda(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return podeNaSessao(sessao, artistId, "agenda.criar");
}

/**
 * Pode EDITAR este item da agenda (respeitando próprios × todos)? (L5) — vale
 * só para AGENDA_ITEMS. Editar SHOW usa `podeEditarShow` (chave de vendas).
 */
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

/**
 * Pode EXCLUIR este item da agenda (respeitando próprios × todos)? (L5) — vale
 * só para AGENDA_ITEMS. Excluir SHOW usa `podeExcluirShow` (chave de vendas).
 */
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

// ============================================================
// SHOW — MUTAÇÃO POR CHAVE DE VENDAS (L5b/L5c).
//
// A AGENDA passou a ser SÓ VISUALIZAÇÃO de show: `agenda.ver`/`ver_detalhado`
// continuam sendo o eixo de LEITURA (Básico × Acesso total), mas nenhuma chave
// de agenda cria, edita, cancela ou exclui show. Um show é a materialização de
// uma VENDA na agenda — logo mexer nele é permissão de VENDAS.
//
// Estas quatro funções são gêmeas das de venda (`podeEditarVenda`,
// `podeCancelarVenda`, `podeExcluirVenda`, `verificarCriarVenda`), inclusive na
// semântica próprios × todos. A diferença é a linha de referência: aqui
// `criadoPor` é o `shows.criado_por` (quem lançou o show), não o da venda —
// numa venda concretizada os dois são a mesma pessoa, e num show avulso
// (criado direto na agenda) o dono é quem o criou. Sem `vendas.editar_todos`,
// só mexe nos SEUS.
//
// ⚠️ REVOGAÇÃO DELIBERADA: quem tinha `agenda.editar_todos` (ou `agenda.criar`)
// e nenhuma chave de vendas deixa de cancelar/editar/criar show. É o que o dono
// pediu; ver o bloco de aviso em src/lib/permissoes/catalogo.ts (AGENDA).
// ============================================================

/** Pode CRIAR show neste artista? (`vendas.criar`) */
export function podeCriarShow(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  return podeNaSessao(sessao, artistId, "vendas.criar");
}

/** Pode EDITAR este show? (autoria: `editar_proprios` × `editar_outros`) */
export function podeEditarShow(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "vendas.editar_proprios",
    "vendas.editar_outros"
  );
}

/**
 * Pode CANCELAR (ou reativar) este show? Autoria: `cancelar_proprios` ×
 * `cancelar_outros`. Reverter o cancelamento é a mesma decisão — mesma chave.
 */
export function podeCancelarShow(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "vendas.cancelar_proprios",
    "vendas.cancelar_outros"
  );
}

/** Pode EXCLUIR este show? ADMIN-ONLY (excluir venda/show = só admin). */
export function podeExcluirShow(
  sessao: SessaoAutenticada,
  _artistId?: string | null,
  _criadoPor?: string | null
): boolean {
  return sessao.isSuperAdmin || sessao.papel === "admin";
}

/**
 * Redige um Show para quem tem apenas `agenda.ver` (básico), sem
 * `agenda.ver_detalhado`: remove o cachê (valor) e os vínculos que revelam
 * valor por join no cliente (vendaId/orcamentoId). Mantém dia/local/horário.
 * Admin/artista(dono) passam por `podeVerAgendaDetalhado` → sem redação.
 */
export function stripShowDetalhado(show: Show, sessao: SessaoAutenticada): Show {
  // REDAÇÃO POR SETOR. Antes era tudo-ou-nada: `agenda.ver_detalhado` liberava
  // o show inteiro e a falta dele apagava tudo. Com a visibilidade por setor,
  // cada campo do SHOW responde ao setor que o exibe — senão "Personalizado com
  // tudo menos Hotel" apagaria cachê, contratante e documentos junto.
  const art = show.artistaId || null;
  const ve = (setor: Parameters<typeof chaveDoSetor>[0]) =>
    podeNaSessao(sessao, art, chaveDoSetor(setor));

  return {
    ...show,
    // LOCAL — nome do local, cidade e a casa/cidade por id. `data`/`dayId`/
    // `status` NÃO entram aqui: são o que posiciona o show na grade; apagá-los
    // sumiria o show do calendário. Só os RÓTULOS de onde são gateados.
    venue: ve("local") ? show.venue : "",
    location: ve("local") ? show.location : "",
    casaId: ve("local") ? show.casaId : undefined,
    cidadeId: ve("local") ? show.cidadeId : undefined,
    // DETALHES — o horário de apresentação. A data fica (posiciona a célula).
    time: ve("detalhes") ? show.time : "",
    // PAGAMENTO — o cachê mora no show; parcelas vêm da venda.
    valor: ve("pagamento") ? show.valor : undefined,
    // CONTRATANTE — o nome vem por join; o id é o vínculo, escondido explícito
    // pra não vazar a ligação com o contato.
    contratanteId: ve("contratante") ? show.contratanteId : undefined,
    // DOCUMENTOS VINCULADOS — os ids são o que permite abrir venda/orçamento.
    // Sem o setor, some o link (e com ele o join da ficha no cliente).
    orcamentoId: ve("documentos") ? show.orcamentoId : undefined,
    vendaId: ve("documentos") ? show.vendaId : undefined,
    // HOTEL — booking carrega PII do hóspede.
    booking: ve("hotel") ? show.booking : undefined,
    // Cancelamento e dispensa de contrato carregam AUTORIA (quem/quando/motivo).
    // Ficam com "Detalhes do show", que é onde o status do show é lido.
    cancelamento: ve("detalhes") ? show.cancelamento : undefined,
    cancelamentoHistorico: ve("detalhes") ? show.cancelamentoHistorico : undefined,
    contratoDispensado: ve("documentos") ? show.contratoDispensado : undefined,
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
  // Agenda_item = voo/transporte/evento → domínio LOGÍSTICA, não hotel.
  if (podeVerAgendaLogistica(sessao, artistId)) return item;
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
  // Orçamento e venda andam JUNTOS (mesmo módulo). Qualquer chave v2 de vendas
  // dá acesso à lista — a autoria filtra o que aparece.
  if (!alcancaAlgumaChave(sessao, VENDAS_CHAVES_MODULO)) {
    return NextResponse.json(
      { erro: "Você não tem acesso a orçamentos." },
      { status: 403 }
    );
  }
  return null;
}

/** Pode CRIAR orçamento no artista? Embutido em `vendas.criar`. */
export function verificarCriarOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null
): NextResponse | null {
  if (!podeNaSessao(sessao, artistId, "vendas.criar")) {
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
  // PAPEL ARTISTA: os orçamentos são governados por `orcamentosVer` (privacidade),
  // NÃO pela visão de vendas. A chave `vendas.ver_orcamentos` é a única que faz
  // `podeArtista` consultar `orcamentosVer` (as chaves v2 sem "orcamento" caem em
  // vendasVer||orcamentosVer e superexpunham o artista). Regressão corrigida.
  if (sessao.papel === "artista") {
    return filtrarEscopoArtista(
      query,
      sessao,
      "vendas.ver_orcamentos",
      "vendas.ver_orcamentos"
    );
  }
  // EQUIPE: mesma autoria das vendas — `vendas.ver_outros` vê tudo do artista;
  // quem só tem chave própria (criar/editar_proprios/…) vê só os que criou.
  return filtrarEscopoAutoria(
    query,
    sessao,
    "vendas.ver_outros",
    VENDAS_CHAVES_PROPRIOS
  );
}

export function podeEditarOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  // Editar orçamento = editar venda (mesmo eixo de autoria): próprio →
  // editar_proprios; de outros → editar_outros.
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "vendas.editar_proprios",
    "vendas.editar_outros"
  );
}

/**
 * Excluir ORÇAMENTO: o autor descarta o próprio rascunho (`vendas.criar` já
 * embute mexer no que é dele); de outros = ADMIN-ONLY (não há chave delegável —
 * espelha a regra de "excluir venda só admin").
 */
export function podeExcluirOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  const ehProprio = !!criadoPor && criadoPor === sessao.userId;
  if (ehProprio) return podeNaSessao(sessao, artistId, "vendas.criar");
  return false;
}

/**
 * Converter ORÇAMENTO em venda: converter o PRÓPRIO está embutido em
 * `vendas.criar`; converter o de OUTROS exige `vendas.converter_outros`.
 */
export function podeConverterOrcamento(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "vendas.criar",
    "vendas.converter_outros"
  );
}

// ============================================================
// VENDAS — leitura por vendas.ver; mutação próprios × todos; cancelar por
// chave própria (vendas.cancelar_venda). Excluir por vendas.excluir_venda.
// ============================================================

export function verificarAcessoVendas(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (sessao.papel === "artista") return null; // artista lê as próprias (filtro)
  if (!alcancaAlgumaChave(sessao, VENDAS_CHAVES_MODULO)) {
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
  if (!podeNaSessao(sessao, artistId, "vendas.criar")) {
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
  return filtrarEscopoAutoria(
    query,
    sessao,
    "vendas.ver_outros",
    VENDAS_CHAVES_PROPRIOS
  );
}

/**
 * Pode VER esta venda/orçamento específica (GET [id])? Próprio → qualquer chave
 * própria (criou/edita/cancela → enxerga o que é dele); de outros → `ver_outros`.
 */
export function podeVerVendaItem(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  const ehProprio = !!criadoPor && criadoPor === sessao.userId;
  if (ehProprio) {
    return (
      VENDAS_CHAVES_PROPRIOS.some((c) => podeNaSessao(sessao, artistId, c)) ||
      podeNaSessao(sessao, artistId, "vendas.ver_outros")
    );
  }
  return podeNaSessao(sessao, artistId, "vendas.ver_outros");
}

/** Editar venda: próprio → editar_proprios; de outros → editar_outros. */
export function podeEditarVenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "vendas.editar_proprios",
    "vendas.editar_outros"
  );
}

/**
 * Excluir venda: ADMIN-ONLY (contrato — "Excluir venda continua só com o
 * admin"). Nenhuma chave de equipe exclui venda; o dono cancela, não exclui.
 */
export function podeExcluirVenda(
  sessao: SessaoAutenticada,
  _artistId?: string | null,
  _criadoPor?: string | null
): boolean {
  return sessao.isSuperAdmin || sessao.papel === "admin";
}

/**
 * Pode CANCELAR esta venda? Próprio → `vendas.cancelar_proprios`; de outros →
 * `vendas.cancelar_outros`. (Cancelar ≠ excluir; excluir é só admin.)
 */
export function podeCancelarVenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "vendas.cancelar_proprios",
    "vendas.cancelar_outros"
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
 * Gate de MUTAÇÃO de contato (v2 — autoria por `criado_por`, união dos vínculos).
 *   - admin/super → passa;
 *   - artista     → 403 (nunca muta contatos — comportamento atual mantido);
 *   - equipe:
 *       criar  → `contatos.criar` em algum vínculo (sem eixo de autoria);
 *       editar → `contatos.editar_proprios` (dele) × `contatos.editar_outros`;
 *       excluir→ `contatos.excluir_proprios` (dele) × `contatos.excluir_outros`.
 * `criadoPor` NULO conta como "de outros". Para `criar`, `criadoPor` é ignorado.
 */
export function verificarMutacaoContato(
  sessao: SessaoAutenticada,
  acao: "criar" | "editar" | "excluir",
  criadoPor?: string | null
): NextResponse | null {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return null;
  if (sessao.papel === "artista") {
    return NextResponse.json(
      { erro: "Artista não tem acesso a contatos." },
      { status: 403 }
    );
  }
  const permitido =
    acao === "criar"
      ? temChaveEmAlgumVinculo(sessao, "contatos.criar")
      : podePorAutoriaWorkspace(
          sessao,
          criadoPor,
          `contatos.${acao}_proprios`,
          `contatos.${acao}_outros`
        );
  if (!permitido) {
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

/**
 * Pode VER um contrato deste artista (artistId vem da venda; null = avulso)?
 * Autoria = `contratos.criado_por`: próprio embutido em `contratos.criar`;
 * de outros → `contratos.ver_outros`.
 */
export function podeVerContrato(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "contratos.criar",
    "contratos.ver_outros"
  );
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

/**
 * Pode EDITAR o contrato (autoria = contratos.criado_por)? O autor edita o
 * próprio via `contratos.criar` (que embute mexer no que é dele); editar o de
 * OUTROS = ADMIN-ONLY (não há chave delegável de "editar_outros" na v2 — só
 * cancelar_outros). O nível "Acesso total" cancela o de outros, não reedita.
 */
export function podeEditarContrato(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  const ehProprio = !!criadoPor && criadoPor === sessao.userId;
  if (ehProprio) return podeNaSessao(sessao, artistId, "contratos.criar");
  return false;
}

/**
 * Pode CANCELAR o contrato? Autoria: `contratos.cancelar_proprios` (dele) ×
 * `contratos.cancelar_outros` (de outros).
 */
export function podeCancelarContrato(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  return podePorAutoria(
    sessao,
    artistId,
    criadoPor,
    "contratos.cancelar_proprios",
    "contratos.cancelar_outros"
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

/**
 * Gate para CRIAR modelo de contrato (v2): admin/super OU `contratos.criar_modelo`
 * em ALGUM vínculo (workspace-level — o modelo não tem artist_id). 403 senão.
 */
export function verificarCriarModelo(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (temChaveEmAlgumVinculo(sessao, "contratos.criar_modelo")) return null;
  return NextResponse.json(
    { erro: "Você não tem permissão para criar modelo de contrato." },
    { status: 403 }
  );
}

/**
 * Gate para EXCLUIR modelo de contrato (v2): admin/super OU
 * `contratos.excluir_modelo` em ALGUM vínculo. ≠ excluir um contrato GERADO
 * (esse continua admin-only, `podeExcluirContrato`).
 */
export function verificarExcluirModelo(
  sessao: SessaoAutenticada
): NextResponse | null {
  if (temChaveEmAlgumVinculo(sessao, "contratos.excluir_modelo")) return null;
  return NextResponse.json(
    { erro: "Você não tem permissão para excluir modelo de contrato." },
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
 * Gate financeiro por artista + AUTORIA (via venda-mãe) para PATCH de parcela.
 * A parcela não tem artist_id nem criado_por: a rota resolve pela venda
 * (parcela.venda_id → vendas.artist_id / vendas.criado_por) e passa os dois.
 *
 * Ação → chave (própria × outros):
 *   - "informar"          → financeiro.informar_{proprios,outros}
 *   - "editar" | "cancelar" → financeiro.editar_{proprios,outros}
 *       (editar o financeiro INCLUI cancelar/baixar parcela — contrato)
 *   - "fixar"             → financeiro.fixar_{proprios,outros}
 *
 * `criadoPorVenda` NULO conta como "de outros".
 */
export function verificarMutacaoParcela(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPorVenda: string | null,
  acao: "informar" | "editar" | "cancelar" | "fixar"
): NextResponse | null {
  const base =
    acao === "informar"
      ? "informar"
      : acao === "fixar"
        ? "fixar"
        : "editar"; // editar/cancelar → editar (inclui baixar/cancelar parcela)
  const ok = podePorAutoria(
    sessao,
    artistId,
    criadoPorVenda,
    `financeiro.${base}_proprios`,
    `financeiro.${base}_outros`
  );
  if (!ok) {
    return NextResponse.json(
      { erro: "Você não tem permissão para alterar pagamentos desta venda." },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Pode ver ALGUM dado financeiro deste artista (gate de MÓDULO, sem uma venda
 * específica em mãos)? Qualquer uma das 8 chaves v2 no artista. Admin/super passam.
 */
export function podeVerFinanceiro(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  return FIN_CHAVES_MODULO.some((c) => podeNaSessao(sessao, artistId, c));
}

/**
 * Pode ver o FINANCEIRO desta VENDA (autoria via venda-mãe: artistId + criadoPor
 * da venda)? Comprovante bancário, taxa/líquido e rastro de pagamento. Próprio →
 * qualquer chave própria (ver/editar/informar/fixar_proprios); de outros →
 * qualquer chave de outros. `criadoPor` nulo = "de outros". Admin/super passam.
 */
export function podeVerFinanceiroVenda(
  sessao: SessaoAutenticada,
  artistId: string | null,
  criadoPor: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  const ehProprio = !!criadoPor && criadoPor === sessao.userId;
  const chaves = ehProprio ? FIN_CHAVES_PROPRIOS : ["financeiro.ver_outros", "financeiro.editar_outros", "financeiro.informar_outros", "financeiro.fixar_outros"];
  return chaves.some((c) => podeNaSessao(sessao, artistId, c));
}

/**
 * Filtra a lista do FINANCEIRO (vendas/parcelas com artist_id + criado_por) por
 * artista + autoria: `financeiro.ver_outros` vê todo o financeiro do artista;
 * quem só tem chave própria vê o das vendas que ELE criou.
 */
export function aplicarFiltroFinanceiro<Q extends QueryBuilder>(
  query: Q,
  sessao: SessaoAutenticada
): Q {
  return filtrarEscopoAutoria(
    query,
    sessao,
    "financeiro.ver_outros",
    FIN_CHAVES_PROPRIOS
  );
}

/**
 * Redige uma VENDA conforme o que a sessão pode ver do financeiro DELA (autoria
 * via venda-mãe): sem acesso → redigirVendaFinanceiro (tira meta + taxa/líquido);
 * com acesso → intacta. A taxa/líquido acompanha o acesso aos valores.
 */
export function redigirVendaParaSessao(
  sessao: SessaoAutenticada,
  v: Venda
): Venda {
  const artistId = v.artistaId || null;
  const criadoPor = v.criadoPor ?? null;
  if (!podeVerFinanceiroVenda(sessao, artistId, criadoPor)) {
    return redigirVendaFinanceiro(v);
  }
  return v;
}

/**
 * Orçamento não tem rastro de pagamento (parcelas/meta) e a taxa/líquido
 * acompanha o acesso aos valores — quem vê o orçamento vê a taxa. Passthrough
 * mantido pra não mexer nos call-sites das rotas.
 */
export function redigirOrcamentoParaSessao(
  _sessao: SessaoAutenticada,
  o: Orcamento
): Orcamento {
  return o;
}

// ============================================================
// ANOTAÇÕES — módulo de permissão POR ARTISTA (chaves `anotacoes.*` no
// vínculo membros_artista.permissoes; ZERO migration). A amarração por artista
// é a coluna `artist_id` da nota (a etiqueta de artista).
//
// REGRA DE COMPATIBILIDADE (não tirar acesso de quem já tem):
//   As chaves nasceram AGORA — nenhum vínculo existente as tem. Se o gate
//   passasse a exigi-las de cara, TODO MUNDO perderia anotações no mesmo
//   instante. Então o enforcement é OPT-IN por usuário:
//     - o BOOLEANO LEGADO (profiles.pode_criar_anotacoes → sessao.
//       podeCriarAnotacoes) continua valendo em OU, pra sempre;
//     - enquanto o usuário não tiver NENHUMA chave `anotacoes.*` em vínculo
//       nenhum, ele fica no comportamento de antes (nota livre na pasta que
//       enxerga) — ver `governadoPorChavesAnotacoes`;
//
//   ⚠️ EXCEÇÃO: a ação "ver" NÃO é mais opt-in. L1 (decisão do dono) fechou a
//   LEITURA de vez — `podeVerAnotacao` não consulta `governadoPorChavesAnotacoes`
//   e exige `anotacoes.ver` na regra (a) desde o primeiro deploy. Por isso os
//   PRESETS passaram a semear `anotacoes.ver` (perfis.ts): sem isso a regra (a)
//   nasceria inalcançável e toda nota etiquetada sumiria da tela de quem não é
//   admin. `criar`/`editar`/`excluir` seguem opt-in como descrito acima.
//     - assim que o admin marcar QUALQUER `anotacoes.*` pra ele no editor da
//       aba Equipe, o gate por artista passa a valer pra esse usuário.
//   Admin/super-admin sempre podem. O papel `artista` nunca entra no regime de
//   chaves (não tem vínculo operacional; é governado por privacidade/legado).
//
// Fora do regime de chaves, as regras antigas seguem intactas:
//   - Gerir a PASTA (renomear/visibilidade/excluir): o dono (criado_por) ou admin.
//   - Editar/excluir uma NOTA: o AUTOR. As chaves `anotacoes.editar`/`.excluir`
//     AMPLIAM isso (mexer na nota de outro) — nunca reduzem.
// ============================================================

/**
 * O usuário está no regime NOVO para ESTA AÇÃO (governado por `anotacoes.<acao>`)?
 * false = regime legado (comportamento de antes, preservado). Admin/super e
 * artista nunca são "governados" — passam pelos seus próprios caminhos.
 *
 * POR AÇÃO, não por módulo: se o regime ligasse com QUALQUER chave do prefixo,
 * marcar só "Excluir anotações" para alguém passaria a EXIGIR `anotacoes.ver`
 * que ninguém tem — e a base inteira sumiria da tela dela. Conceder permissão
 * jamais pode revogar outra. Cada ação entra no regime novo sozinha, quando (e
 * só quando) a chave dela aparece em algum vínculo.
 */
function governadoPorChavesAnotacoes(
  sessao: SessaoAutenticada,
  acao: "ver" | "criar" | "editar" | "excluir"
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return false;
  if (sessao.papel === "artista") return false;
  return temChaveEmAlgumVinculo(sessao, `anotacoes.${acao}`);
}

/**
 * Criar PASTA é WORKSPACE-level (a pasta não tem artist_id) → união dos
 * vínculos. Legado (`podeCriarAnotacoes`) somado em OU: quem já podia continua
 * podendo, marque-se o que se marcar no editor.
 */
export function podeCriarPastaAnotacao(sessao: SessaoAutenticada): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  if (sessao.podeCriarAnotacoes) return true; // legado — nunca revogado
  return temChaveEmAlgumVinculo(sessao, "anotacoes.criar");
}

export function podeGerirPasta(
  sessao: SessaoAutenticada,
  criadoPor: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  return !!criadoPor && criadoPor === sessao.userId;
}

/**
 * A ETIQUETA DE ARTISTA É OPCIONAL POR DESIGN — ela só pode RESTRINGIR quando
 * existe. Nota sem `artist_id` não é "linha legada rara": é o PADRÃO. O editor
 * abre em "Sem artista" (NotaEditor.tsx), a nota de show nasce sem etiqueta
 * (NotasDoShow.tsx) e o schema declara `artistId` nullable/optional.
 *
 * `podeNaSessao(sessao, null, ...)` cai no `if (!artistaId) return false` do
 * motor (resolver.ts) — tratar nota sem etiqueta pelo motor faria uma
 * permissão CONCEDIDA apagar a base de conhecimento inteira da tela de quem a
 * recebeu. Sem etiqueta = fora do regime por artista: vale o gate anterior
 * (RLS da pasta na leitura, `podeVerAgenda(show.artist_id)` na nota de show).
 */
function semEtiquetaDeArtista(artistId: string | null): boolean {
  return artistId === null || artistId === undefined;
}

// ============================================================
// LEITURA DE ANOTAÇÕES — FECHADA (decisão do dono, L1).
//
// MUDANÇA DE REGIME: até aqui a leitura era ABERTA (regime legado — a RLS da
// pasta era o único gate e `podeVerAnotacao` devolvia true pra qualquer um do
// workspace). O dono pediu explicitamente pra fechar. A regra dele:
//
//   "Se não tem permissão, só vê as anotações dos SHOWS que ele tem acesso, OU
//    anotações que quem tem acesso colocou ele nas permissões."
//
// Traduzido, um usuário vê uma nota quando:
//   (0) ele é o AUTOR dela (regra implícita — ver abaixo); OU
//   (a) tem `anotacoes.ver` no ARTISTA etiquetado na nota; OU
//   (b) a nota é de um SHOW cuja agenda ele já alcança (`podeVerAgenda` do
//       artista do show) — o mesmo gate que o POST já exigia pra criar; OU
//   (c) ele é MEMBRO EXPLÍCITO da pasta (visibilidade "selecionados"), ou dono
//       dela.
// Admin/super-admin sempre veem.
//
// UMA CONCESSÃO DELIBERADA: pasta com visibilidade "todos" (o dono da pasta
// compartilhou com o workspace inteiro) continua legível — mas SÓ para as notas
// SEM etiqueta de artista. Isso preserva a doutrina de que a etiqueta só pode
// RESTRINGIR, e evita que a base de conhecimento geral (avisos, procedimentos)
// suma da tela de todo mundo no mesmo instante. Nota etiquetada num artista
// dentro de pasta aberta passa a exigir (a) ou (c).
//
// O booleano legado `pode_criar_anotacoes` NÃO libera leitura (ele só vale pra
// CRIAR, ver `podeCriarAnotacao`); quem trabalha com anotações continua vendo
// as pastas que criou por (c).
//
// REGRA (0) — AUTORIA. Sem ela o fechamento vira PERDA DE DADO: quem tem
// `pode_criar_anotacoes` (legado) cria uma nota etiquetada num artista dentro de
// uma pasta "todos", recebe 201, e a nota some no F5 — (a) falha (não tem
// chave), (c) só libera nota SEM etiqueta em pasta aberta. Pior: `podeLerNota`
// roda ANTES de `podeMexerNaNota` no PATCH/DELETE, então o autor nem apaga o
// próprio registro (404). Quem escreveu sempre enxerga o que escreveu; isso não
// amplia o alcance de ninguém (só devolve a própria linha).
// ============================================================

/**
 * O que a rota precisa carregar do banco pra decidir (b) e (c) — a permissão
 * sozinha não tem como saber de show nem de pasta. Montado uma vez por request
 * (ver `contextoDeAnotacoes` em services/anotacoes.service.ts).
 */
export type ContextoAnotacoes = {
  /** show_id → artist_id do show (só dos shows que a sessão enxerga). */
  artistaPorShow: Map<string, string | null>;
  /** Pastas em que ele é membro explícito (usuário, ou artista dele). */
  pastasComMembro: Set<string>;
  /** Pastas criadas por ele. */
  pastasProprias: Set<string>;
  /** Pastas com visibilidade "todos" (compartilhadas com o workspace). */
  pastasAbertas: Set<string>;
};

/** A parte da nota que o gate de leitura olha. */
export type NotaParaGate = {
  artistId?: string | null;
  showId?: string | null;
  pastaId?: string | null;
  /** Autor da nota (regra 0). `criado_por` já vem no COLS_NOTA do repo. */
  criadoPor?: string | null;
};

/**
 * Pode VER esta nota? Ver a doutrina acima (regras a/b/c). Sem contexto
 * carregado o gate NÃO adivinha: cai só na regra (a) — por isso toda rota de
 * leitura deve passar o `ctx`.
 */
export function podeVerAnotacao(
  sessao: SessaoAutenticada,
  nota: NotaParaGate,
  ctx?: ContextoAnotacoes
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;

  // (0) AUTORIA — quem escreveu sempre enxerga o que escreveu. Tem que vir
  // antes de tudo: sem isto o autor perde a nota no F5 e não consegue nem
  // apagá-la (podeLerNota roda antes de podeMexerNaNota no PATCH/DELETE).
  if (nota.criadoPor && nota.criadoPor === sessao.userId) return true;

  const artistId = nota.artistId ?? null;
  // (a) chave no artista etiquetado.
  if (!semEtiquetaDeArtista(artistId) && podeNaSessao(sessao, artistId, "anotacoes.ver")) {
    return true;
  }

  // (b) nota de SHOW: quem alcança a agenda do artista do show alcança a nota.
  // Espelha o gate que o POST /api/anotacoes já faz na criação.
  if (nota.showId) {
    if (!ctx) return false;
    const artistaDoShow = ctx.artistaPorShow.get(nota.showId);
    // Show ausente do mapa = ele não enxerga o show → não enxerga a nota.
    if (artistaDoShow === undefined) return false;
    return podeVerAgenda(sessao, artistaDoShow);
  }

  // (c) nota de PASTA: dono ou membro explícito. Pasta aberta ("todos") libera
  // só a nota SEM etiqueta de artista (concessão documentada acima).
  if (nota.pastaId) {
    if (!ctx) return false;
    if (ctx.pastasProprias.has(nota.pastaId)) return true;
    if (ctx.pastasComMembro.has(nota.pastaId)) return true;
    return ctx.pastasAbertas.has(nota.pastaId) && semEtiquetaDeArtista(artistId);
  }

  // Nota solta (sem pasta e sem show) — linha legada rara. Sem etiqueta segue o
  // comportamento antigo; etiquetada exige a chave (já testada em (a)).
  return semEtiquetaDeArtista(artistId);
}

/**
 * Pode CRIAR uma nota etiquetada neste artista? Regime legado → true (antes
 * bastava enxergar a pasta). Regime de chaves → exige `anotacoes.criar` no
 * artista, ou o booleano legado. Sem etiqueta → não-governado.
 */
export function podeCriarAnotacao(
  sessao: SessaoAutenticada,
  artistId: string | null
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  if (sessao.podeCriarAnotacoes) return true; // legado — nunca revogado
  if (semEtiquetaDeArtista(artistId)) return true; // não-governado
  if (!governadoPorChavesAnotacoes(sessao, "criar")) return true; // legado
  return podeNaSessao(sessao, artistId, "anotacoes.criar");
}

/**
 * Pode editar/excluir ESTA nota? O AUTOR sempre pode (regra de antes, mantida);
 * a chave `anotacoes.editar`/`.excluir` no artista da nota AMPLIA pra mexer na
 * nota de outra pessoa. Admin/super passam.
 */
export function podeMexerNaNota(
  sessao: SessaoAutenticada,
  criadoPor: string | null,
  artistId: string | null = null,
  acao: "editar" | "excluir" = "editar"
): boolean {
  if (sessao.isSuperAdmin || sessao.papel === "admin") return true;
  if (criadoPor && criadoPor === sessao.userId) return true; // autor — como antes
  return podeNaSessao(sessao, artistId, `anotacoes.${acao}`);
}
