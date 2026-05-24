export type DJ = {
  id: string;
  name: string;
  color: string;
  /** Quando true, o artista aparece em cinza e não pode criar/editar nada. */
  acessoSuspenso?: boolean;
};

export type ShowStatus = "confirmado" | "pendente" | "logistica";

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

export type DateRange = "Mês atual" | "Mês passado" | "Ano" | "Personalizado";
export type AgendaDateRange = "Mês anterior" | "Mês atual" | "Próximo mês" | "Personalizado";

export type ActiveTab = "agenda" | "vendas" | "financeiro" | "contatos";
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
  | "contatos-lista";

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

  // gestão
  validade?: string;
  observacoes?: string;
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

  observacoes?: string;
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
  agenda: { key: "agenda", label: "Agenda", color: "var(--module-agenda)" },
  vendas: { key: "vendas", label: "Vendas", color: "var(--module-vendas)" },
  financeiro: { key: "financeiro", label: "Financeiro", color: "var(--module-financeiro)" },
  contatos: { key: "contatos", label: "Contatos", color: "var(--module-contatos)" },
};
