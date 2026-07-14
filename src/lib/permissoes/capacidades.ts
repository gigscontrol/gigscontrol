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
  {
    id: "agenda.ver", modulo: "agenda", label: "Ver agenda", existe: true,
    variantes: [
      { chave: "agenda.ver", label: "Básica — dia, local e horário" },
      { chave: "agenda.ver_detalhado", label: "Detalhada — todas as informações" },
    ],
  },
  { id: "agenda.criar", modulo: "agenda", label: "Criar evento", existe: true, chave: "agenda.criar" },
  {
    id: "agenda.editar", modulo: "agenda", label: "Editar eventos", existe: true,
    variantes: [
      { chave: "agenda.editar", label: "Só os que ele criou" },
      { chave: "agenda.editar_todos", label: "Qualquer evento" },
    ],
  },
  {
    id: "agenda.excluir", modulo: "agenda", label: "Excluir eventos", existe: true,
    variantes: [
      { chave: "agenda.excluir", label: "Só os que ele criou" },
      { chave: "agenda.excluir_todos", label: "Qualquer evento" },
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
