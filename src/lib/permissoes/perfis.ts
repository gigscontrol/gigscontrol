/**
 * PERFIS (presets de permissão).
 *
 * Perfil = BASE. Ao aplicar um perfil a um vínculo (usuário × artista), as
 * permissões dele são semeadas (marcadas). Depois o admin pode personalizar
 * qualquer checkbox — a personalização (o conjunto final salvo no vínculo) é
 * que vale. Um vínculo pode ter VÁRIOS perfis (herda a união).
 *
 * Fase 1: perfis são presets FIXOS (código). Criar/editar perfis próprios
 * (tabela no banco) fica pra uma fase posterior — ver agencia.criar_perfil.
 */

import { CHAVES_SETORES_AGENDA, CHAVES_SETORES_BASICO } from "./setoresAgenda";

export type PerfilId =
  | "manager"
  | "financeiro"
  | "juridico"
  | "vendedor"
  | "equipe"
  | "artista";

export type Perfil = {
  id: PerfilId;
  nome: string;
  descricao: string;
  /** Cor de identidade do perfil (categórica — como cor de papel). */
  cor: string;
  /** Chaves de permissão que este perfil concede por padrão. */
  permissoes: string[];
};

/**
 * ⚠️ REVISÃO L5 — o que mudou de significado nestes presets.
 *
 * A agenda virou SÓ VISUALIZAÇÃO de show: as chaves `agenda.criar` /
 * `agenda.editar*` / `agenda.excluir*` passaram a governar SOMENTE os itens de
 * agenda (voo, transporte terrestre, evento personalizado). Criar/editar/
 * cancelar/excluir SHOW exige chave de VENDAS. Efeito, preset a preset:
 *
 *   manager   → INALTERADO na prática. Já tem criar_venda + editar_venda +
 *               editar_todos + cancelar_venda, então continua fazendo tudo com
 *               o show; `agenda.*` agora lhe dá voo/transporte/evento.
 *   vendedor  → GANHA. Tem criar_venda/editar_venda/cancelar_venda, logo passa
 *               a criar e gerenciar show pela agenda (antes o servidor exigia
 *               `agenda.criar`, que ele não tem). Continua vendo a agenda no
 *               nível Básico e NÃO mexe em voo/transporte/evento.
 *   equipe    → PERDE, de propósito. Tem `agenda.criar`/`agenda.editar` e
 *               nenhuma chave de mutação de vendas: deixa de ver "Novo Show" e
 *               de editar/cancelar show. Segue dona da logística (voo,
 *               transporte, evento) e vendo a agenda detalhada. É exatamente o
 *               papel que o dono descreveu — mexer em show é de quem tem
 *               permissão de vendas.
 *   financeiro / juridico / artista → sem chave de agenda de mutação; nada muda.
 *
 * Quem tinha um vínculo PERSONALIZADO com `agenda.editar_todos` e nenhuma chave
 * de vendas cai no mesmo caso do preset "equipe": perde cancelar/editar show.
 * Para devolver, o admin marca a capacidade correspondente em VENDAS.
 *
 * ⚠️ REVISÃO L1 — por que `anotacoes.ver` entrou em TODOS os presets.
 *
 * L1 fechou a LEITURA de anotações contra a chave `anotacoes.ver`. Diferente do
 * gate de CRIAR (que é opt-in via `governadoPorChavesAnotacoes`), o de LER
 * fecha para todo mundo no instante do deploy. Como nenhum preset concedia
 * chave `anotacoes.*`, a regra (a) do dono nascia INALCANÇÁVEL: toda nota
 * ETIQUETADA num artista sumiria da tela de qualquer não-admin — manager,
 * vendedor, equipe, financeiro e jurídico — e o único reparo seria o admin
 * abrir vínculo por vínculo (O(usuários × artistas)). Isso não é "fechar por
 * permissão", é apagar a base de conhecimento.
 *
 * `anotacoes.ver` é por VÍNCULO, então conceder no preset NÃO abre nada novo:
 * o usuário só passa a ler as notas dos artistas a que ele já está ligado —
 * exatamente "quem tem acesso ao artista vê as anotações do artista".
 * `anotacoes.criar` fica só em quem opera a base (manager, vendedor, equipe);
 * financeiro/jurídico leem e não escrevem.
 *
 * ATENÇÃO — PRESET É SEMENTE, NÃO BACKFILL: isto vale para vínculos NOVOS (e
 * para quem reaplicar o perfil). Vínculos JÁ SALVOS não ganham a chave sozinhos
 * e continuam sem ler nota etiquetada. Ver a nota de deploy no reporte.
 */
export const PERFIS: Perfil[] = [
  {
    id: "manager",
    nome: "Manager",
    descricao: "Gerencia o artista de ponta a ponta (agenda, vendas, financeiro, contratos, contatos).",
    cor: "#6366f1",
    permissoes: [
      ...CHAVES_SETORES_AGENDA, "agenda.criar", "agenda.editar", "agenda.editar_todos",
      "vendas.ver", "vendas.ver_orcamentos", "vendas.criar_orcamento", "vendas.editar_orcamento", "vendas.converter",
      "vendas.criar_venda", "vendas.editar_venda", "vendas.editar_todos", "vendas.cancelar_venda",
      "financeiro.ver",
      "financeiro.registrar_pagamento", "financeiro.editar_pagamento",
      "contratos.ver", "contratos.criar", "contratos.editar", "contratos.editar_todos", "contratos.cancelar",
      "anotacoes.ver", "anotacoes.criar",
    ],
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Acompanha pagamentos e recebimentos do artista.",
    cor: "#3b82f6",
    permissoes: [
      "vendas.ver", "vendas.ver_orcamentos",
      "financeiro.ver",
      "financeiro.registrar_pagamento", "financeiro.editar_pagamento", "financeiro.cancelar_pagamento",
      "anotacoes.ver",
    ],
  },
  {
    id: "juridico",
    nome: "Jurídico",
    descricao: "Cria e gerencia os contratos do artista.",
    cor: "#14b8a6",
    permissoes: [
      "vendas.ver", "vendas.ver_orcamentos",
      "contratos.ver", "contratos.criar", "contratos.editar", "contratos.editar_todos", "contratos.cancelar",
      "anotacoes.ver",
    ],
  },
  {
    id: "vendedor",
    nome: "Vendedor",
    descricao: "Cria orçamentos e fecha vendas do artista.",
    cor: "#22c55e",
    permissoes: [
      ...CHAVES_SETORES_BASICO,
      "vendas.ver", "vendas.ver_orcamentos", "vendas.criar_orcamento", "vendas.editar_orcamento", "vendas.converter",
      "vendas.criar_venda", "vendas.editar_venda", "vendas.cancelar_venda",
      "anotacoes.ver", "anotacoes.criar",
    ],
  },
  {
    id: "equipe",
    nome: "Equipe",
    descricao: "Operação e logística — cuida da agenda e do dia a dia.",
    cor: "#f59e0b",
    permissoes: [
      ...CHAVES_SETORES_AGENDA, "agenda.criar", "agenda.editar",
      "vendas.ver", "vendas.ver_orcamentos",
      "anotacoes.ver", "anotacoes.criar",
    ],
  },
  {
    id: "artista",
    nome: "Artista",
    descricao: "O próprio artista — vê os dados dele.",
    cor: "#a855f7",
    permissoes: [
      ...CHAVES_SETORES_AGENDA, "vendas.ver", "vendas.ver_orcamentos", "financeiro.ver", "contratos.ver",
      "anotacoes.ver",
    ],
  },
];

export const PERFIL_POR_ID: Record<PerfilId, Perfil> = Object.fromEntries(
  PERFIS.map((p) => [p.id, p])
) as Record<PerfilId, Perfil>;

/**
 * União das permissões de um conjunto de perfis (a semente inicial de um
 * vínculo antes de personalizar).
 */
export function permissoesDosPerfis(perfis: PerfilId[]): string[] {
  const set = new Set<string>();
  for (const id of perfis) {
    const p = PERFIL_POR_ID[id];
    if (p) for (const c of p.permissoes) set.add(c);
  }
  return [...set];
}
