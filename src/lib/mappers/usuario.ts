import type { Papel } from "@/lib/permissoes";
import type { Cidade } from "@/types";
import { rowParaCidade, type CidadeRow } from "@/lib/mappers/contatos";

/**
 * LEGADO MORTO (mantido só como tipo, sem mais uso real de acesso). Mapa de
 * funções operacionais → lista de DJs atendidos, que morava em
 * `profiles.funcoes`. O acesso operacional agora vem 100% dos vínculos por
 * artista (membros_artista). Tipo preservado porque `session.ts` (campo
 * neutro) e `workspace-context.tsx` ainda o referenciam.
 */
export type Funcoes = {
  vendedor?: string[];
  financeiro?: string[];
  produtor?: string[];
};

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
  status: string | null;
  deletado_em: string | null;
  pode_criar_anotacoes: boolean | null;
  /**
   * true = a senha do usuário ainda é a aleatória gerada pelo sistema
   * (criação ou último reset). false = o próprio usuário já trocou na
   * aba Perfil (card Acesso). Default false (existentes não são alarmados).
   */
  senha_padrao: boolean;
  /**
   * Senha aleatória em plaintext — só preenchida enquanto
   * `senha_padrao = true`. Apagada quando o usuário troca pelo painel.
   * Ver migration 28 e doc do trade-off.
   */
  senha_padrao_valor: string | null;
  // Dados pessoais (migrações 53/54/55) — servem para contrato.
  cor: string | null;
  pais: string | null;
  nome_legal: string | null;
  documento_tipo: string | null;
  documento: string | null;
  razao_social: string | null;
  endereco: string | null;
  telefone: string | null;
  // Pessoa (migrations 72/73) — nascimento + e-mail de CONTATO (≠ login).
  data_nascimento: string | null;
  email_contato: string | null;
  cidade_id: string | null;
  /**
   * Cidade embutida (join em cidades por cidade_id). Presente só nos SELECTs
   * que embedam o recurso (o roster da equipe) — alimenta o pré-preenchimento
   * do seletor de cidade no editar.
   */
  cidade?: CidadeRow | null;
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
  // escopo/funcoes REMOVIDOS: o acesso operacional vem 100% dos vínculos por
  // artista (membros_artista), não mais do profile.
  ativo: boolean;
  /** Permissão dedicada (workspace-level): criar pastas de anotações. */
  podeCriarAnotacoes?: boolean;
  // Dados pessoais (opcionais).
  cor?: string;
  pais?: string;
  nomeLegal?: string;
  documentoTipo?: string;
  documento?: string;
  razaoSocial?: string;
  endereco?: string;
  telefone?: string;
  dataNascimento?: string;
  emailContato?: string;
  cidadeId?: string;
  /** Cidade completa (nome/uf/país) — pré-preenche o seletor de cidade no editar. */
  cidade?: Cidade;
};

export function rowParaUsuario(row: ProfileRow): UsuarioEquipe {
  const u: UsuarioEquipe = {
    id: row.id,
    nome: row.nome,
    email: row.email,
    username: row.username ?? null,
    papel: row.papel,
    ativo: row.status === "ativo",
  };
  if (row.cor) u.cor = row.cor;
  if (row.pais) u.pais = row.pais;
  if (row.nome_legal) u.nomeLegal = row.nome_legal;
  if (row.documento_tipo) u.documentoTipo = row.documento_tipo;
  if (row.documento) u.documento = row.documento;
  if (row.razao_social) u.razaoSocial = row.razao_social;
  if (row.endereco) u.endereco = row.endereco;
  if (row.telefone) u.telefone = row.telefone;
  if (row.data_nascimento) u.dataNascimento = row.data_nascimento;
  if (row.email_contato) u.emailContato = row.email_contato;
  if (row.cidade_id) u.cidadeId = row.cidade_id;
  if (row.cidade) u.cidade = rowParaCidade(row.cidade);
  if (row.pode_criar_anotacoes) u.podeCriarAnotacoes = true;
  return u;
}

/**
 * Redige a PII do roster de equipe para quem NÃO é admin. Mantém só o que
 * displays de atribuição precisam (id/nome/papel/ativo/cor); zera e-mail,
 * documento, telefone, endereço, funções etc. O GET /api/usuarios não é
 * admin-gated, então sem isso vaza a PII da equipe inteira.
 */
export function redigirUsuario(u: UsuarioEquipe): UsuarioEquipe {
  return {
    id: u.id,
    nome: u.nome,
    email: "",
    username: null,
    papel: u.papel,
    ativo: u.ativo,
    ...(u.cor ? { cor: u.cor } : {}),
  };
}

export type UsuarioEscrita = {
  workspace_id?: string;
  nome?: string;
  email?: string;
  /** Handle de login "raiz-slug", gravado na criação de membros novos. */
  username?: string;
  papel?: Papel;
  status?: "ativo" | "bloqueado" | "desativado";
  pode_criar_anotacoes?: boolean;
  /** Marca true ao criar ou resetar; false quando o usuário troca pelo painel. */
  senha_padrao?: boolean;
  /** Valor da senha aleatória (plaintext). Só viaja junto com `senha_padrao=true`. */
  senha_padrao_valor?: string | null;
  // Dados pessoais (migrações 53/54/55).
  cor?: string | null;
  pais?: string | null;
  nome_legal?: string | null;
  documento_tipo?: string | null;
  documento?: string | null;
  razao_social?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;
  email_contato?: string | null;
  cidade_id?: string | null;
};
