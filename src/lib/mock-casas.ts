import type { Casa } from "@/types";

/**
 * Mock de casas — mantido como referência histórica.
 * O contatos-context atual carrega dados reais via /api/contatos/casas.
 */
export const MOCK_CASAS: Casa[] = [
  { id: "mock-casa-1", nome: "Club Laroc",          tipo: "club",          cidadeId: "mock-cidade-1", capacidade: 1200, endereco: "Rua Augusta, 1500",                                              contatoResponsavel: "Marcos Lima",         telefone: "(11) 99999-0001" },
  { id: "mock-casa-2", nome: "D-Edge",              tipo: "club",          cidadeId: "mock-cidade-1", capacidade: 800,  endereco: "Alameda Olga, 170",                                              contatoResponsavel: "Renata Souza",        telefone: "(11) 99999-0002" },
  { id: "mock-casa-3", nome: "Privilège",           tipo: "club",          cidadeId: "mock-cidade-2", capacidade: 1500, endereco: "Av. Niemeyer, 121",                                              contatoResponsavel: "Fernando Costa",      telefone: "(21) 99999-0003" },
  { id: "mock-casa-4", nome: "Ame Club",            tipo: "club",          cidadeId: "mock-cidade-3", capacidade: 600,  endereco: "Rua Pernambuco, 1000",                                           contatoResponsavel: "Júlia Mendes",        telefone: "(31) 99999-0004" },
  { id: "mock-casa-5", nome: "Gate 22",             tipo: "club",          cidadeId: "mock-cidade-7", capacidade: 400,  endereco: "Av. John Boyd Dunlop, 1200 — Campinas/SP",                       contatoResponsavel: "Pedro Alves",         telefone: "(19) 99999-0005" },
  { id: "mock-casa-6", nome: "Vibe",                tipo: "bar",           cidadeId: "mock-cidade-4", capacidade: 300,  endereco: "Rua das Carmelitas, 450 — Curitiba/PR",                          contatoResponsavel: "Ana Carolina",        telefone: "(41) 99999-0006" },
  { id: "mock-casa-7", nome: "Workroom",            tipo: "club",          cidadeId: "mock-cidade-6", capacidade: 700,  endereco: "Av. Loureiro da Silva, 1500 — Porto Alegre/RS",                  contatoResponsavel: "Lucas Faria",         telefone: "(51) 99999-0007" },
  { id: "mock-casa-8", nome: "P12",                 tipo: "festa-privada", cidadeId: "mock-cidade-5", capacidade: 2000, endereco: "Av. dos Búzios, 1750 — Jurerê Internacional, Florianópolis/SC",  contatoResponsavel: "Bruna Lopes",         telefone: "(48) 99999-0008" },
  { id: "mock-casa-9", nome: "Tomorrowland Brasil", tipo: "festival",      cidadeId: "mock-cidade-1", capacidade: 50000, endereco: "Parque Maeda — Itu/SP",                                          contatoResponsavel: "Diretoria Comercial", telefone: "(11) 99999-0009" },
];
