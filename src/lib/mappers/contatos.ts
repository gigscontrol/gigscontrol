import type { Contratante, Casa, Cidade, TipoCasa } from "@/types";
import { ufParaRegiao } from "@/lib/data/cidades-br";

// ============================================================
// Cidades
// ============================================================

export type CidadeRow = {
  id: string;
  workspace_id: string;
  nome: string;
  estado: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  ibge_id: string | null;
  pais: string | null;
  geoname_id: string | null;
};

function paraNumero(v: number | string | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : undefined;
}

export function rowParaCidade(row: CidadeRow): Cidade {
  const c: Cidade = {
    id: row.id,
    nome: row.nome,
    estado: row.estado ?? "",
    regiao: ufParaRegiao(row.estado),
  };
  const lat = paraNumero(row.latitude);
  const lng = paraNumero(row.longitude);
  if (lat !== undefined) c.latitude = lat;
  if (lng !== undefined) c.longitude = lng;
  if (row.ibge_id) c.ibgeId = row.ibge_id;
  c.pais = row.pais ?? "BR";
  if (row.geoname_id) c.geonameId = row.geoname_id;
  return c;
}

export type CidadeEscrita = {
  workspace_id?: string;
  nome?: string;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ibge_id?: string | null;
  pais?: string | null;
  geoname_id?: string | null;
};

// ============================================================
// Casas
// ============================================================

const TIPOS_CASA: TipoCasa[] = [
  "club",
  "festival",
  "festa-privada",
  "bar",
  "arena",
  "outro",
];

function tipoCasaValido(t: string | null | undefined): TipoCasa {
  if (t && (TIPOS_CASA as string[]).includes(t)) return t as TipoCasa;
  return "outro";
}

export type CasaRow = {
  id: string;
  workspace_id: string;
  nome: string;
  tipo: string | null;
  cidade_id: string | null;
  capacidade: number | null;
  endereco: string | null;
  contato_responsavel: string | null;
  telefone: string | null;
};

export function rowParaCasa(row: CasaRow): Casa {
  return {
    id: row.id,
    nome: row.nome,
    tipo: tipoCasaValido(row.tipo),
    cidadeId: row.cidade_id ?? "",
    capacidade: row.capacidade ?? undefined,
    endereco: row.endereco ?? undefined,
    contatoResponsavel: row.contato_responsavel ?? undefined,
    telefone: row.telefone ?? undefined,
  };
}

export type CasaEscrita = {
  workspace_id?: string;
  nome?: string;
  tipo?: TipoCasa;
  cidade_id?: string | null;
  capacidade?: number | null;
  endereco?: string | null;
  contato_responsavel?: string | null;
  telefone?: string | null;
};

// ============================================================
// Contratantes
// ============================================================

export type ContratanteRow = {
  id: string;
  workspace_id: string;
  nome: string;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade_id: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string | null;
};

export function rowParaContratante(row: ContratanteRow): Contratante {
  return {
    id: row.id,
    nome: row.nome,
    documento: row.documento ?? undefined,
    email: row.email ?? undefined,
    telefone: row.telefone ?? "",
    endereco: row.endereco ?? undefined,
    cidadeId: row.cidade_id ?? "",
    observacoes: row.observacoes ?? undefined,
    criadoEm: row.criado_em ?? "",
  };
}

export type ContratanteEscrita = {
  workspace_id?: string;
  nome?: string;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade_id?: string | null;
  observacoes?: string | null;
  criado_por?: string | null;
};
