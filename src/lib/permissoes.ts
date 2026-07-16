import type { PlanoId } from "./planos";

/**
 * Papéis de usuário no GIGS CONTROL.
 *
 * - admin: dono da conta. Vê tudo, gerencia usuários, plano e permissões.
 * - artista: vê apenas os próprios dados. NUNCA vê outro artista (trava de sistema).
 * - vendedor: trabalha com orçamentos e vendas. Escopo configurável pelo admin.
 * - produtor: cuida da logística e agenda dos shows.
 * - financeiro: vê pagamentos e faturamento.
 */
export type Papel = "admin" | "artista" | "vendedor" | "produtor" | "financeiro";

export const LABELS_PAPEL: Record<Papel, { nome: string; descricao: string; cor: string }> = {
  admin: {
    nome: "Admin",
    descricao: "Dono da conta — acesso total, gerencia equipe e permissões",
    cor: "#f59e0b",
  },
  artista: {
    nome: "Artista",
    descricao: "DJ / cantor / MC — vê apenas os próprios dados",
    cor: "#a855f7",
  },
  vendedor: {
    nome: "Vendedor",
    descricao: "Cria orçamentos e fecha vendas",
    cor: "#3b82f6",
  },
  produtor: {
    nome: "Produtor",
    descricao: "Cuida da logística e produção dos shows",
    cor: "#22c55e",
  },
  financeiro: {
    nome: "Financeiro",
    descricao: "Controla pagamentos e faturamento",
    cor: "#ef4444",
  },
};

/**
 * Escopo de acesso de um vendedor — definido pelo admin.
 */
export type EscopoVendedor = {
  /** "todos" = vê todos os contratantes | "proprios" = só os que ele criou */
  contratantes: "todos" | "proprios";
  /** "todos" = pode vender qualquer artista | "selecionados" = só artistas atribuídos */
  artistas: "todos" | "selecionados";
  /** IDs (uuid) de artistas atribuídos (usado quando artistas === "selecionados") */
  artistasPermitidos: string[];
};

export const ESCOPO_VENDEDOR_PADRAO: EscopoVendedor = {
  contratantes: "proprios",
  artistas: "selecionados",
  artistasPermitidos: [],
};

/**
 * Privacidade do DJ — o que cada artista pode VER e FAZER no próprio
 * espaço. Configurado pelo admin por artista, salvo em
 * `artists.privacidade` (jsonb).
 *
 * NOTA: Fase 1 é só persistência/configuração. O ENFORCEMENT efetivo
 * (calcularPermissoes + APIs) é tratado numa fase posterior.
 */
export type PrivacidadeDj = {
  /** Vê os orçamentos dele. */
  orcamentosVer: boolean;
  /** Pode criar orçamento. */
  orcamentosCriar: boolean;
  /** Vê o histórico de vendas dele. */
  vendasVer: boolean;
  /** Pode fechar/criar venda. */
  vendasCriar: boolean;
  /** Vê o financeiro dele (cachês, pagamentos e a taxa/líquido). */
  financeiroVer: boolean;
  /** Pode informar pagamento. */
  financeiroInformar: boolean;
  /** Vê os contratos dele. */
  contratosVer: boolean;
  /** Pode gerar contrato. */
  contratosCriar: boolean;
  /** Acesso total à própria agenda — cria/edita/exclui os próprios eventos; false = só leitura. */
  agendaTotal: boolean;
  /**
   * Vê a agenda DETALHADA (cachê, contato do contratante, hotel/booking,
   * voucher, riders). false = nível "Básico" (só dia, local e horário).
   * Ausente no jsonb (artista antigo) ⇒ mapper deriva true (retrocompat).
   */
  agendaVerDetalhado: boolean;
  /** nenhum = não vê contatos; proprios = só dos shows dele; todos = agência inteira. */
  contatos: "nenhum" | "proprios" | "todos";
};

export const PRIVACIDADE_DJ_PADRAO: PrivacidadeDj = {
  orcamentosVer: true,
  orcamentosCriar: false,
  vendasVer: true,
  vendasCriar: false,
  financeiroVer: true,
  financeiroInformar: false,
  contratosVer: true,
  contratosCriar: false,
  agendaTotal: false,
  agendaVerDetalhado: true,
  contatos: "proprios",
};

/**
 * Um usuário do workspace.
 */
export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  /** Para papel "artista": o id (uuid) do artista que este usuário representa */
  artistaId?: string;
  /**
   * Cor de IDENTIDADE (hex) do avatar/iniciais — a mesma mostrada no resto do
   * app. Artista: artists.cor. Equipe/admin: profiles.cor. Ausente → cai na
   * cor do papel.
   */
  cor?: string | null;
  /** Para papel "vendedor": configuração de escopo */
  escopoVendedor?: EscopoVendedor;
  criadoEm: string;
};

/**
 * O workspace (a "conta" / tenant). Cada assinatura é um workspace.
 */
export type Workspace = {
  id: string;
  nome: string;
  plano: PlanoId;
  /** Slug único da agência — usado pra montar username de artistas. */
  slug: string;
  criadoEm: string;
};

/**
 * Permissões efetivas calculadas para o usuário logado.
 * É isto que a UI consulta para mostrar/esconder/filtrar.
 */
export type Permissoes = {
  // Módulos visíveis
  podeVerAgenda: boolean;
  podeVerVendas: boolean;
  podeVerFinanceiro: boolean;
  podeVerContatos: boolean;
  // Ações
  podeGerenciarUsuarios: boolean;
  podeConfigurarPermissoes: boolean;
  podeGerenciarPlano: boolean;
  podeCriarOrcamento: boolean;
  podeCriarVenda: boolean;
  podeEditarShows: boolean;
  podeInformarPagamento: boolean;
  // Escopo de dados
  /** Se true, vê dados de todos os artistas. Se false, ver `artistasVisiveis`. */
  veTodosArtistas: boolean;
  /** Lista de IDs (uuid) de artistas que o usuário pode ver (quando veTodosArtistas=false) */
  artistasVisiveis: string[];
  /** Se true, vê todos os contratantes; se false, só os próprios */
  veTodosContratantes: boolean;
};

/**
 * Calcula as permissões efetivas a partir do papel + escopo.
 *
 * @param papel papel do usuário
 * @param opts dados auxiliares (artista representado, escopo de vendedor, lista de todos os artistas)
 */
export function calcularPermissoes(
  papel: Papel,
  opts: {
    artistaId?: string;
    escopoVendedor?: EscopoVendedor;
    todosArtistasIds: string[];
  }
): Permissoes {
  switch (papel) {
    case "admin":
      return {
        podeVerAgenda: true,
        podeVerVendas: true,
        podeVerFinanceiro: true,
        podeVerContatos: true,
        podeGerenciarUsuarios: true,
        podeConfigurarPermissoes: true,
        podeGerenciarPlano: true,
        podeCriarOrcamento: true,
        podeCriarVenda: true,
        podeEditarShows: true,
        podeInformarPagamento: true,
        veTodosArtistas: true,
        artistasVisiveis: opts.todosArtistasIds,
        veTodosContratantes: true,
      };

    case "artista":
      // Artista vê SÓ a si mesmo. Trava de sistema — nunca configurável.
      return {
        podeVerAgenda: true,
        podeVerVendas: true, // só os próprios orçamentos/vendas
        podeVerFinanceiro: true, // só o próprio financeiro
        podeVerContatos: false,
        podeGerenciarUsuarios: false,
        podeConfigurarPermissoes: false,
        podeGerenciarPlano: false,
        podeCriarOrcamento: false,
        podeCriarVenda: false,
        podeEditarShows: false,
        podeInformarPagamento: false,
        veTodosArtistas: false,
        artistasVisiveis: opts.artistaId !== undefined ? [opts.artistaId] : [],
        veTodosContratantes: false,
      };

    case "vendedor": {
      const esc = opts.escopoVendedor ?? ESCOPO_VENDEDOR_PADRAO;
      return {
        podeVerAgenda: true,
        podeVerVendas: true,
        podeVerFinanceiro: false,
        podeVerContatos: true,
        podeGerenciarUsuarios: false,
        podeConfigurarPermissoes: false,
        podeGerenciarPlano: false,
        podeCriarOrcamento: true,
        podeCriarVenda: true,
        podeEditarShows: false,
        podeInformarPagamento: false,
        veTodosArtistas: esc.artistas === "todos",
        artistasVisiveis:
          esc.artistas === "todos" ? opts.todosArtistasIds : esc.artistasPermitidos,
        veTodosContratantes: esc.contratantes === "todos",
      };
    }

    case "produtor":
      return {
        podeVerAgenda: true,
        podeVerVendas: false,
        podeVerFinanceiro: false,
        podeVerContatos: true,
        podeGerenciarUsuarios: false,
        podeConfigurarPermissoes: false,
        podeGerenciarPlano: false,
        podeCriarOrcamento: false,
        podeCriarVenda: false,
        podeEditarShows: true,
        podeInformarPagamento: false,
        veTodosArtistas: true,
        artistasVisiveis: opts.todosArtistasIds,
        veTodosContratantes: true,
      };

    case "financeiro":
      return {
        podeVerAgenda: true,
        podeVerVendas: true,
        podeVerFinanceiro: true,
        podeVerContatos: true,
        podeGerenciarUsuarios: false,
        podeConfigurarPermissoes: false,
        podeGerenciarPlano: false,
        podeCriarOrcamento: false,
        podeCriarVenda: false,
        podeEditarShows: false,
        podeInformarPagamento: true,
        veTodosArtistas: true,
        artistasVisiveis: opts.todosArtistasIds,
        veTodosContratantes: true,
      };

    default:
      // fallback restritivo
      return {
        podeVerAgenda: false,
        podeVerVendas: false,
        podeVerFinanceiro: false,
        podeVerContatos: false,
        podeGerenciarUsuarios: false,
        podeConfigurarPermissoes: false,
        podeGerenciarPlano: false,
        podeCriarOrcamento: false,
        podeCriarVenda: false,
        podeEditarShows: false,
        podeInformarPagamento: false,
        veTodosArtistas: false,
        artistasVisiveis: [],
        veTodosContratantes: false,
      };
  }
}
