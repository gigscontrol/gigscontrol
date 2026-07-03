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

export const PERFIS: Perfil[] = [
  {
    id: "manager",
    nome: "Manager",
    descricao: "Gerencia o artista de ponta a ponta (agenda, vendas, financeiro, contratos, contatos).",
    cor: "#6366f1",
    permissoes: [
      "agenda.ver", "agenda.ver_detalhado", "agenda.criar", "agenda.editar", "agenda.editar_todos",
      "vendas.ver", "vendas.criar_orcamento", "vendas.editar_orcamento", "vendas.converter",
      "vendas.criar_venda", "vendas.editar_venda", "vendas.editar_todos",
      "financeiro.ver", "financeiro.ver_caches", "financeiro.ver_pagamentos",
      "financeiro.registrar_pagamento", "financeiro.editar_pagamento",
      "contratos.ver", "contratos.criar", "contratos.editar", "contratos.editar_todos",
    ],
  },
  {
    id: "financeiro",
    nome: "Financeiro",
    descricao: "Acompanha pagamentos e recebimentos do artista.",
    cor: "#3b82f6",
    permissoes: [
      "vendas.ver",
      "financeiro.ver", "financeiro.ver_caches", "financeiro.ver_pagamentos",
      "financeiro.registrar_pagamento", "financeiro.editar_pagamento", "financeiro.cancelar_pagamento",
    ],
  },
  {
    id: "juridico",
    nome: "Jurídico",
    descricao: "Cria e gerencia os contratos do artista.",
    cor: "#14b8a6",
    permissoes: [
      "vendas.ver",
      "contratos.ver", "contratos.criar", "contratos.editar", "contratos.editar_todos",
    ],
  },
  {
    id: "vendedor",
    nome: "Vendedor",
    descricao: "Cria orçamentos e fecha vendas do artista.",
    cor: "#22c55e",
    permissoes: [
      "agenda.ver",
      "vendas.ver", "vendas.criar_orcamento", "vendas.editar_orcamento", "vendas.converter",
      "vendas.criar_venda", "vendas.editar_venda",
    ],
  },
  {
    id: "equipe",
    nome: "Equipe",
    descricao: "Operação e logística — cuida da agenda e do dia a dia.",
    cor: "#f59e0b",
    permissoes: [
      "agenda.ver", "agenda.ver_detalhado", "agenda.criar", "agenda.editar",
      "vendas.ver",
    ],
  },
  {
    id: "artista",
    nome: "Artista",
    descricao: "O próprio artista — vê os dados dele.",
    cor: "#a855f7",
    permissoes: [
      "agenda.ver", "agenda.ver_detalhado", "vendas.ver", "financeiro.ver", "contratos.ver",
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

/** Mapeia as funções operacionais LEGADAS pro perfil equivalente (backfill). */
export const FUNCAO_LEGADA_PARA_PERFIL: Record<"vendedor" | "financeiro" | "produtor", PerfilId> = {
  vendedor: "vendedor",
  financeiro: "financeiro",
  produtor: "equipe",
};

/**
 * PONTE (transição): perfil novo → funções LEGADAS que ele cobre. Usado ao
 * criar usuário no modelo novo pra também gravar profiles.funcoes, de forma
 * que os módulos ainda não migrados (Fase 4) continuem funcionando. Sai na
 * Fase 5, quando o legado for aposentado.
 */
export const PERFIL_PARA_FUNCOES_LEGADO: Record<
  PerfilId,
  ("vendedor" | "financeiro" | "produtor")[]
> = {
  manager: ["vendedor", "financeiro", "produtor"],
  financeiro: ["financeiro"],
  juridico: ["produtor"],
  vendedor: ["vendedor"],
  equipe: ["produtor"],
  artista: [],
};
