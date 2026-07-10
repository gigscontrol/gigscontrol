/**
 * Mappers de Anotações: PASTAS (tópicos compartilháveis) + NOTAS (thread na pasta).
 * Row = shape do banco (snake_case); tipo da UI = camelCase.
 */

export type VisibilidadePasta = "todos" | "proprio" | "selecionados";

const VISIBILIDADES: VisibilidadePasta[] = ["todos", "proprio", "selecionados"];
function visibilidadeValida(v: string | null | undefined): VisibilidadePasta {
  return v && (VISIBILIDADES as string[]).includes(v) ? (v as VisibilidadePasta) : "todos";
}

// ============================================================
// Pastas
// ============================================================

export type PastaRow = {
  id: string;
  workspace_id: string;
  nome: string;
  cor: string | null;
  icone: string | null;
  visibilidade: string | null;
  criado_por: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

export type AnotacaoPasta = {
  id: string;
  nome: string;
  cor?: string;
  icone?: string;
  visibilidade: VisibilidadePasta;
  /** userIds que podem ver (só quando visibilidade === "selecionados"). */
  membros: string[];
  criadoPor?: string;
  criadoEm: string;
  atualizadoEm: string;
};

export function rowParaPasta(row: PastaRow, membros: string[] = []): AnotacaoPasta {
  const p: AnotacaoPasta = {
    id: row.id,
    nome: row.nome,
    visibilidade: visibilidadeValida(row.visibilidade),
    membros,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
  if (row.cor) p.cor = row.cor;
  if (row.icone) p.icone = row.icone;
  if (row.criado_por) p.criadoPor = row.criado_por;
  return p;
}

export type PastaEscrita = {
  workspace_id?: string;
  nome?: string;
  cor?: string | null;
  icone?: string | null;
  visibilidade?: VisibilidadePasta;
  criado_por?: string | null;
  atualizado_em?: string;
};

// ============================================================
// Notas
// ============================================================

export type NotaRow = {
  id: string;
  workspace_id: string;
  pasta_id: string | null;
  show_id: string | null;
  titulo: string | null;
  conteudo: string | null;
  cor: string | null;
  fixada: boolean | null;
  criado_por: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  atualizado_por: string | null;
};

export type Anotacao = {
  id: string;
  /** Dono da nota: uma pasta OU um show (exatamente um dos dois). */
  pastaId?: string;
  showId?: string;
  titulo?: string;
  conteudo: string;
  cor?: string;
  fixada: boolean;
  criadoPor?: string;
  criadoEm: string;
  atualizadoEm: string;
  atualizadoPor?: string;
};

export function rowParaAnotacao(row: NotaRow): Anotacao {
  const n: Anotacao = {
    conteudo: row.conteudo ?? "",
    id: row.id,
    fixada: !!row.fixada,
    criadoEm: row.criado_em ?? "",
    atualizadoEm: row.atualizado_em ?? row.criado_em ?? "",
  };
  if (row.pasta_id) n.pastaId = row.pasta_id;
  if (row.show_id) n.showId = row.show_id;
  if (row.titulo) n.titulo = row.titulo;
  if (row.cor) n.cor = row.cor;
  if (row.criado_por) n.criadoPor = row.criado_por;
  if (row.atualizado_por) n.atualizadoPor = row.atualizado_por;
  return n;
}

export type NotaEscrita = {
  workspace_id?: string;
  pasta_id?: string | null;
  show_id?: string | null;
  titulo?: string | null;
  conteudo?: string;
  cor?: string | null;
  fixada?: boolean;
  criado_por?: string | null;
  atualizado_por?: string | null;
  atualizado_em?: string;
};
