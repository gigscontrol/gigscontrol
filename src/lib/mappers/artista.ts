import type { DJ } from "@/types";

export type ArtistaRow = {
  id: string;
  workspace_id: string;
  nome: string;
  cor: string | null;
  acesso_suspenso: boolean | null;
  deletado_em: string | null;
  criado_em: string | null;
};

export function rowParaDj(row: ArtistaRow): DJ {
  return {
    id: row.id,
    name: row.nome,
    color: row.cor ?? "#3b82f6",
    acessoSuspenso: !!row.acesso_suspenso,
  };
}

export type ArtistaEscrita = {
  workspace_id?: string;
  nome?: string;
  cor?: string;
  acesso_suspenso?: boolean;
};
