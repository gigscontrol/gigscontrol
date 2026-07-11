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
  proximaPosicaoArtista,
  atualizarPosicoes,
} from "@/lib/repositories/artistas.repo";
import type {
  ArtistaCreateInput,
  ArtistaUpdateInput,
} from "@/lib/validators/artistas.schema";
import { getPlano, type PlanoId } from "@/lib/planos";
import { planoEfetivoParaLimites } from "@/lib/services/limites";
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
 * Colisão com um artista que está na lixeira do mesmo workspace.
 * Diferente de UsernameEmUsoError, este é específico pra dar uma
 * mensagem acionável: o admin precisa restaurar ou apagar de vez antes
 * de poder reutilizar nome/username.
 */
export class ArtistaNaLixeiraError extends Error {
  status = 409;
  constructor(
    public artistaNome: string,
    public matchPor: "nome" | "username"
  ) {
    const campo = matchPor === "nome" ? "nome" : "username";
    super(
      `Existe um artista na lixeira com esse ${campo} ("${artistaNome}"). ` +
        `Restaure-o ou apague definitivamente antes de criar outro com os mesmos dados.`
    );
    this.name = "ArtistaNaLixeiraError";
  }
}

/**
 * Verifica se já existe na lixeira do workspace algum artista cujo
 * NOME (case-insensitive) bata, ou cujo PROFILE.username bata com o
 * que o admin está tentando criar. Devolve o que achou (com qual
 * critério bateu) ou `null` se está livre.
 *
 * Roda só com cliente admin (service_role) — precisa ler artistas
 * deletados, que ficam fora das policies normais.
 */
async function artistaNaLixeiraColidente(
  admin: SupabaseClient,
  workspaceId: string,
  nome: string,
  usernameCompleto: string
): Promise<{ nome: string; matchPor: "nome" | "username" } | null> {
  // 1. Por nome (no mesmo workspace, ignora caixa)
  const { data: porNome } = await admin
    .from("artists")
    .select("id, nome")
    .eq("workspace_id", workspaceId)
    .not("deletado_em", "is", null)
    .ilike("nome", nome)
    .limit(1);
  if (porNome && porNome.length > 0) {
    return { nome: porNome[0].nome as string, matchPor: "nome" };
  }

  // 2. Por username — busca o profile colidente e, se ele aponta pra
  //    um artista, vê se esse artista está na lixeira.
  const { data: profile } = await admin
    .from("profiles")
    .select("artista_id")
    .eq("username", usernameCompleto)
    .maybeSingle();
  if (profile?.artista_id) {
    const { data: artista } = await admin
      .from("artists")
      .select("nome, deletado_em")
      .eq("id", profile.artista_id as string)
      .maybeSingle();
    if (artista?.deletado_em) {
      return { nome: artista.nome as string, matchPor: "username" };
    }
  }

  return null;
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
export function montarEmailFake(username: string): string {
  return `${username}@interno.gigscontrol.app`;
}

/** Detecta se o email atual ainda é o fake interno gerado pelo signup. */
export function emailEhInternoFake(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith("@interno.gigscontrol.app");
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
  if (input.cidade_id !== undefined) out.cidade_id = input.cidade_id ?? null;
  if (input.pais !== undefined) out.pais = input.pais ?? null;
  if (input.nome_legal !== undefined) out.nome_legal = input.nome_legal ?? null;
  if (input.documento !== undefined) out.documento = input.documento ?? null;
  if (input.documento_tipo !== undefined)
    out.documento_tipo = input.documento_tipo ?? null;
  if (input.razao_social !== undefined)
    out.razao_social = input.razao_social ?? null;
  if (input.endereco !== undefined) out.endereco = input.endereco ?? null;
  if (input.telefone !== undefined) out.telefone = input.telefone ?? null;
  if (input.taxa_modo !== undefined) out.taxa_modo = input.taxa_modo;
  if (input.taxa_valor !== undefined) out.taxa_valor = input.taxa_valor ?? null;
  if (input.rider_camarim !== undefined) out.rider_camarim = input.rider_camarim;
  if (input.rider_efeitos !== undefined) out.rider_efeitos = input.rider_efeitos;
  if (input.rider_tecnico !== undefined) out.rider_tecnico = input.rider_tecnico;
  if (input.privacidade !== undefined) out.privacidade = input.privacidade;
  return out;
}

export async function listarArtistasDoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<DJ[]> {
  const rows = await repoListar(supabase, workspaceId);
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
  // 1. Plano — usa o plano-destino se há downgrade agendado (trava o excesso).
  const plano = getPlano(await planoEfetivoParaLimites(admin, workspaceId, planoId));
  const total = await contarArtistas(admin, workspaceId);
  if (total >= plano.maxArtistas) {
    throw new LimitePlanoAtingidoError(plano.maxArtistas, plano.nome);
  }

  // 2. Username
  const slug = await buscarSlugWorkspace(admin, workspaceId);
  const usernameCompleto = montarUsernameCompleto(input.username_raiz, slug);

  // 2a. Colisão com artista na lixeira do mesmo workspace? Esse check
  // roda ANTES do usernameJaExiste porque queremos uma mensagem mais
  // específica nesse caso ("restaure ou apague" em vez de "já em uso").
  const naLixeira = await artistaNaLixeiraColidente(
    admin,
    workspaceId,
    input.nome,
    usernameCompleto
  );
  if (naLixeira) {
    throw new ArtistaNaLixeiraError(naLixeira.nome, naLixeira.matchPor);
  }

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
    if (input.cidade_id) escrita.cidade_id = input.cidade_id;
    if (input.pais) escrita.pais = input.pais;
    if (input.nome_legal) escrita.nome_legal = input.nome_legal;
    if (input.documento) escrita.documento = input.documento;
    if (input.documento_tipo) escrita.documento_tipo = input.documento_tipo;
    if (input.razao_social) escrita.razao_social = input.razao_social;
    if (input.endereco) escrita.endereco = input.endereco;
    if (input.telefone) escrita.telefone = input.telefone;
    if (input.taxa_valor !== undefined) escrita.taxa_valor = input.taxa_valor;
    if (input.rider_camarim) escrita.rider_camarim = input.rider_camarim;
    if (input.rider_efeitos) escrita.rider_efeitos = input.rider_efeitos;
    if (input.rider_tecnico) escrita.rider_tecnico = input.rider_tecnico;
    if (input.privacidade !== undefined) escrita.privacidade = input.privacidade;
    // Novo artista vai pro FIM da lista — admin reordena depois se quiser
    escrita.posicao = await proximaPosicaoArtista(admin, workspaceId);
    artistaRow = await repoCriar(admin, workspaceId, escrita);
  } catch (e) {
    // Rollback do auth user — best-effort, mas LOGA se falhar (senão sobra auth
    // user órfão com o email fake e o handle fica impossível de recriar).
    await admin.auth.admin
      .deleteUser(created.user.id)
      .catch((err) => console.error("[criarArtista] rollback do auth user falhou:", created.user.id, err));
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
      // Artista nasce com a senha aleatória gerada acima — admin precisa
      // saber que ainda é a padrão até o próprio artista trocar.
      senha_padrao: true,
      // Guarda em plaintext pra admin conseguir recuperar/copiar depois
      // (apagada na 1ª troca de senha pelo próprio artista).
      senha_padrao_valor: senhaTemporaria,
    });
    if (errProfile) throw errProfile;
  } catch (e) {
    // Rollback: remove artista + auth user (best-effort + log — órfão de auth
    // user bloqueia recriar o mesmo handle depois).
    await removerArtistaDefinitivamente(admin, artistaRow.id).catch((err) =>
      console.error("[criarArtista] rollback do artista falhou:", artistaRow.id, err)
    );
    await admin.auth.admin
      .deleteUser(created.user.id)
      .catch((err) => console.error("[criarArtista] rollback do auth user falhou:", created.user.id, err));
    throw e;
  }

  // Devolve com username embutido pro mapper
  const dj = rowParaDj({ ...artistaRow, username: usernameCompleto });
  return { artista: dj, senhaTemporaria, usernameCompleto };
}

/**
 * Atualiza o username (login) de um artista. Mantém o profile.username
 * único globalmente e sincroniza o email fake interno do auth user se
 * ele ainda for interno; se já trocou pra email real do artista, não
 * mexe.
 */
async function atualizarUsernameArtista(
  admin: SupabaseClient,
  artistaId: string,
  novoUsernameRaiz: string,
  workspaceId: string
): Promise<void> {
  const slug = await buscarSlugWorkspace(admin, workspaceId);
  const novoCompleto = montarUsernameCompleto(novoUsernameRaiz, slug);

  // Acha o profile vinculado e o username atual
  const { data: profile, error: errProf } = await admin
    .from("profiles")
    .select("id, username, email")
    .eq("artista_id", artistaId)
    .maybeSingle();
  if (errProf || !profile) {
    throw new Error("Artista sem usuário vinculado.");
  }

  // Se não mudou de fato, segue em frente sem mexer
  if (profile.username === novoCompleto) return;

  // Checa unicidade (excluindo o próprio profile)
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", novoCompleto)
    .neq("id", profile.id);
  if ((count ?? 0) > 0) {
    throw new UsernameEmUsoError(novoCompleto);
  }

  // Atualiza o username no profile
  const { error: errUpd } = await admin
    .from("profiles")
    .update({ username: novoCompleto })
    .eq("id", profile.id);
  if (errUpd) throw errUpd;

  // Se o email atual ainda é o fake interno, atualiza pra bater com o
  // novo username (mantém consistência). Se já é email real do artista,
  // NÃO mexe.
  if (emailEhInternoFake(profile.email)) {
    const novoEmailFake = montarEmailFake(novoCompleto);
    const { error: errAuth } = await admin.auth.admin.updateUserById(
      profile.id,
      { email: novoEmailFake, email_confirm: true }
    );
    if (errAuth) {
      throw new Error(
        "Username atualizado, mas falha ao atualizar email interno: " +
          errAuth.message
      );
    }
    await admin
      .from("profiles")
      .update({ email: novoEmailFake })
      .eq("id", profile.id);
  }
}

/**
 * Atualiza o email do auth user vinculado ao artista (admin sobrescreve).
 * Marca como verificado direto (admin garantiu).
 */
async function atualizarEmailArtista(
  admin: SupabaseClient,
  artistaId: string,
  novoEmail: string
): Promise<void> {
  const { data: profile, error: errProf } = await admin
    .from("profiles")
    .select("id, email")
    .eq("artista_id", artistaId)
    .maybeSingle();
  if (errProf || !profile) {
    throw new Error("Artista sem usuário vinculado.");
  }
  if (profile.email?.toLowerCase() === novoEmail.toLowerCase()) return; // no-op

  const { error: errAuth } = await admin.auth.admin.updateUserById(
    profile.id,
    { email: novoEmail, email_confirm: true }
  );
  if (errAuth) {
    if (errAuth.message?.toLowerCase().includes("already registered")) {
      throw new Error("Esse e-mail já está em uso por outra conta.");
    }
    throw new Error(errAuth.message ?? "Falha ao atualizar e-mail.");
  }
  await admin.from("profiles").update({ email: novoEmail }).eq("id", profile.id);
}

export async function atualizarArtistaPorId(
  admin: SupabaseClient,
  id: string,
  input: ArtistaUpdateInput
): Promise<DJ> {
  // Username e email precisam ser tratados em separado (mexem em auth + profile)
  if (input.username_raiz) {
    // Pra saber o workspace, busca pelo próprio artista
    const { data: row } = await admin
      .from("artists")
      .select("workspace_id")
      .eq("id", id)
      .single();
    if (!row) throw new Error("Artista não encontrado.");
    await atualizarUsernameArtista(
      admin,
      id,
      input.username_raiz,
      row.workspace_id
    );
  }
  if (input.email_conta) {
    await atualizarEmailArtista(admin, id, input.email_conta);
  }

  // Resto dos campos vão pra tabela `artists` direto
  const escrita = entradaUpdateParaEscrita(input);
  if (Object.keys(escrita).length > 0) {
    await repoAtualizar(admin, id, escrita);
  }

  // Recarrega completo com username pra devolver
  const final = await repoBuscarComUsername(admin, id);
  if (!final) throw new Error("Artista não encontrado após atualização.");
  return rowParaDj(final);
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
  id: string,
  deletadoPor?: string
): Promise<void> {
  await moverArtistaParaLixeira(supabase, id, deletadoPor);
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
  // Volta o flag pra "padrão" + guarda a nova senha em plaintext.
  // Não bloqueia em caso de erro (a senha já foi resetada com sucesso
  // no auth).
  await admin
    .from("profiles")
    .update({ senha_padrao: true, senha_padrao_valor: senhaTemporaria })
    .eq("id", profile.id);
  return { senhaTemporaria };
}

/**
 * Reordena artistas no workspace. Recebe os IDs na NOVA ordem
 * desejada e regrava `posicao = (índice + 1) * 10` pra cada um.
 *
 * Por que incrementos de 10? Reserva espaço pra inserções intermediárias
 * futuras sem precisar renumerar tudo (truque clássico de listas
 * orderable).
 *
 * Idempotente: chamar 2x com a mesma ordem dá o mesmo resultado.
 */
export async function reordenarArtistasNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  idsNaOrdem: string[]
): Promise<void> {
  // Confirma que todos os IDs pertencem ao workspace (segurança)
  const { data, error } = await supabase
    .from("artists")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("id", idsNaOrdem)
    .is("deletado_em", null);
  if (error) throw error;
  const idsValidos = new Set((data ?? []).map((r) => r.id as string));
  const filtrados = idsNaOrdem.filter((id) => idsValidos.has(id));

  const updates = filtrados.map((id, idx) => ({
    id,
    posicao: (idx + 1) * 10,
  }));
  if (updates.length === 0) return;
  await atualizarPosicoes(supabase, updates);
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
