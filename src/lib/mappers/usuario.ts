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
  /**
   * Handle de login "raiz-slug" (ex: "raiz-twobookings"). Novos membros
   * da equipe nascem com ele preenchido; membros antigos (criados via
   * e-mail) têm `null` e seguem logando pelo e-mail real.
   */
  username: string | null;
  papel: Papel;
  is_super_admin: boolean;
  artista_id: string | null;
  escopo: Record<string, unknown> | null;
  funcoes: Record<string, unknown> | null;
  status: string | null;
  deletado_em: string | null;
  /**
   * true = a senha do usuário ainda é a aleatória gerada pelo sistema
   * (criação ou último reset). false = o próprio usuário já trocou no
   * AbaSeguranca. Default false (existentes não são alarmados).
   */
  senha_padrao: boolean;
  /**
   * Senha aleatória em plaintext — só preenchida enquanto
   * `senha_padrao = true`. Apagada quando o usuário troca pelo painel.
   * Ver migration 28 e doc do trade-off.
   */
  senha_padrao_valor: string | null;
  // Dados pessoais (migração 53) — servem para contrato.
  pais: string | null;
  documento_tipo: string | null;
  documento: string | null;
  endereco: string | null;
  telefone: string | null;
  cidade_id: string | null;
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
  /** Handle de login "raiz-slug". `null` em membros antigos (login por e-mail). */
  username: string | null;
  papel: Papel;
  escopo: EscopoUsuario;
  funcoes: Funcoes;
  ativo: boolean;
  // Dados pessoais (opcionais).
  pais?: string;
  documentoTipo?: string;
  documento?: string;
  endereco?: string;
  telefone?: string;
  cidadeId?: string;
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
  const u: UsuarioEquipe = {
    id: row.id,
    nome: row.nome,
    email: row.email,
    username: row.username ?? null,
    papel: row.papel,
    escopo: escopoValido(row.escopo),
    funcoes: funcoesValido(row.funcoes),
    ativo: row.status === "ativo",
  };
  if (row.pais) u.pais = row.pais;
  if (row.documento_tipo) u.documentoTipo = row.documento_tipo;
  if (row.documento) u.documento = row.documento;
  if (row.endereco) u.endereco = row.endereco;
  if (row.telefone) u.telefone = row.telefone;
  if (row.cidade_id) u.cidadeId = row.cidade_id;
  return u;
}

export type UsuarioEscrita = {
  workspace_id?: string;
  nome?: string;
  email?: string;
  /** Handle de login "raiz-slug", gravado na criação de membros novos. */
  username?: string;
  papel?: Papel;
  escopo?: EscopoUsuario;
  funcoes?: Funcoes;
  status?: "ativo" | "bloqueado" | "desativado";
  /** Marca true ao criar ou resetar; false quando o usuário troca pelo painel. */
  senha_padrao?: boolean;
  /** Valor da senha aleatória (plaintext). Só viaja junto com `senha_padrao=true`. */
  senha_padrao_valor?: string | null;
  // Dados pessoais (migração 53).
  pais?: string | null;
  documento_tipo?: string | null;
  documento?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  cidade_id?: string | null;
};
