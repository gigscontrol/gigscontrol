/**
 * CATÁLOGO DE PERMISSÕES (fonte da verdade, versionável).
 *
 * Modelo novo: as permissões são por VÍNCULO (usuário × artista), semeadas por
 * um perfil (preset) e personalizáveis por checkbox. Este arquivo lista TODAS as
 * permissões possíveis. Adicionar módulo/permissão no futuro = só estender aqui.
 *
 * `nivel`:
 *   - "artista"   → a permissão vale POR artista (vai no vínculo membros_artista).
 *   - "workspace" → é administrativa da agência (não é por-artista; gestão global).
 *
 * `existe`: true = já há operação real no app que essa chave protege (dá pra
 * fazer enforcement hoje). false = "slot" pronto pra quando a feature nascer
 * (aparece no editor mas ainda não barra nada). Mantido à prova de futuro.
 */

export type ModuloPermissao =
  | "agenda"
  | "vendas"
  | "financeiro"
  | "contratos"
  | "contatos"
  | "agencia";

export type NivelPermissao = "artista" | "workspace";

export type Permissao = {
  chave: string;
  modulo: ModuloPermissao;
  nivel: NivelPermissao;
  label: string;
  existe: boolean;
};

export const MODULOS: { id: ModuloPermissao; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "vendas", label: "Vendas" },
  { id: "financeiro", label: "Financeiro" },
  { id: "contratos", label: "Contratos" },
  { id: "contatos", label: "Contatos" },
  { id: "agencia", label: "Agência" },
];

export const CATALOGO: Permissao[] = [
  // ---------------- AGENDA (por artista) ----------------
  { chave: "agenda.ver", modulo: "agenda", nivel: "artista", label: "Visualizar agenda", existe: true },
  { chave: "agenda.criar", modulo: "agenda", nivel: "artista", label: "Criar evento", existe: true },
  { chave: "agenda.editar", modulo: "agenda", nivel: "artista", label: "Editar eventos criados por ele", existe: true },
  { chave: "agenda.editar_todos", modulo: "agenda", nivel: "artista", label: "Editar qualquer evento", existe: true },
  { chave: "agenda.excluir", modulo: "agenda", nivel: "artista", label: "Excluir eventos criados por ele", existe: true },
  { chave: "agenda.excluir_todos", modulo: "agenda", nivel: "artista", label: "Excluir qualquer evento", existe: true },

  // ---------------- VENDAS (por artista) ----------------
  { chave: "vendas.ver", modulo: "vendas", nivel: "artista", label: "Visualizar vendas e orçamentos", existe: true },
  { chave: "vendas.criar_orcamento", modulo: "vendas", nivel: "artista", label: "Criar orçamento", existe: true },
  { chave: "vendas.editar_orcamento", modulo: "vendas", nivel: "artista", label: "Editar orçamento", existe: true },
  { chave: "vendas.excluir_orcamento", modulo: "vendas", nivel: "artista", label: "Excluir orçamento", existe: true },
  { chave: "vendas.converter", modulo: "vendas", nivel: "artista", label: "Converter orçamento em venda", existe: true },
  { chave: "vendas.criar_venda", modulo: "vendas", nivel: "artista", label: "Criar venda", existe: true },
  { chave: "vendas.editar_venda", modulo: "vendas", nivel: "artista", label: "Editar venda", existe: true },
  { chave: "vendas.cancelar_venda", modulo: "vendas", nivel: "artista", label: "Cancelar venda", existe: false },
  { chave: "vendas.excluir_venda", modulo: "vendas", nivel: "artista", label: "Excluir venda", existe: true },
  { chave: "vendas.editar_todos", modulo: "vendas", nivel: "artista", label: "Editar todas as vendas do artista (não só as suas)", existe: true },

  // ---------------- FINANCEIRO (por artista) ----------------
  // Hoje o app controla parcelas/pagamentos das vendas. Receita/despesa/
  // comissão/aprovação ainda não existem como operação → slots (existe:false).
  { chave: "financeiro.ver", modulo: "financeiro", nivel: "artista", label: "Ver financeiro", existe: true },
  { chave: "financeiro.ver_caches", modulo: "financeiro", nivel: "artista", label: "Ver cachês", existe: true },
  { chave: "financeiro.ver_pagamentos", modulo: "financeiro", nivel: "artista", label: "Ver pagamentos", existe: true },
  { chave: "financeiro.ver_saldo", modulo: "financeiro", nivel: "artista", label: "Ver saldo", existe: false },
  { chave: "financeiro.ver_despesas", modulo: "financeiro", nivel: "artista", label: "Ver despesas", existe: false },
  { chave: "financeiro.ver_comissoes", modulo: "financeiro", nivel: "artista", label: "Ver comissões", existe: false },
  { chave: "financeiro.registrar_pagamento", modulo: "financeiro", nivel: "artista", label: "Registrar pagamento", existe: true },
  { chave: "financeiro.editar_pagamento", modulo: "financeiro", nivel: "artista", label: "Editar pagamento", existe: true },
  { chave: "financeiro.cancelar_pagamento", modulo: "financeiro", nivel: "artista", label: "Cancelar/desfazer pagamento", existe: true },
  { chave: "financeiro.registrar_recebimento", modulo: "financeiro", nivel: "artista", label: "Registrar recebimento", existe: false },
  { chave: "financeiro.criar_receita", modulo: "financeiro", nivel: "artista", label: "Criar receita", existe: false },
  { chave: "financeiro.criar_despesa", modulo: "financeiro", nivel: "artista", label: "Criar despesa", existe: false },
  { chave: "financeiro.editar_receita", modulo: "financeiro", nivel: "artista", label: "Editar receita", existe: false },
  { chave: "financeiro.editar_despesa", modulo: "financeiro", nivel: "artista", label: "Editar despesa", existe: false },
  { chave: "financeiro.excluir_lancamento", modulo: "financeiro", nivel: "artista", label: "Excluir lançamento", existe: false },
  { chave: "financeiro.aprovar_pagamento", modulo: "financeiro", nivel: "artista", label: "Aprovar pagamento", existe: false },
  { chave: "financeiro.aprovar_recebimento", modulo: "financeiro", nivel: "artista", label: "Aprovar recebimento", existe: false },

  // ---------------- CONTRATOS (por artista) — sem "assinar" ----------------
  // Assinar é feito pelo contratante via link gerado (fluxo /assinar/[token]),
  // não é ação de membro da equipe.
  { chave: "contratos.ver", modulo: "contratos", nivel: "artista", label: "Visualizar contratos", existe: true },
  { chave: "contratos.criar", modulo: "contratos", nivel: "artista", label: "Criar contrato", existe: true },
  { chave: "contratos.editar", modulo: "contratos", nivel: "artista", label: "Editar contrato", existe: true },
  { chave: "contratos.cancelar", modulo: "contratos", nivel: "artista", label: "Cancelar contrato", existe: false },
  { chave: "contratos.excluir", modulo: "contratos", nivel: "artista", label: "Excluir contrato", existe: true },
  { chave: "contratos.editar_todos", modulo: "contratos", nivel: "artista", label: "Editar todos os contratos do artista", existe: true },

  // ---------------- CONTATOS (por artista) ----------------
  // Escopo emergente: o usuário só alcança contatos dos artistas a que tem vínculo.
  { chave: "contatos.ver", modulo: "contatos", nivel: "artista", label: "Visualizar contatos", existe: true },
  { chave: "contatos.criar", modulo: "contatos", nivel: "artista", label: "Criar contato", existe: true },
  { chave: "contatos.editar", modulo: "contatos", nivel: "artista", label: "Editar contato", existe: true },
  { chave: "contatos.excluir", modulo: "contatos", nivel: "artista", label: "Excluir contato", existe: true },
  { chave: "contatos.exportar", modulo: "contatos", nivel: "artista", label: "Exportar contatos", existe: false },

  // ---------------- AGÊNCIA (workspace — administrativo, não por-artista) ----------------
  { chave: "agencia.criar_artista", modulo: "agencia", nivel: "workspace", label: "Criar artista", existe: true },
  { chave: "agencia.editar_artista", modulo: "agencia", nivel: "workspace", label: "Editar artista", existe: true },
  { chave: "agencia.excluir_artista", modulo: "agencia", nivel: "workspace", label: "Excluir artista", existe: true },
  { chave: "agencia.criar_usuario", modulo: "agencia", nivel: "workspace", label: "Criar usuários", existe: true },
  { chave: "agencia.editar_usuario", modulo: "agencia", nivel: "workspace", label: "Editar usuários", existe: true },
  { chave: "agencia.excluir_usuario", modulo: "agencia", nivel: "workspace", label: "Excluir usuários", existe: true },
  { chave: "agencia.alterar_permissoes", modulo: "agencia", nivel: "workspace", label: "Alterar permissões", existe: true },
  { chave: "agencia.criar_perfil", modulo: "agencia", nivel: "workspace", label: "Criar perfis", existe: false },
  { chave: "agencia.editar_perfil", modulo: "agencia", nivel: "workspace", label: "Editar perfis", existe: false },
  { chave: "agencia.config_agencia", modulo: "agencia", nivel: "workspace", label: "Configurações da agência", existe: true },
];

/** Set de todas as chaves válidas (validação rápida). */
export const CHAVES_VALIDAS: ReadonlySet<string> = new Set(CATALOGO.map((p) => p.chave));

/** Permissões de um módulo. */
export function permsDoModulo(modulo: ModuloPermissao): Permissao[] {
  return CATALOGO.filter((p) => p.modulo === modulo);
}

/** Só as permissões por-artista (as que vão no vínculo membros_artista). */
export const CHAVES_ARTISTA: string[] = CATALOGO.filter((p) => p.nivel === "artista").map((p) => p.chave);

/** Só as permissões de workspace (administrativas). */
export const CHAVES_WORKSPACE: string[] = CATALOGO.filter((p) => p.nivel === "workspace").map((p) => p.chave);

/** true se a chave existe e é enforçável hoje. */
export function chaveExiste(chave: string): boolean {
  return CATALOGO.some((p) => p.chave === chave && p.existe);
}
