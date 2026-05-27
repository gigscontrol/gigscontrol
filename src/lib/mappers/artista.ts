import type { DJ, TaxaAgenciaModo } from "@/types";

export type ArtistaRow = {
  id: string;
  workspace_id: string;
  nome: string;
  cor: string | null;
  acesso_suspenso: boolean | null;
  deletado_em: string | null;
  criado_em: string | null;
  // Cadastro completo (migração 21)
  cidade_ibge_id: string | null;
  cidade_nome: string | null;
  cidade_uf: string | null;
  taxa_modo: TaxaAgenciaModo | null;
  taxa_valor: number | string | null; // numeric vem como string do PG às vezes
  rider_camarim: unknown; // jsonb — pode ser string[] ou formato legado {nome,qtdSugerida}
  rider_efeitos: unknown;
  // Username vem por JOIN com profiles na consulta (não está em artists)
  username?: string | null;
};

/**
 * Normaliza o rider para string[] (lista de nomes).
 * Aceita 2 formatos pra retrocompat:
 *  - Atual:  ["Jack Daniels", "Red Bull"]
 *  - Legado: [{nome:"Jack Daniels", qtdSugerida:1}] — pega só o nome
 */
function normalizarRider(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (typeof r === "string") return r.trim();
      if (typeof r === "object" && r !== null) {
        const nome = (r as { nome?: unknown }).nome;
        return typeof nome === "string" ? nome.trim() : "";
      }
      return "";
    })
    .filter((s) => s.length > 0);
}

export function rowParaDj(row: ArtistaRow): DJ {
  const dj: DJ = {
    id: row.id,
    name: row.nome,
    color: row.cor ?? "#3b82f6",
    acessoSuspenso: !!row.acesso_suspenso,
    taxaModo: row.taxa_modo ?? "sem-taxa",
    riderCamarim: normalizarRider(row.rider_camarim),
    riderEfeitos: normalizarRider(row.rider_efeitos),
  };
  if (row.cidade_ibge_id) dj.cidadeIbgeId = row.cidade_ibge_id;
  if (row.cidade_nome) dj.cidadeNome = row.cidade_nome;
  if (row.cidade_uf) dj.cidadeUf = row.cidade_uf;
  if (row.taxa_valor !== null && row.taxa_valor !== undefined) {
    const n = Number(row.taxa_valor);
    if (Number.isFinite(n)) dj.taxaValor = n;
  }
  if (row.username) dj.username = row.username;
  return dj;
}

export type ArtistaEscrita = {
  workspace_id?: string;
  nome?: string;
  cor?: string;
  acesso_suspenso?: boolean;
  cidade_ibge_id?: string | null;
  cidade_nome?: string | null;
  cidade_uf?: string | null;
  taxa_modo?: TaxaAgenciaModo;
  taxa_valor?: number | null;
  rider_camarim?: string[];
  rider_efeitos?: string[];
};
