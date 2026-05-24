import type { Cidade } from "@/types";

/**
 * Mock de cidades — mantido como referência histórica.
 * O contatos-context atual carrega dados reais via /api/contatos/cidades.
 * IDs são strings (uuid placeholder) só para o tipo `Cidade` (uuid) compilar.
 */
export const MOCK_CIDADES: Cidade[] = [
  { id: "mock-cidade-1",  nome: "São Paulo",      estado: "SP", regiao: "Sudeste" },
  { id: "mock-cidade-2",  nome: "Rio de Janeiro", estado: "RJ", regiao: "Sudeste" },
  { id: "mock-cidade-3",  nome: "Belo Horizonte", estado: "MG", regiao: "Sudeste" },
  { id: "mock-cidade-4",  nome: "Curitiba",       estado: "PR", regiao: "Sul" },
  { id: "mock-cidade-5",  nome: "Florianópolis",  estado: "SC", regiao: "Sul" },
  { id: "mock-cidade-6",  nome: "Porto Alegre",   estado: "RS", regiao: "Sul" },
  { id: "mock-cidade-7",  nome: "Campinas",       estado: "SP", regiao: "Sudeste" },
  { id: "mock-cidade-8",  nome: "Salvador",       estado: "BA", regiao: "Nordeste" },
  { id: "mock-cidade-9",  nome: "Recife",         estado: "PE", regiao: "Nordeste" },
  { id: "mock-cidade-10", nome: "Goiânia",        estado: "GO", regiao: "Centro-Oeste" },
];
