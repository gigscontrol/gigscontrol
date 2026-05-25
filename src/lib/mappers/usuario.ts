import type { Papel } from "@/lib/permissoes";

/**
 * Mapa de funções operacionais → lista de DJs (artists.id) atendidos.
 *
 * Estrutura armazenada em `profiles.funcoes` (jsonb). Apenas usuários
 * com papel operacional (vendedor / financeiro / produtor) usam isso;
 * admin e artista mantêm `funcoes = {}`.
 *
 * Convenção: a chave só aparece quando a função está ativa. Lista vazia
 * significa "função marcada mas nenhum DJ ainda" — equivale a SEM
 * acesso àquela função (precisa de pelo menos 1 DJ pra ter efeito).
 */
export type Funcoes = {
  vendedor?: string[];
  financeiro?: string[];
  produtor?: string[];
};

export const FUNCOES_VAZIA: Funcoes = {};

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
  funcoes: Record<string, unknown> | null;
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
  funcoes: Funcoes;
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

/**
 * Normaliza o JSON do banco para o tipo Funcoes da UI.
 * Aceita listas de strings; qualquer outro tipo é ignorado.
 */
export function funcoesValido(raw: Record<string, unknown> | null | undefined): Funcoes {
  if (!raw || typeof raw !== "object") return {};
  const out: Funcoes = {};
  for (const k of ["vendedor", "financeiro", "produtor"] as const) {
    const v = (raw as Record<string, unknown>)[k];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out[k] = v as string[];
    }
  }
  return out;
}

export function rowParaUsuario(row: ProfileRow): UsuarioEquipe {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    papel: row.papel,
    escopo: escopoValido(row.escopo),
    funcoes: funcoesValido(row.funcoes),
    ativo: row.status === "ativo",
  };
}

export type UsuarioEscrita = {
  workspace_id?: string;
  nome?: string;
  email?: string;
  papel?: Papel;
  escopo?: EscopoUsuario;
  funcoes?: Funcoes;
  status?: "ativo" | "bloqueado" | "desativado";
};
