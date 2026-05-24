import type { Contratante } from "@/types";

/**
 * Mock de contratantes — mantido como referência histórica.
 * O contatos-context atual carrega dados reais via /api/contatos/contratantes.
 */
export const MOCK_CONTRATANTES: Contratante[] = [
  {
    id: "mock-contratante-1",
    nome: "Marcos Lima",
    documento: "123.456.789-00",
    email: "marcos@laroc.com.br",
    telefone: "(11) 99999-0001",
    endereco: "Rua Augusta, 1500 — Consolação, São Paulo/SP — CEP 01304-001",
    cidadeId: "mock-cidade-1",
    observacoes: "Contato direto do Club Laroc. Prefere fechamento via WhatsApp.",
    criadoEm: "2024-08-15",
  },
  {
    id: "mock-contratante-2",
    nome: "Renata Souza",
    documento: "987.654.321-00",
    email: "renata@dedge.com.br",
    telefone: "(11) 99999-0002",
    endereco: "Alameda Olga, 170 — Barra Funda, São Paulo/SP — CEP 01155-040",
    cidadeId: "mock-cidade-1",
    criadoEm: "2024-09-22",
  },
  {
    id: "mock-contratante-3",
    nome: "Fernando Costa",
    documento: "12.345.678/0001-90",
    email: "fernando@privilege.rj",
    telefone: "(21) 99999-0003",
    endereco: "Av. Niemeyer, 121 — Leblon, Rio de Janeiro/RJ — CEP 22450-220",
    cidadeId: "mock-cidade-2",
    observacoes: "Empresa: Privilège Eventos Ltda",
    criadoEm: "2024-06-10",
  },
  {
    id: "mock-contratante-4",
    nome: "Júlia Mendes",
    documento: "456.789.123-00",
    email: "julia@ameclub.com",
    telefone: "(31) 99999-0004",
    endereco: "Rua Pernambuco, 1000 — Savassi, Belo Horizonte/MG — CEP 30130-151",
    cidadeId: "mock-cidade-3",
    criadoEm: "2025-01-08",
  },
  {
    id: "mock-contratante-5",
    nome: "Pedro Alves",
    documento: "321.654.987-00",
    email: "pedro@gate22.com",
    telefone: "(19) 99999-0005",
    endereco: "Av. Norte-Sul, 500 — Centro, Campinas/SP — CEP 13010-001",
    cidadeId: "mock-cidade-7",
    criadoEm: "2024-11-30",
  },
  {
    id: "mock-contratante-6",
    nome: "Bruna Lopes",
    documento: "98.765.432/0001-10",
    email: "bruna@p12.com.br",
    telefone: "(48) 99999-0008",
    endereco: "Rod. Jornalista Maurício Sirotsky Sobrinho, 2000 — Jurerê, Florianópolis/SC — CEP 88053-700",
    cidadeId: "mock-cidade-5",
    observacoes: "Festas privadas. Pagamento à vista preferencial.",
    criadoEm: "2024-12-05",
  },
];
