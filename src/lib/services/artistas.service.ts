import type { SupabaseClient } from "@supabase/supabase-js";
import type { DJ, TaxaAgenciaModo } from "@/types";
import { rowParaDj, type ArtistaEscrita } from "@/lib/mappers/artista";
import {
  listarArtistas as repoListar,
  buscarArtista as repoBuscar,
  buscarArtistaComUsername as repoBuscarComUsername,
  buscarSlugWorkspace,
  contarArtistas,
  criarArtista as repoCriar,
  atualizarArtista as repoAtualizar,
  moverArtistaParaLixeira,
  removerArtistaDefinitivamente,
  usernameJaExiste,
} from "@/lib/repositories/artistas.repo";
import type {
  ArtistaCreateInput,
  ArtistaUpdateInput,
} from "@/lib/validators/artistas.schema";
import { getPlano, type PlanoId } from "@/lib/planos";
import { gerarSenhaAleatoria } from "@/lib/senha-aleatoria";

/** Erro lançado quando o workspace atinge o limite do plano. */
export class LimitePlanoAtingidoError extends Error {
  status = 409;
  constructor(public limite: number, public plano: string) {
    super(
      `Limite de ${limite} artistas atingido no plano ${plano}. Faça upgrade ou remova um artista.`
    );
    this.name = "LimitePlanoAtingidoError";
  }
}

/** Username já em uso por outro profile. */
export class UsernameEmUsoError extends Error {
  status = 409;
  constructor(public username: string) {
    super(`O username "${username}" já está em uso. Escolha outro.`);
    this.name = "UsernameEmUsoError";
  }
}

/**
 * Monta o username final a partir da raiz digitada pelo admin + slug
 * da agência. Ex: ("brunosocek", "twobookings") → "brunosocek-twobookings".
 */
export function montarUsernameCompleto(raiz: string, slug: string): string {
  return `${raiz}-${slug}`;
}

/**
 * Monta o email "fake" interno usado pelo Supabase Auth quando o
 * artista ainda não cadastrou um email real próprio. Esse email não
 * recebe nada — é só placeholder pro Auth aceitar criar o usuário.
 *
 * Depois do 1º login, o artista pode trocar pelo email real dele em
 * Configurações → Segurança (ou via supabase.auth.updateUser).
 */
function montarEmailFake(username: string): string {
  return `${username}@interno.gigscontrol.app`;
}

function entradaUpdateParaEscrita(input: ArtistaUpdateInput): ArtistaEscrita {
  const out: ArtistaEscrita = {};
  if (input.nome !== undefined) out.nome = input.nome;
  if (input.cor !== undefined) out.cor = input.cor;
  if (input.acesso_suspenso !== undefined)
    out.acesso_suspenso = input.acesso_suspenso;
  if (input.cidade_ibge_id !== undefined) out.cidade_ibge_id = input.cidade_ibge_id ?? null;
  if (input.cidade_nome !== undefined) out.cidade_nome = input.cidade_nome ?? null;
  if (input.cidade_uf !== undefined) out.cidade_uf = input.cidade_uf ?? null;
  if (input.taxa_modo !== undefined) out.taxa_modo = input.taxa_modo;
  if (input.taxa_valor !== undefined) out.taxa_valor = input.taxa_valor ?? null;
  if (input.rider_camarim !== undefined) out.rider_camarim = input.rider_camarim;
  if (input.rider_efeitos !== undefined) out.rider_efeitos = input.rider_efeitos;
  return out;
}

export async function listarArtistasDoWorkspace(
  supabase: SupabaseClient
): Promise<DJ[]> {
  const rows = await repoListar(supabase);
  if (rows.length === 0) return [];

  // Carrega usernames vinculados (papel=artista) pra exibir na lista
  const ids = rows.map((r) => r.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("artista_id, username")
    .in("artista_id", ids);

  const mapaUsername = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.artista_id && p.username) {
      mapaUsername.set(p.artista_id, p.username);
    }
  }

  return rows.map((r) =>
    rowParaDj({ ...r, username: mapaUsername.get(r.id) ?? null })
  );
}

export async function buscarArtistaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<DJ | null> {
  const row = await repoBuscarComUsername(supabase, id);
  return row ? rowParaDj(row) : null;
}

/**
 * Cria um artista COMPLETO:
 *  1. Valida limite do plano.
 *  2. Monta username = "raiz-slugDaAgencia" e checa unicidade global.
 *  3. Cria auth user (service_role) com email fake interno + senha aleatória.
 *  4. Cria registro em `artists` com taxa + cidade + riders.
 *  5. Cria registro em `profiles` (papel='artista', artista_id, username).
 *  6. Em caso de falha nos passos 4-5, rollback: remove auth user.
 *
 * @param admin cliente do Supabase com service_role (criado por criarClienteAdmin)
 * @returns artista criado + senha em texto plano (mostrada UMA vez ao admin)
 */
export async function criarArtistaCompleto(
  admin: SupabaseClient,
  workspaceId: string,
  planoId: PlanoId,
  input: ArtistaCreateInput
): Promise<{ artista: DJ; senhaTemporaria: string; usernameCompleto: string }> {
  // 1. Plano
  const plano = getPlano(planoId);
  const total = await contarArtistas(admin);
  if (total >= plano.maxArtistas) {
    throw new LimitePlanoAtingidoError(plano.maxArtistas, plano.nome);
  }

  // 2. Username
  const slug = await buscarSlugWorkspace(admin, workspaceId);
  const usernameCompleto = montarUsernameCompleto(input.username_raiz, slug);
  if (await usernameJaExiste(admin, usernameCompleto)) {
    throw new UsernameEmUsoError(usernameCompleto);
  }

  // 3. Auth user
  const senhaTemporaria = gerarSenhaAleatoria();
  const emailFake = montarEmailFake(usernameCompleto);
  const { data: created, error: errAuth } = await admin.auth.admin.createUser({
    email: emailFake,
    password: senhaTemporaria,
    email_confirm: true, // pula confirmação (artista recebe credencial direta)
    user_metadata: { nome: input.nome, username: usernameCompleto },
  });
  if (errAuth || !created.user) {
    throw new Error(errAuth?.message ?? "Falha ao criar usuário no Auth.");
  }

  // 4. Artista (row em `artists`)
  let artistaRow;
  try {
    const escrita: ArtistaEscrita = {
      nome: input.nome,
      cor: input.cor ?? "#3b82f6",
      taxa_modo: input.taxa_modo ?? "sem-taxa",
    };
    if (input.cidade_ibge_id) escrita.cidade_ibge_id = input.cidade_ibge_id;
    if (input.cidade_nome) escrita.cidade_nome = input.cidade_nome;
    if (input.cidade_uf) escrita.cidade_uf = input.cidade_uf;
    if (input.taxa_valor !== undefined) escrita.taxa_valor = input.taxa_valor;
    if (input.rider_camarim) escrita.rider_camarim = input.rider_camarim;
    if (input.rider_efeitos) escrita.rider_efeitos = input.rider_efeitos;
    artistaRow = await repoCriar(admin, workspaceId, escrita);
  } catch (e) {
    // Rollback auth user
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    throw e;
  }

  // 5. Profile (linka auth user → artista)
  try {
    const { error: errProfile } = await admin.from("profiles").insert({
      id: created.user.id,
      workspace_id: workspaceId,
      nome: input.nome,
      email: emailFake,
      papel: "artista",
      is_super_admin: false,
      artista_id: artistaRow.id,
      username: usernameCompleto,
      status: "ativo",
    });
    if (errProfile) throw errProfile;
  } catch (e) {
    // Rollback: remove artista + auth user
    await removerArtistaDefinitivamente(admin, artistaRow.id).catch(() => undefined);
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    throw e;
  }

  // Devolve com username embutido pro mapper
  const dj = rowParaDj({ ...artistaRow, username: usernameCompleto });
  return { artista: dj, senhaTemporaria, usernameCompleto };
}

export async function atualizarArtistaPorId(
  admin: SupabaseClient,
  id: string,
  input: ArtistaUpdateInput
): Promise<DJ> {
  const row = await repoAtualizar(admin, id, entradaUpdateParaEscrita(input));
  // Carrega o username também (pra o caller mostrar)
  const comUsername = await repoBuscarComUsername(admin, row.id);
  return rowParaDj(comUsername ?? row);
}

/** Inverte o flag `acesso_suspenso`. */
export async function alternarSuspensaoArtista(
  supabase: SupabaseClient,
  id: string
): Promise<DJ> {
  const atual = await repoBuscar(supabase, id);
  if (!atual) throw new Error("Artista não encontrado.");
  const row = await repoAtualizar(supabase, id, {
    acesso_suspenso: !atual.acesso_suspenso,
  });
  return rowParaDj(row);
}

/** Soft delete: move pra lixeira (recuperável por 30 dias). */
export async function removerArtistaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await moverArtistaParaLixeira(supabase, id);
}

/**
 * Reseta a senha do usuário-artista vinculado a este artista. Devolve
 * a nova senha em texto plano (mostrada UMA vez).
 */
export async function resetarSenhaArtista(
  admin: SupabaseClient,
  artistaId: string
): Promise<{ senhaTemporaria: string }> {
  // Acha o profile linkado
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("artista_id", artistaId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) {
    throw new Error("Artista sem usuário vinculado.");
  }
  const senhaTemporaria = gerarSenhaAleatoria();
  const { error: errUpd } = await admin.auth.admin.updateUserById(profile.id, {
    password: senhaTemporaria,
  });
  if (errUpd) throw new Error(errUpd.message ?? "Falha ao resetar senha.");
  return { senhaTemporaria };
}

/**
 * Lista de modos de taxa expostos pelo service (re-exportada pra a UI
 * não precisar conhecer o validator).
 */
export const MODOS_TAXA: TaxaAgenciaModo[] = [
  "sem-taxa",
  "perc-fixa",
  "perc-variavel",
  "valor-fixo",
  "valor-variavel",
];
