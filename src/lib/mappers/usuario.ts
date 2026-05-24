import type { Papel } from "@/lib/permissoes";

/** Linha da tabela `profiles`. */
export type ProfileRow = {
  id: string;
  workspace_id: string | null;
  nome: string;
  email: string;
  papel: Papel;
  is_super_admin: boolean;
  artista_id: string | null;
  escopo: Record<string, unknown> | null;
  status: string | null;
  deletado_em: string | null;
};

/** Escopo de privacidade da equipe (flags genéricas). */
export type EscopoUsuario = {
  verTodosContatos: boolean;
  verTodasVendas: boolean;
  editarTodosEventos: boolean;
};

export const ESCOPO_PADRAO: EscopoUsuario = {
  verTodosContatos: true,
  verTodasVendas: true,
  editarTodosEventos: true,
};

/** Tipo legado consumido pela UI (workspace-context). */
export type UsuarioEquipe = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  escopo: EscopoUsuario;
  ativo: boolean;
};

function escopoValido(raw: Record<string, unknown> | null | undefined): EscopoUsuario {
  if (!raw || typeof raw !== "object") return { ...ESCOPO_PADRAO };
  return {
    verTodosContatos:
      typeof raw.verTodosContatos === "boolean" ? raw.verTodosContatos : ESCOPO_PADRAO.verTodosContatos,
    verTodasVendas:
      typeof raw.verTodasVendas === "boolean" ? raw.verTodasVendas : ESCOPO_PADRAO.verTodasVendas,
    editarTodosEventos:
      typeof raw.editarTodosEventos === "boolean"
        ? raw.editarTodosEventos
        : ESCOPO_PADRAO.editarTodosEventos,
  };
}

export function rowParaUsuario(row: ProfileRow): UsuarioEquipe {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    papel: row.papel,
    escopo: escopoValido(row.escopo),
    ativo: row.status === "ativo",
  };
}

export type UsuarioEscrita = {
  workspace_id?: string;
  nome?: string;
  email?: string;
  papel?: Papel;
  escopo?: EscopoUsuario;
  status?: "ativo" | "bloqueado" | "desativado";
};
