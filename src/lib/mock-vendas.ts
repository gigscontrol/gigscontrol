import type { Venda } from "@/types";

/**
 * 4 vendas de demonstração, uma para cada show da agenda (um por DJ).
 * Servem para o modal de detalhes do show exibir todas as seções
 * preenchidas: contratante, local, line-up, camarim, efeitos, hotel,
 * logística e observações.
 */
export const MOCK_VENDAS: Venda[] = [
  // ---------- CZ — Club Laroc ----------
  {
    id: "mock-venda-1",
    numero: "VND-0001",
    orcamentoId: undefined,
    showId: "mock-show-1",

    contratanteId: "mock-contratante-1",
    contratanteNome: "Marcos Lima",
    contratanteEmail: "marcos@laroc.com.br",
    contratanteTelefone: "5511999990001",
    contratanteDocumento: "123.456.789-00",
    contratanteEndereco: "Rua Augusta, 1500 — Consolação, São Paulo/SP — CEP 01304-001",

    nomeEvento: "Laroc Sunset — Edição Aniversário",
    eventoInstagram: "@larocclub",
    nomeLocal: "Club Laroc",
    capacidadePublico: 1200,
    enderecoLocal: "Rua Augusta, 1500 — Consolação, São Paulo/SP",
    dataShow: "2026-05-21",
    horario: "23:30",
    horarioFim: "01:30",
    cidadeId: "mock-cidade-1",
    casaId: "mock-casa-1",

    djId: "1",
    lineUp: ["Vintage Culture", "Cat Dealers"],
    cache: 18000,
    duracaoHoras: 2,
    duracaoMinutos: 0,
    camarim: [
      { nome: "Jack Daniels", qtd: 2 },
      { nome: "Red Label", qtd: 1 },
      { nome: "Coca Cola Lata", qtd: 12 },
      { nome: "Coca Cola Zero Lata", qtd: 6 },
      { nome: "Energéticos Redbull Lata", qtd: 24 },
      { nome: "Garrafa de Água", qtd: 12 },
    ],
    efeitos: [
      { nome: "Máquinas de CO²", qtd: 2 },
      { nome: "Cilindro(s) de 45KG de CO²", qtd: 2 },
      { nome: "Momentos de Papel Picado", qtd: 3 },
      { nome: "Momentos de Silver Jet", qtd: 2 },
    ],
    hotel: [
      { nome: "Quarto Single", qtd: 1 },
      { nome: "Quarto Duplo", qtd: 2 },
    ],
    logistica: { aereaQtd: 3, transladoTerrestre: true },
    parcelas: [
      { id: "p1-1", percentual: 30, valor: 5400, dataVencimento: "2026-04-15", statusBase: "pago", dataPagamento: "2026-04-14" },
      { id: "p1-2", percentual: 40, valor: 7200, dataVencimento: "2026-05-12", statusBase: "pendente" },
      { id: "p1-3", percentual: 30, valor: 5400, dataVencimento: "2026-06-05", statusBase: "pendente" },
    ],
    observacoes:
      "Cliente recorrente. Passagens em classe executiva. Confirmar rider técnico 5 dias antes.",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  },

  // ---------- Dudu — Privilège ----------
  {
    id: "mock-venda-2",
    numero: "VND-0002",
    orcamentoId: undefined,
    showId: "mock-show-2",

    contratanteId: "mock-contratante-3",
    contratanteNome: "Fernando Costa",
    contratanteEmail: "fernando@privilege.rj",
    contratanteTelefone: "5521999990003",
    contratanteDocumento: "12.345.678/0001-90",
    contratanteEndereco: "Av. Niemeyer, 121 — Leblon, Rio de Janeiro/RJ — CEP 22450-220",

    nomeEvento: "Privilège Beach Party",
    eventoInstagram: "@privilegerj",
    nomeLocal: "Privilège",
    capacidadePublico: 1500,
    enderecoLocal: "Av. Niemeyer, 121 — Leblon, Rio de Janeiro/RJ",
    dataShow: "2026-05-22",
    horario: "01:00",
    horarioFim: "03:00",
    cidadeId: "mock-cidade-2",
    casaId: "mock-casa-3",

    djId: "2",
    lineUp: ["Dennis DJ"],
    cache: 22000,
    duracaoHoras: 2,
    duracaoMinutos: 0,
    camarim: [
      { nome: "Jack Daniels", qtd: 1 },
      { nome: "Coca Cola Lata", qtd: 10 },
      { nome: "Energéticos Redbull Lata", qtd: 18 },
      { nome: "Garrafa de Água", qtd: 10 },
    ],
    efeitos: [
      { nome: "Máquinas de CO²", qtd: 2 },
      { nome: "Cilindro(s) de 25KG de CO²", qtd: 2 },
      { nome: "Momentos de Micro Mine", qtd: 2 },
    ],
    hotel: [{ nome: "Quarto Duplo", qtd: 1 }],
    logistica: { aereaQtd: 2, transladoTerrestre: true },
    parcelas: [
      { id: "p2-1", percentual: 100, valor: 22000, dataVencimento: "2026-05-22", statusBase: "pendente" },
    ],
    observacoes: "Som e iluminação por conta da casa. Camarim climatizado.",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  },

  // ---------- Maninho — P12 ----------
  {
    id: "mock-venda-3",
    numero: "VND-0003",
    orcamentoId: undefined,
    showId: "mock-show-3",

    contratanteId: "mock-contratante-6",
    contratanteNome: "Bruna Lopes",
    contratanteEmail: "bruna@p12.com.br",
    contratanteTelefone: "5548999990008",
    contratanteDocumento: "98.765.432/0001-10",
    contratanteEndereco:
      "Av. dos Búzios, 1750 — Jurerê Internacional, Florianópolis/SC — CEP 88053-700",

    nomeEvento: "P12 Summer Closing",
    eventoInstagram: "@p12floripa",
    nomeLocal: "P12",
    capacidadePublico: 2000,
    enderecoLocal: "Av. dos Búzios, 1750 — Jurerê Internacional, Florianópolis/SC",
    dataShow: "2026-05-23",
    horario: "22:30",
    horarioFim: "01:00",
    cidadeId: "mock-cidade-5",
    casaId: "mock-casa-8",

    djId: "3",
    lineUp: ["Liu", "Chemical Surf"],
    cache: 25000,
    duracaoHoras: 2,
    duracaoMinutos: 30,
    camarim: [
      { nome: "Jack Daniels", qtd: 2 },
      { nome: "Red Label", qtd: 2 },
      { nome: "Coca Cola Lata", qtd: 12 },
      { nome: "Coca Cola Zero Lata", qtd: 12 },
      { nome: "Energéticos Redbull Lata", qtd: 24 },
      { nome: "Garrafa de Água", qtd: 18 },
    ],
    efeitos: [
      { nome: "Máquinas de CO²", qtd: 4 },
      { nome: "Cilindro(s) de 45KG de CO²", qtd: 4 },
      { nome: "Momentos de Papel Picado", qtd: 4 },
      { nome: "Momentos de Silver Jet", qtd: 3 },
      { nome: "Fire Machine", qtd: 2 },
    ],
    hotel: [
      { nome: "Quarto Single", qtd: 2 },
      { nome: "Quarto Duplo", qtd: 2 },
      { nome: "Quarto Triplo", qtd: 1 },
    ],
    logistica: { aereaQtd: 4, transladoTerrestre: true },
    parcelas: [
      { id: "p3-1", percentual: 25, valor: 6250, dataVencimento: "2026-03-20", statusBase: "pago", dataPagamento: "2026-03-18" },
      { id: "p3-2", percentual: 25, valor: 6250, dataVencimento: "2026-05-05", statusBase: "pago", dataPagamento: "2026-05-06" },
      { id: "p3-3", percentual: 25, valor: 6250, dataVencimento: "2026-05-15", statusBase: "pendente" },
      { id: "p3-4", percentual: 25, valor: 6250, dataVencimento: "2026-06-10", statusBase: "pendente" },
    ],
    observacoes:
      "Evento de encerramento de temporada. Line-up estendido. Hospedagem em resort próximo.",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  },

  // ---------- Blackdrumm — Ame Club ----------
  {
    id: "mock-venda-4",
    numero: "VND-0004",
    orcamentoId: undefined,
    showId: "mock-show-4",

    contratanteId: "mock-contratante-4",
    contratanteNome: "Júlia Mendes",
    contratanteEmail: "julia@ameclub.com",
    contratanteTelefone: "5531999990004",
    contratanteDocumento: "456.789.123-00",
    contratanteEndereco: "Rua Pernambuco, 1000 — Savassi, Belo Horizonte/MG — CEP 30130-151",

    nomeEvento: "Ame Club — Noite Techno",
    eventoInstagram: "@ameclubbh",
    nomeLocal: "Ame Club",
    capacidadePublico: 600,
    enderecoLocal: "Rua Pernambuco, 1000 — Savassi, Belo Horizonte/MG",
    dataShow: "2026-05-24",
    horario: "21:00",
    horarioFim: "23:30",
    cidadeId: "mock-cidade-3",
    casaId: "mock-casa-4",

    djId: "4",
    lineUp: [],
    cache: 14000,
    duracaoHoras: 2,
    duracaoMinutos: 30,
    camarim: [
      { nome: "Red Label", qtd: 1 },
      { nome: "Coca Cola Lata", qtd: 8 },
      { nome: "Energéticos Redbull Lata", qtd: 12 },
      { nome: "Garrafa de Água", qtd: 8 },
    ],
    efeitos: [
      { nome: "Máquinas de CO²", qtd: 2 },
      { nome: "Cilindro(s) de 25KG de CO²", qtd: 2 },
    ],
    hotel: [{ nome: "Quarto Single", qtd: 1 }],
    logistica: { aereaQtd: 1, transladoTerrestre: false },
    parcelas: [
      { id: "p4-1", percentual: 50, valor: 7000, dataVencimento: "2026-05-08", statusBase: "pendente" },
      { id: "p4-2", percentual: 50, valor: 7000, dataVencimento: "2026-05-24", statusBase: "pendente" },
    ],
    observacoes: "Show intimista. Set techno. Sem necessidade de translado terrestre.",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  },
];
