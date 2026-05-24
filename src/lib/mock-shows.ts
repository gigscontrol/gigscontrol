import type { Show } from "@/types";

/**
 * Mock de shows — mantido apenas como referência histórica.
 * O shows-context atual carrega dados reais via /api/shows.
 *
 * Os IDs são placeholders (strings) para o tipo `Show` (uuid) compilar.
 */
export const MOCK_SHOWS: Show[] = [
  {
    id: "mock-show-1",
    dayId: 21,
    djId: "mock-dj-1",
    dj: "CZ",
    location: "São Paulo, SP",
    venue: "Club Laroc",
    time: "23:30",
    status: "confirmado",
    contratanteId: "mock-contratante-1",
    casaId: "mock-casa-1",
    cidadeId: "mock-cidade-1",
    valor: 18000,
    vendaId: "mock-venda-1",
  },
  {
    id: "mock-show-2",
    dayId: 22,
    djId: "mock-dj-2",
    dj: "Dudu",
    location: "Rio de Janeiro, RJ",
    venue: "Privilège",
    time: "01:00",
    status: "confirmado",
    contratanteId: "mock-contratante-3",
    casaId: "mock-casa-3",
    cidadeId: "mock-cidade-2",
    valor: 22000,
    vendaId: "mock-venda-2",
  },
  {
    id: "mock-show-3",
    dayId: 23,
    djId: "mock-dj-3",
    dj: "Maninho",
    location: "Florianópolis, SC",
    venue: "P12",
    time: "22:30",
    status: "confirmado",
    contratanteId: "mock-contratante-6",
    casaId: "mock-casa-8",
    cidadeId: "mock-cidade-5",
    valor: 25000,
    vendaId: "mock-venda-3",
  },
  {
    id: "mock-show-4",
    dayId: 24,
    djId: "mock-dj-4",
    dj: "Blackdrumm",
    location: "Belo Horizonte, MG",
    venue: "Ame Club",
    time: "21:00",
    status: "confirmado",
    contratanteId: "mock-contratante-4",
    casaId: "mock-casa-4",
    cidadeId: "mock-cidade-3",
    valor: 14000,
    vendaId: "mock-venda-4",
  },
];
