/**
 * CAPACIDADES — camada de UI sobre o catálogo de permissões.
 *
 * Cada capacidade é uma LINHA no editor: um liga/desliga. Quando a capacidade
 * tem ESCOPO (ex.: ver agenda básica/detalhada; editar só os que criou/todos),
 * ao ligar aparece um sub-seletor (radio) com as variantes — e SÓ UMA variante
 * é guardada no vínculo.
 *
 * O armazenamento continua sendo o array plano de chaves (membros_artista.
 * permissoes). Estas funções traduzem entre o array e o estado da UI.
 */

import type { ModuloPermissao } from "./catalogo";

export type Variante = { chave: string; label: string; existe?: boolean };

export type Capacidade = {
  id: string;
  modulo: ModuloPermissao;
  label: string;
  /** Base existe/enforça hoje? (slots futuros = false). */
  existe: boolean;
  /** Capacidade simples → esta é a chave guardada. */
  chave?: string;
  /** Capacidade com escopo → radio; guarda UMA das chaves. Ordem = menor→maior. */
  variantes?: Variante[];
};

export const CAPACIDADES: Capacidade[] = [
  // -------- AGENDA --------
  // ATENÇÃO (L5): a agenda é SÓ VISUALIZAÇÃO de SHOWS. Nenhuma chave daqui
  // cria, edita ou cancela show — isso migrou para o módulo VENDAS
  // (vendas.criar_venda / editar_venda|editar_todos / cancelar_venda).
  // As chaves de criar/editar/excluir abaixo governam SÓ os itens de agenda:
  // voo, transporte terrestre e evento personalizado.
  {
    id: "agenda.ver", modulo: "agenda", label: "Ver agenda", existe: true,
    variantes: [
      { chave: "agenda.ver", label: "Básica — dia, local e horário" },
      { chave: "agenda.ver_detalhado", label: "Detalhada — todas as informações" },
    ],
  },
  { id: "agenda.criar", modulo: "agenda", label: "Criar voo, transporte ou evento", existe: true, chave: "agenda.criar" },
  {
    id: "agenda.editar", modulo: "agenda", label: "Editar voos, transportes e eventos", existe: true,
    variantes: [
      { chave: "agenda.editar", label: "Só os que ele criou" },
      { chave: "agenda.editar_todos", label: "Qualquer um" },
    ],
  },
  {
    id: "agenda.excluir", modulo: "agenda", label: "Excluir voos, transportes e eventos", existe: true,
    variantes: [
      { chave: "agenda.excluir", label: "Só os que ele criou" },
      { chave: "agenda.excluir_todos", label: "Qualquer um" },
    ],
  },

  // -------- VENDAS --------
  {
    id: "vendas.ver", modulo: "vendas", label: "Ver vendas", existe: true,
    variantes: [
      { chave: "vendas.ver", label: "Todas" },
      { chave: "vendas.ver_proprios", label: "Só as que ele criou" },
    ],
  },
  { id: "vendas.ver_orcamentos", modulo: "vendas", label: "Ver orçamentos", existe: true, chave: "vendas.ver_orcamentos" },
  { id: "vendas.criar_orcamento", modulo: "vendas", label: "Criar orçamento", existe: true, chave: "vendas.criar_orcamento" },
  { id: "vendas.editar_orcamento", modulo: "vendas", label: "Editar orçamento", existe: true, chave: "vendas.editar_orcamento" },
  { id: "vendas.excluir_orcamento", modulo: "vendas", label: "Excluir orçamento", existe: true, chave: "vendas.excluir_orcamento" },
  { id: "vendas.converter", modulo: "vendas", label: "Converter orçamento em venda", existe: true, chave: "vendas.converter" },
  { id: "vendas.criar_venda", modulo: "vendas", label: "Criar venda", existe: true, chave: "vendas.criar_venda" },
  {
    id: "vendas.editar_venda", modulo: "vendas", label: "Editar venda", existe: true,
    variantes: [
      { chave: "vendas.editar_venda", label: "Só as que ele criou" },
      { chave: "vendas.editar_todos", label: "Todas as vendas" },
    ],
  },
  { id: "vendas.cancelar_venda", modulo: "vendas", label: "Cancelar venda", existe: true, chave: "vendas.cancelar_venda" },
  { id: "vendas.excluir_venda", modulo: "vendas", label: "Excluir venda", existe: true, chave: "vendas.excluir_venda" },

  // -------- FINANCEIRO --------
  { id: "financeiro.ver", modulo: "financeiro", label: "Ver o financeiro (caches e pagamentos)", existe: true, chave: "financeiro.ver" },
  { id: "financeiro.ver_taxa", modulo: "financeiro", label: "Ver a taxa de agência e o líquido", existe: true, chave: "financeiro.ver_taxa" },
  { id: "financeiro.ver_saldo", modulo: "financeiro", label: "Ver o saldo", existe: false, chave: "financeiro.ver_saldo" },
  { id: "financeiro.ver_despesas", modulo: "financeiro", label: "Ver as despesas", existe: false, chave: "financeiro.ver_despesas" },
  { id: "financeiro.ver_comissoes", modulo: "financeiro", label: "Ver as comissões", existe: false, chave: "financeiro.ver_comissoes" },
  { id: "financeiro.registrar_pagamento", modulo: "financeiro", label: "Registrar pagamento", existe: true, chave: "financeiro.registrar_pagamento" },
  { id: "financeiro.editar_pagamento", modulo: "financeiro", label: "Editar pagamento", existe: true, chave: "financeiro.editar_pagamento" },
  { id: "financeiro.cancelar_pagamento", modulo: "financeiro", label: "Desfazer/cancelar pagamento", existe: true, chave: "financeiro.cancelar_pagamento" },
  { id: "financeiro.registrar_recebimento", modulo: "financeiro", label: "Registrar recebimento", existe: false, chave: "financeiro.registrar_recebimento" },
  { id: "financeiro.criar_receita", modulo: "financeiro", label: "Lançar receita", existe: false, chave: "financeiro.criar_receita" },
  { id: "financeiro.criar_despesa", modulo: "financeiro", label: "Lançar despesa", existe: false, chave: "financeiro.criar_despesa" },
  { id: "financeiro.excluir_lancamento", modulo: "financeiro", label: "Excluir lançamento", existe: false, chave: "financeiro.excluir_lancamento" },
  { id: "financeiro.aprovar_pagamento", modulo: "financeiro", label: "Aprovar pagamento", existe: false, chave: "financeiro.aprovar_pagamento" },

  // -------- CONTRATOS --------
  { id: "contratos.ver", modulo: "contratos", label: "Ver contratos", existe: true, chave: "contratos.ver" },
  { id: "contratos.criar", modulo: "contratos", label: "Criar contrato", existe: true, chave: "contratos.criar" },
  {
    id: "contratos.editar", modulo: "contratos", label: "Editar contrato", existe: true,
    variantes: [
      { chave: "contratos.editar", label: "Só os que ele criou" },
      { chave: "contratos.editar_todos", label: "Todos os contratos" },
    ],
  },
  { id: "contratos.cancelar", modulo: "contratos", label: "Cancelar contrato", existe: true, chave: "contratos.cancelar" },
  // contratos.excluir REMOVIDO: excluir contrato é admin-only (não delegável),
  // logo não tem capacidade no editor por-artista.

  // -------- CONTATOS --------
  // Agora REAIS (enforcement por UNIÃO dos vínculos): ter contatos.ver em
  // ALGUM vínculo = vê todos os contatos do workspace; só contatos.ver_proprios
  // = vê apenas os que ele criou; criar/editar/excluir exigem a chave
  // respectiva em algum vínculo. As chaves ainda são gravadas por-artista no
  // vínculo — a união é computada no serviço de contatos (outro WI).
  {
    id: "contatos.ver", modulo: "contatos", label: "Ver contatos", existe: true,
    variantes: [
      { chave: "contatos.ver", label: "Todos" },
      { chave: "contatos.ver_proprios", label: "Só os que ele criou" },
    ],
  },
  { id: "contatos.criar", modulo: "contatos", label: "Criar contato", existe: true, chave: "contatos.criar" },
  { id: "contatos.editar", modulo: "contatos", label: "Editar contato", existe: true, chave: "contatos.editar" },
  { id: "contatos.excluir", modulo: "contatos", label: "Excluir contato", existe: true, chave: "contatos.excluir" },

  // -------- ANOTAÇÕES --------
  // Cada capacidade aqui PRECISA ter a chave gêmea no CATALOGO com
  // nivel:"artista" — senão o editor mostra a caixa, o admin marca, e
  // vinculo.schema.ts rejeita o payload INTEIRO (400). As 4 estão lá.
  // O booleano legado (profiles.pode_criar_anotacoes) continua valendo em OU:
  // marcar/desmarcar aqui NÃO revoga acesso de quem já tinha.
  { id: "anotacoes.ver", modulo: "anotacoes", label: "Ver anotações", existe: true, chave: "anotacoes.ver" },
  { id: "anotacoes.criar", modulo: "anotacoes", label: "Criar anotação", existe: true, chave: "anotacoes.criar" },
  { id: "anotacoes.editar", modulo: "anotacoes", label: "Editar anotações (mesmo as de outros)", existe: true, chave: "anotacoes.editar" },
  { id: "anotacoes.excluir", modulo: "anotacoes", label: "Excluir anotações (mesmo as de outros)", existe: true, chave: "anotacoes.excluir" },
];

export function capacidadesDoModulo(modulo: ModuloPermissao): Capacidade[] {
  return CAPACIDADES.filter((c) => c.modulo === modulo);
}

/** Todas as chaves que uma capacidade "possui" (a simples ou todas as variantes). */
function chavesDaCapacidade(cap: Capacidade): string[] {
  if (cap.variantes) return cap.variantes.map((v) => v.chave);
  return cap.chave ? [cap.chave] : [];
}

export function capacidadeAtiva(perms: Set<string>, cap: Capacidade): boolean {
  return chavesDaCapacidade(cap).some((k) => perms.has(k));
}

/** Variante selecionada (a MAIOR presente — variantes ordenadas menor→maior). */
export function varianteAtiva(perms: Set<string>, cap: Capacidade): string | undefined {
  if (!cap.variantes) return undefined;
  let sel: string | undefined;
  for (const v of cap.variantes) if (perms.has(v.chave)) sel = v.chave;
  return sel;
}

/** Liga/desliga a capacidade. Ao ligar, escopo começa na 1ª variante (menor). */
export function toggleCapacidade(perms: Set<string>, cap: Capacidade): Set<string> {
  const next = new Set(perms);
  if (capacidadeAtiva(perms, cap)) {
    for (const k of chavesDaCapacidade(cap)) next.delete(k);
  } else if (cap.variantes) {
    next.add(cap.variantes[0].chave);
  } else if (cap.chave) {
    next.add(cap.chave);
  }
  return next;
}

/** Escolhe uma variante (troca a que estava). */
export function selecionarVariante(perms: Set<string>, cap: Capacidade, chave: string): Set<string> {
  const next = new Set(perms);
  if (cap.variantes) for (const v of cap.variantes) next.delete(v.chave);
  next.add(chave);
  return next;
}

// ============================================================
// MODO DA AGENDA (L5a) — camada ACIMA da capacidade.
//
// O editor da agenda deixou de ser uma lista de checkboxes solta e virou um
// seletor de 3 níveis. Como o armazenamento continua sendo o array plano de
// chaves, o "modo" é DERIVADO do conjunto de chaves de agenda — não existe
// campo novo em lugar nenhum (zero migration):
//
//   BÁSICO        → { agenda.ver }
//                   vê dia, local e horário. Nada mais.
//   ACESSO TOTAL  → { agenda.ver_detalhado, agenda.criar,
//                     agenda.editar_todos, agenda.excluir_todos }
//                   VISUALIZA tudo do show e é dono da logística própria da
//                   agenda (voo/transporte/evento). NÃO cria, edita nem
//                   cancela SHOW — isso é chave de VENDAS.
//   PERSONALIZADO → qualquer outra combinação (inclusive NENHUMA chave de
//                   agenda = sem acesso à agenda). O editor abre a lista
//                   granular item a item.
// ============================================================

export type ModoAgenda = "basico" | "personalizado" | "total";

export const CHAVES_AGENDA_BASICO: readonly string[] = ["agenda.ver"];

export const CHAVES_AGENDA_TOTAL: readonly string[] = [
  "agenda.ver_detalhado",
  "agenda.criar",
  "agenda.editar_todos",
  "agenda.excluir_todos",
];

/** Só as chaves do módulo agenda presentes no set. */
function chavesDeAgenda(perms: Set<string>): string[] {
  return [...perms].filter((k) => k.startsWith("agenda."));
}

function mesmoConjunto(a: string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}

/**
 * NENHUMA chave de agenda no vínculo = SEM ACESSO à agenda.
 *
 * Não é um quarto `ModoAgenda` de propósito (os 3 níveis são o que o dono
 * definiu e o que `aplicarModoAgenda` sabe gravar), mas o editor PRECISA
 * distinguir: o conjunto vazio não bate com BÁSICO nem com TOTAL e cai no
 * default "personalizado", fazendo o pill Personalizado aparecer SELECIONADO
 * com a lista granular toda desmarcada. Num editor de permissão isso se lê
 * como "tem acesso customizado" quando a verdade é "não tem agenda" — e
 * ambiguidade aqui vira erro de configuração.
 */
export function semAcessoAgenda(perms: Set<string>): boolean {
  return chavesDeAgenda(perms).length === 0;
}

/** Em qual dos 3 níveis este conjunto de permissões cai? */
export function modoAgenda(perms: Set<string>): ModoAgenda {
  const atuais = chavesDeAgenda(perms);
  if (mesmoConjunto(atuais, CHAVES_AGENDA_BASICO)) return "basico";
  if (mesmoConjunto(atuais, CHAVES_AGENDA_TOTAL)) return "total";
  return "personalizado";
}

/**
 * Troca o nível. "personalizado" NÃO mexe nas chaves (só abre a lista granular
 * no editor) — trocar pra personalizado e voltar não perde a configuração.
 */
export function aplicarModoAgenda(perms: Set<string>, modo: ModoAgenda): Set<string> {
  if (modo === "personalizado") return new Set(perms);
  const next = new Set([...perms].filter((k) => !k.startsWith("agenda.")));
  for (const k of modo === "basico" ? CHAVES_AGENDA_BASICO : CHAVES_AGENDA_TOTAL) {
    next.add(k);
  }
  return next;
}

/** Mantém só UMA variante (a maior) por capacidade — limpa o set antes de salvar. */
export function normalizarPerms(perms: Set<string>): Set<string> {
  const next = new Set(perms);
  for (const cap of CAPACIDADES) {
    if (!cap.variantes) continue;
    const sel = varianteAtiva(next, cap);
    for (const v of cap.variantes) if (v.chave !== sel) next.delete(v.chave);
  }
  return next;
}
