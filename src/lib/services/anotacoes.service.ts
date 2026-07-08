import type { SupabaseClient } from "@supabase/supabase-js";
import {
  rowParaPasta,
  rowParaAnotacao,
  type AnotacaoPasta,
  type Anotacao,
  type PastaEscrita,
  type NotaEscrita,
  type VisibilidadePasta,
} from "@/lib/mappers/anotacoes";
import type {
  PastaCreateInput,
  PastaUpdateInput,
  NotaCreateInput,
  NotaUpdateInput,
} from "@/lib/validators/anotacoes.schema";
import * as repo from "@/lib/repositories/anotacoes.repo";

// ---- Leitura (a RLS já filtra por visibilidade) ----

export async function listarPastasDoWorkspace(
  supabase: SupabaseClient
): Promise<AnotacaoPasta[]> {
  const [rows, membros] = await Promise.all([
    repo.listarPastas(supabase),
    repo.listarMembros(supabase),
  ]);
  const porPasta = new Map<string, string[]>();
  for (const m of membros) {
    const arr = porPasta.get(m.pasta_id) ?? [];
    arr.push(m.usuario_id);
    porPasta.set(m.pasta_id, arr);
  }
  return rows.map((r) => rowParaPasta(r, porPasta.get(r.id) ?? []));
}

export async function listarNotasDoWorkspace(
  supabase: SupabaseClient
): Promise<Anotacao[]> {
  const rows = await repo.listarNotas(supabase);
  return rows.map(rowParaAnotacao);
}

// ---- Pastas ----

export async function criarPastaNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: PastaCreateInput,
  criadoPor: string
): Promise<AnotacaoPasta> {
  const escrita: PastaEscrita = {
    nome: input.nome,
    cor: input.cor ?? null,
    icone: input.icone ?? null,
    visibilidade: input.visibilidade,
    criado_por: criadoPor,
  };
  const row = await repo.criarPasta(supabase, workspaceId, escrita);
  const membros = input.visibilidade === "selecionados" ? input.membros ?? [] : [];
  if (membros.length > 0) await repo.setMembros(supabase, row.id, membros);
  return rowParaPasta(row, membros);
}

export async function atualizarPastaPorId(
  supabase: SupabaseClient,
  id: string,
  input: PastaUpdateInput
): Promise<AnotacaoPasta> {
  const escrita: PastaEscrita = { atualizado_em: new Date().toISOString() };
  if (input.nome !== undefined) escrita.nome = input.nome;
  if (input.cor !== undefined) escrita.cor = input.cor ?? null;
  if (input.icone !== undefined) escrita.icone = input.icone ?? null;
  if (input.visibilidade !== undefined) escrita.visibilidade = input.visibilidade;
  const row = await repo.atualizarPasta(supabase, id, escrita);

  // Membros: quando a pasta é "selecionados", reflete a lista enviada (ou lê a
  // atual). Se deixou de ser "selecionados", limpa a lista.
  let membros: string[] = [];
  const vis = row.visibilidade as VisibilidadePasta;
  if (vis === "selecionados") {
    if (input.membros !== undefined) {
      await repo.setMembros(supabase, id, input.membros);
      membros = input.membros;
    } else {
      const all = await repo.listarMembros(supabase);
      membros = all.filter((m) => m.pasta_id === id).map((m) => m.usuario_id);
    }
  } else {
    await repo.setMembros(supabase, id, []);
  }
  return rowParaPasta(row, membros);
}

export async function removerPastaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repo.removerPasta(supabase, id);
}

// ---- Notas ----

export async function criarNotaNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  input: NotaCreateInput,
  criadoPor: string
): Promise<Anotacao> {
  const escrita: NotaEscrita = {
    pasta_id: input.pasta_id ?? null,
    show_id: input.show_id ?? null,
    conteudo: input.conteudo ?? "",
    titulo: input.titulo ?? null,
    cor: input.cor ?? null,
    fixada: input.fixada ?? false,
    criado_por: criadoPor,
    atualizado_por: criadoPor,
  };
  const row = await repo.criarNota(supabase, workspaceId, escrita);
  return rowParaAnotacao(row);
}

export async function atualizarNotaPorId(
  supabase: SupabaseClient,
  id: string,
  input: NotaUpdateInput,
  atualizadoPor: string
): Promise<Anotacao> {
  const escrita: NotaEscrita = {
    atualizado_em: new Date().toISOString(),
    atualizado_por: atualizadoPor,
  };
  if (input.titulo !== undefined) escrita.titulo = input.titulo ?? null;
  if (input.conteudo !== undefined) escrita.conteudo = input.conteudo;
  if (input.cor !== undefined) escrita.cor = input.cor ?? null;
  if (input.fixada !== undefined) escrita.fixada = input.fixada;
  const row = await repo.atualizarNota(supabase, id, escrita);
  return rowParaAnotacao(row);
}

export async function removerNotaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repo.removerNota(supabase, id);
}
