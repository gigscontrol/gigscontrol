import type { PrivacidadeDj } from "@/lib/permissoes";

/**
 * Modos de taxa de agência (cobrança que o artista paga à agência por
 * intermediar a venda). Definido no cadastro do artista.
 *
 *  - sem-taxa:        artista não paga nada.
 *  - perc-fixa:       % do cachê, fixo no artista (admin define).
 *  - perc-variavel:   % por orçamento (vendedor/admin define a cada
 *                     novo orçamento).
 *  - valor-fixo:      R$ por show, fixo no artista (admin define).
 *  - valor-variavel:  R$ por orçamento (vendedor/admin define a cada
 *                     novo orçamento).
 */
export type TaxaAgenciaModo =
  | "sem-taxa"
  | "perc-fixa"
  | "perc-variavel"
  | "valor-fixo"
  | "valor-variavel";

export const LABELS_TAXA_MODO: Record<TaxaAgenciaModo, string> = {
  "sem-taxa": "Sem taxa",
  "perc-fixa": "(%) Porcentagem fixa",
  "perc-variavel": "(%) Porcentagem variável",
  "valor-fixo": "(R$) Valor fixo",
  "valor-variavel": "(R$) Valor variável",
};

/**
 * Limites de itens do rider salvo no artista. Definidos no produto pra
 * evitar listas absurdas que poluem o orçamento.
 */
export const LIMITE_RIDER_CAMARIM = 10;
export const LIMITE_RIDER_EFEITOS = 15;
export const LIMITE_RIDER_TECNICO = 20;

export type DocumentoTipo = "cpf" | "cnpj";

export type DJ = {
  id: string;
  name: string;
  color: string;
  /** Quando true, o artista aparece em cinza e não pode criar/editar nada. */
  acessoSuspenso?: boolean;
  // ----------- Cadastro completo (etapa 21+) -----------
  /** Username único (formato: usuario-slugDaAgencia) — usado pra login. */
  username?: string;
  /** Cidade onde reside — referência do IBGE (catálogo nacional). */
  cidadeIbgeId?: string;
  cidadeNome?: string;
  cidadeUf?: string;
  // ------- Dados do CONTRATADO (para contratos / migração 37) -------
  /** Nome civil / responsável — o `name` acima é só o nome artístico. */
  nomeLegal?: string;
  /** 'cpf' | 'cnpj' — define se mostramos razão social. */
  documentoTipo?: DocumentoTipo;
  /** Número do CPF/CNPJ (guardado já com máscara). */
  documento?: string;
  /** Razão social / nome da empresa — preenchido quando documentoTipo='cnpj'. */
  razaoSocial?: string;
  /** Endereço completo (opcional). */
  endereco?: string;
  /** Telefone de contato (opcional). */
  telefone?: string;
  /** Modo de taxa de agência. Default 'sem-taxa'. */
  taxaModo?: TaxaAgenciaModo;
  /** Em modos perc-*: percentual (ex 15 = 15%). Em modos valor-*: R$. */
  taxaValor?: number;
  /**
   * Rider salvo no artista — só os NOMES dos itens. A quantidade é
   * definida em cada orçamento (porque varia por evento).
   */
  riderCamarim?: string[];
  riderEfeitos?: string[];
  riderTecnico?: string[];
  /**
   * Privacidade do DJ — o que este artista pode ver/fazer. Configurado
   * pelo admin, persistido em artists.privacidade. Sempre vem completo
   * do mapper (merge sobre o padrão).
   */
  privacidade?: PrivacidadeDj;
};

export type ShowStatus = "confirmado" | "pendente" | "logistica" | "cancelado";

export type Show = {
  id: string;
  /** Dia do mês (1-31) — derivado de `data` para casar com a grid da agenda. */
  dayId: number;
  /** Data ISO (YYYY-MM-DD). Fonte da verdade para qualquer cálculo de data. */
  data?: string;
  djId: string;
  dj: string;
  location: string;
  venue: string;
  time: string;
  status: ShowStatus;
  contratanteId?: string;
  casaId?: string;
  cidadeId?: string;
  valor?: number;
  orcamentoId?: string;
  vendaId?: string;
};

export type AgendaItemTipo = "evento" | "voo" | "transporte";

/** Item da agenda além de show: evento personalizado, voo ou transporte. */
export type AgendaItem = {
  id: string;
  tipo: AgendaItemTipo;
  /** Título livre ("Studio", "Day Off", "Férias"). */
  titulo: string;
  /** Data ISO "YYYY-MM-DD" (dia do item — casa com a grid da agenda). */
  data: string;
  /** Fim opcional (multi-dia: Férias, voo overnight). */
  dataFim?: string;
  diaInteiro: boolean;
  horaInicio?: string;
  horaFim?: string;
  /** Artistas a quem o item pertence (vazio = geral; filtra por DJ). */
  artistIds: string[];
  observacoes?: string;
  /** Payload específico por tipo (voo/transporte na Fase 3). */
  dados?: Record<string, unknown>;
};

export type DateRange = "Mês atual" | "Mês passado" | "Ano" | "Personalizado";
export type AgendaDateRange = "Mês anterior" | "Mês atual" | "Próximo mês" | "Personalizado";

export type ActiveTab =
  | "agenda"
  | "vendas"
  | "financeiro"
  | "contratos"
  | "contatos"
  | "agencia";
export type ActivePage =
  | "dashboard"
  | "agenda-completa"
  | "vendas-novo-orcamento"
  | "vendas-historico"
  | "vendas-orcamento-detalhe"
  | "vendas-nova-venda"
  | "vendas-historico-vendas"
  | "vendas-venda-detalhe"
  | "financeiro-pagamentos"
  | "contratos-novo"
  | "contratos-modelos"
  | "contratos-historico"
  | "contatos-lista"
  | "agencia-artistas"
  | "agencia-equipe";

export type ContatoCategoria = "contratantes" | "casas" | "cidades" | "mapa";
export type UserRole = "admin" | "dj" | "vendedor" | "financeiro";

// ----------- Entidades de Contatos -----------

export type Contratante = {
  id: string;
  nome: string;
  documento?: string; // ✱ agora opcional
  email?: string; // ✱ agora opcional
  telefone: string;
  endereco?: string;
  cidadeId: string;
  observacoes?: string;
  criadoEm: string;
};

export type TipoCasa = "club" | "festival" | "festa-privada" | "bar" | "arena" | "outro";

export type Casa = {
  id: string;
  nome: string;
  tipo: TipoCasa;
  cidadeId: string;
  capacidade?: number;
  endereco?: string;
  contatoResponsavel?: string;
  telefone?: string;
  observacoes?: string;
};

export type Cidade = {
  id: string;
  nome: string;
  estado: string;
  regiao: "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
  /** Coordenadas para o Mapa de Dobras (busca por raio). */
  latitude?: number;
  longitude?: number;
  /** ID do município no catálogo do IBGE. Cidades novas (a partir da
   *  migração 22) sempre têm. Cidades legadas/manuais podem não ter. */
  ibgeId?: string;
};

// ----------- Orçamentos -----------

export type OrcamentoStatus = "pendente" | "negociacao" | "aceito" | "recusado";

/** Tipo de evento - guia a UI sobre quais campos pedir */
export type TipoEvento = "social" | "casa-noturna" | "festival";

export const LABELS_TIPO_EVENTO: Record<TipoEvento, string> = {
  social: "Social",
  "casa-noturna": "Casa Noturna",
  festival: "Festival",
};

export type ItemQuantidade = {
  nome: string;
  qtd: number;
};

/**
 * Logística — múltipla escolha. Se nada marcado, é "Já inclusa do cachê".
 */
export type LogisticaSelecao = {
  aereaQtd: number; // 0 = não usa; N = quantidade de ida-volta
  transladoTerrestre: boolean; // toggle simples
};

export const LOGISTICA_VAZIA: LogisticaSelecao = {
  aereaQtd: 0,
  transladoTerrestre: false,
};

export const TEXTO_TRANSLADO =
  "Translado Terrestre de Motorista Executivo ou Van para o artista e equipe (Aeroporto > Hotel > Evento > Hotel > Aeroporto)";

/** Infos do evento de um orçamento detalhado (todas opcionais) — pré-preenche a venda. */
export type DetalhesEvento = {
  nomeEvento?: string;
  instagram?: string;
  nomeLocal?: string;
  capacidade?: number;
  enderecoLocal?: string;
  dataShow?: string; // YYYY-MM-DD
  horarioInicio?: string; // HH:mm
  horarioFim?: string; // HH:mm
  /** Término no dia seguinte à data do evento (set que vira a madrugada). */
  terminoDiaSeguinte?: boolean;
};

export type Orcamento = {
  id: string;
  numero: string;
  status: OrcamentoStatus;
  tipoEvento: TipoEvento;

  // vínculos
  contratanteId: string;
  cidadeId: string;
  casaId?: string; // ✱ opcional - só em casa-noturna/festival quando preenchido
  djId: string;

  // show — agora opcionais (preenchidos ao converter em venda)
  dataShow?: string;
  horario?: string;
  duracaoHoras: number;
  duracaoMinutos?: number;
  valorCache: number;

  // adicionais
  camarim: ItemQuantidade[];
  efeitos: ItemQuantidade[];
  hotel: ItemQuantidade[];
  logistica: LogisticaSelecao;

  // taxa de agência (snapshot — não muda se o artista trocar o modo depois)
  taxaAgenciaValor?: number;
  taxaModoAplicado?: TaxaAgenciaModo;

  // gestão
  validade?: string;
  observacoes?: string;
  /** Texto livre opcional anexado ao fim do orçamento (WhatsApp + detalhe). */
  infoExtra?: string;
  /** Orçamento detalhado: infos do evento pra pré-preencher a venda. */
  detalhesEvento?: DetalhesEvento;
  showId?: string;
  criadoEm: string;
  atualizadoEm: string;
};

// ----------- Catálogos -----------

export const CATALOGO_CAMARIM = [
  "Jack Daniels",
  "Red Label",
  "Coca Cola Lata",
  "Coca Cola Zero Lata",
  "Energéticos Redbull Lata",
  "Garrafa de Água",
] as const;

export const CATALOGO_EFEITOS = [
  "Máquinas de CO²",
  "Cilindro(s) de 25KG de CO²",
  "Cilindro(s) de 45KG de CO²",
  "Momentos de Papel Picado",
  "Momentos de Silver Jet",
  "Momentos de Micro Mine",
  "Fire Machine",
] as const;

export const CATALOGO_TECNICO = [
  "CDJ-3000",
  "CDJ-2000NXS2",
  "DJM-900NXS2",
  "DJM-V10",
  "Pioneer XDJ-XZ",
  "Mesa de som",
  "Monitor de palco",
  "Sistema de PA",
  "Cabo XLR",
  "Mesa/suporte para equipamento",
  "Tomada 110/220v",
  "Fone de ouvido",
] as const;

export const CATALOGO_HOTEL = [
  "Quarto Single",
  "Quarto Duplo",
  "Quarto Triplo",
] as const;

export const LABELS_STATUS_ORCAMENTO: Record<OrcamentoStatus, { label: string; badge: string }> = {
  pendente: { label: "Pendente", badge: "badge-neutral" },
  negociacao: { label: "Em negociação", badge: "badge-warning" },
  aceito: { label: "Aceito", badge: "badge-success" },
  recusado: { label: "Recusado", badge: "badge-danger" },
};

// ----------- Pagamentos / Parcelas -----------

export type StatusParcela = "pendente" | "pago" | "atrasado";

/**
 * Uma parcela do pagamento de uma venda.
 * O valor é sempre armazenado em R$ (mesmo quando o usuário define por %).
 * `percentual` é guardado para exibição/edição.
 */
export type Parcela = {
  id: string; // uuid local
  percentual: number; // 0-100
  valor: number; // R$
  dataVencimento: string; // YYYY-MM-DD
  /** Status base definido manualmente. "atrasado" é derivado em tempo real. */
  statusBase: "pendente" | "pago";
  dataPagamento?: string; // YYYY-MM-DD, preenchido quando marcado pago
  observacao?: string;
};

export const LABELS_STATUS_PARCELA: Record<StatusParcela, { label: string; badge: string }> = {
  pendente: { label: "Pendente", badge: "badge-warning" },
  pago: { label: "Pago", badge: "badge-success" },
  atrasado: { label: "Atrasado", badge: "badge-danger" },
};

/**
 * Calcula o status efetivo de uma parcela (deriva "atrasado").
 */
export function statusEfetivoParcela(p: Parcela, hoje = new Date()): StatusParcela {
  if (p.statusBase === "pago") return "pago";
  const venc = new Date(p.dataVencimento + "T23:59:59");
  if (venc < hoje) return "atrasado";
  return "pendente";
}

// ----------- Vendas -----------

/**
 * Uma Venda é um show concretizado.
 * Pode vir de um orçamento (via "Transformar em Venda")
 * ou ser criada direto (Venda direta).
 *
 * Quando salva, a Venda gera/associa um Show na agenda.
 */
export type Venda = {
  id: string;
  numero: string; // "VND-0001"

  // Origem (opcional)
  orcamentoId?: string;
  showId?: string;

  // 🖋️ Contratante
  contratanteId: string;
  contratanteNome: string;
  contratanteEmail: string;
  contratanteTelefone: string;
  contratanteDocumento: string; // CPF/CNPJ
  contratanteEndereco: string;

  // 📌 Evento
  nomeEvento: string;
  eventoInstagram?: string;
  nomeLocal: string;
  capacidadePublico?: number;
  enderecoLocal: string;
  dataShow: string; // YYYY-MM-DD
  horario: string; // HH:mm — início
  horarioFim?: string; // HH:mm — fim (opcional)
  cidadeId: string;
  casaId?: string;

  // 🎵 Show
  djId: string; // artista da agência (uuid quando vier do banco)
  lineUp?: string[]; // outros artistas do evento (não obrigatório)
  cache: number;
  duracaoHoras: number;
  duracaoMinutos?: number;
  camarim: ItemQuantidade[];
  efeitos: ItemQuantidade[];
  hotel: ItemQuantidade[];
  logistica: LogisticaSelecao;

  // 💳 Pagamento
  parcelas: Parcela[];

  // taxa de agência (snapshot do orçamento de origem)
  taxaAgenciaValor?: number;
  taxaModoAplicado?: TaxaAgenciaModo;

  observacoes?: string;
  /** Texto livre opcional — copiado do orçamento ao concretizar. Editável depois. */
  infoExtra?: string;
  criadoEm: string;
  atualizadoEm: string;
};

// ----------- Tema -----------

export type ModuleTheme = {
  key: ActiveTab;
  label: string;
  color: string;
};

export const MODULE_THEMES: Record<ActiveTab, ModuleTheme> = {
  agenda: { key: "agenda", label: "Agenda", color: "#3b82f6" },
  vendas: { key: "vendas", label: "Vendas", color: "#a855f7" },
  financeiro: { key: "financeiro", label: "Financeiro", color: "#22c55e" },
  contratos: { key: "contratos", label: "Contratos", color: "#14b8a6" },
  contatos: { key: "contatos", label: "Contatos", color: "#f97316" },
  agencia: { key: "agencia", label: "Agência", color: "#6366f1" },
};
