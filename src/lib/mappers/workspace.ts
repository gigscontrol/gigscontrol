import type { PlanoId } from "@/lib/planos";

/** Row da tabela `workspaces`. */
export type WorkspaceRow = {
  id: string;
  nome: string;
  plano: string;
  ciclo: string | null;
  status: string | null;
  logo_url: string | null;
  criado_em: string | null;
};

/** Aparência consumida pela UI (lê do workspace-context). */
export type WorkspaceAparencia = {
  nomeAgencia: string;
  logoUrl: string | null;
};

export type WorkspaceResumo = WorkspaceAparencia & {
  id: string;
  plano: PlanoId;
  ciclo: string | null;
  status: string | null;
};

export function rowParaWorkspace(row: WorkspaceRow): WorkspaceResumo {
  return {
    id: row.id,
    nomeAgencia: row.nome,
    logoUrl: row.logo_url,
    plano: row.plano as PlanoId,
    ciclo: row.ciclo,
    status: row.status,
  };
}
