import type { SupabaseClient } from "@supabase/supabase-js";
import { rowParaUsuario, type UsuarioEquipe } from "@/lib/mappers/usuario";
import {
  listarUsuariosEquipe,
  contarUsuariosEquipe,
  buscarProfile,
  criarProfile,
  atualizarProfile,
  moverProfileParaLixeira,
} from "@/lib/repositories/usuarios.repo";
import {
  buscarSlugWorkspace,
  usernameJaExiste,
} from "@/lib/repositories/artistas.repo";
import {
  montarUsernameCompleto,
  montarEmailFake,
  UsernameEmUsoError,
} from "@/lib/services/artistas.service";
import type {
  UsuarioCreateInput,
  UsuarioUpdateInput,
} from "@/lib/validators/usuarios.schema";
import { gerarSenhaAleatoria } from "@/lib/senha-aleatoria";
import { getPlano, type PlanoId } from "@/lib/planos";
import { planoEfetivoParaLimites } from "@/lib/services/limites";
import { ESCOPO_PADRAO } from "@/lib/mappers/usuario";
import { upsertVinculo } from "@/lib/repositories/membrosArtista.repo";
import { pertenceAoWorkspace } from "@/lib/api/pertence";

export class ArtistaForaDoWorkspaceError extends Error {
  status = 400;
  constructor() {
    super("Um dos artistas selecionados não pertence a este workspace.");
    this.name = "ArtistaForaDoWorkspaceError";
  }
}

export class LimitePlanoEquipeError extends Error {
  status = 409;
  constructor(public limite: number, public plano: string) {
    super(
      `Limite de ${limite} usuários atingido no plano ${plano}. Faça upgrade ou remova um usuário.`
    );
    this.name = "LimitePlanoEquipeError";
  }
}

// Reexporta o erro de username em uso pra rota poder distingui-lo (a
// criação da equipe agora usa o mesmo handle "raiz-slug" dos artistas).
export { UsernameEmUsoError };

export async function listarEquipeDoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<UsuarioEquipe[]> {
  const rows = await listarUsuariosEquipe(supabase, workspaceId);
  return rows.map(rowParaUsuario);
}

/**
 * Cria um usuário da equipe — MESMO fluxo dos artistas (sem e-mail):
 *  1. Valida limite do plano.
 *  2. Monta o handle "raiz-slugDaAgência" e checa unicidade global
 *     (artistas + equipe compartilham o mesmo namespace de username).
 *  3. Cria auth user (service_role) com e-mail fake interno + senha
 *     aleatória memorável (Word-Word-NNNN).
 *  4. Insere profile vinculado ao workspace, com `username` preenchido.
 *
 * Devolve o usuário criado (já com `username`) + a senha temporária
 * (exibida UMA vez pro admin repassar junto do login).
 */
export async function criarUsuarioDaEquipe(
  admin: SupabaseClient,
  workspaceId: string,
  planoId: PlanoId,
  input: UsuarioCreateInput
): Promise<{ usuario: UsuarioEquipe; senhaTemporaria: string }> {
  const plano = getPlano(await planoEfetivoParaLimites(admin, workspaceId, planoId));
  const total = await contarUsuariosEquipe(admin, workspaceId);
  if (total >= plano.maxUsuariosAdicionais) {
    throw new LimitePlanoEquipeError(plano.maxUsuariosAdicionais, plano.nome);
  }

  // Valida que TODO artist_id do vínculo pertence a ESTE workspace. O client é
  // admin/service-role (ignora RLS), então sem esta checagem dava pra semear um
  // vínculo cruzando tenant (usuário do workspace A ligado a artista do B).
  for (const artistId of input.artistIds) {
    if (!(await pertenceAoWorkspace(admin, "artists", artistId, workspaceId))) {
      throw new ArtistaForaDoWorkspaceError();
    }
  }

  // Handle = "raiz-slug" (idêntico ao fluxo de artistas). Unicidade
  // checada contra TODOS os profiles (artistas + equipe).
  const slug = await buscarSlugWorkspace(admin, workspaceId);
  const usernameCompleto = montarUsernameCompleto(input.username_raiz, slug);
  if (await usernameJaExiste(admin, usernameCompleto)) {
    throw new UsernameEmUsoError(usernameCompleto);
  }

  const emailFake = montarEmailFake(usernameCompleto);
  const senhaTemporaria = gerarSenhaAleatoria();

  const { data: created, error: errAuth } = await admin.auth.admin.createUser({
    email: emailFake,
    password: senhaTemporaria,
    email_confirm: true,
    user_metadata: { nome: input.nome, username: usernameCompleto },
  });
  if (errAuth || !created.user) {
    throw new Error(errAuth?.message ?? "Falha ao criar usuário no Auth.");
  }

  try {
    const row = await criarProfile(admin, {
      id: created.user.id,
      workspace_id: workspaceId,
      nome: input.nome,
      email: emailFake,
      username: usernameCompleto,
      // Papel neutro: a função real de cada artista vem do vínculo (definida
      // depois na aba Equipe). funcoes vazio (legado). escopo default.
      papel: "produtor",
      escopo: ESCOPO_PADRAO,
      funcoes: {},
      status: "ativo",
      // Membro da equipe nasce com a senha aleatória gerada acima.
      senha_padrao: true,
      senha_padrao_valor: senhaTemporaria,
      // Dados pessoais (opcionais).
      cor: input.cor ?? null,
      pais: input.pais ?? null,
      nome_legal: input.nome_legal ?? null,
      documento_tipo: input.documento_tipo ?? null,
      documento: input.documento ?? null,
      razao_social: input.razao_social ?? null,
      endereco: input.endereco ?? null,
      telefone: input.telefone ?? null,
      data_nascimento: input.data_nascimento ?? null,
      cidade_id: input.cidade_id ?? null,
    });

    // Modelo NOVO — cria um VÍNCULO VAZIO por artista com quem trabalha.
    // O link aparece na aba Equipe do artista, onde o admin define a função
    // (perfil) e as permissões. É a fonte da verdade do acesso.
    for (const artistId of input.artistIds) {
      await upsertVinculo(admin, {
        workspaceId,
        userId: created.user.id,
        artistId,
        perfis: [],
        // Permissões já definidas no modal de criação (se houver); caso
        // contrário o vínculo nasce vazio (definido depois na aba Equipe).
        permissoes: input.permissoes_por_artista?.[artistId] ?? [],
      });
    }

    return { usuario: rowParaUsuario(row), senhaTemporaria };
  } catch (e) {
    // Se algo falhou, remove o auth user pra evitar órfão. Os vínculos
    // (se algum foi criado) ficam órfãos por FK, mas sem profile ninguém
    // loga; limpeza fica pro cascade de remoção.
    await admin.auth.admin
      .deleteUser(created.user.id)
      .catch((err) => console.error("[criarUsuarioDaEquipe] rollback do auth user falhou:", created.user.id, err));
    throw e;
  }
}

export async function atualizarUsuarioDaEquipe(
  admin: SupabaseClient,
  id: string,
  input: UsuarioUpdateInput
): Promise<UsuarioEquipe> {
  // GUARDA PARCIAL: quando o alvo é admin ou artista, esta rota de EQUIPE não
  // pode mexer nos campos SENSÍVEIS de acesso (papel, funções, escopo,
  // ativo/status) — só a conta-mãe governa cargo/privacidade desses papéis.
  // Mas os DADOS PESSOAIS (nome, documento, telefone, endereço, etc.) seguem
  // editáveis. (removerUsuarioDaEquipe/resetarSenhaDoUsuario bloqueiam TOTAL
  // esses papéis; aqui a proteção é só dos campos perigosos.)
  const alvo = await buscarProfile(admin, id);
  const protegido = alvo?.papel === "admin" || alvo?.papel === "artista";

  const patch: Parameters<typeof atualizarProfile>[2] = {};
  if (input.nome !== undefined) patch.nome = input.nome;
  if (!protegido) {
    if (input.papel !== undefined) patch.papel = input.papel;
    if (input.escopo !== undefined) patch.escopo = input.escopo;
    if (input.funcoes !== undefined) patch.funcoes = input.funcoes;
    if (input.ativo !== undefined) patch.status = input.ativo ? "ativo" : "bloqueado";
  }
  if (input.pode_criar_anotacoes !== undefined)
    patch.pode_criar_anotacoes = input.pode_criar_anotacoes;
  // Dados pessoais (opcionais) — servem para contrato.
  if (input.cor !== undefined) patch.cor = input.cor;
  if (input.pais !== undefined) patch.pais = input.pais;
  if (input.nome_legal !== undefined) patch.nome_legal = input.nome_legal;
  if (input.documento_tipo !== undefined) patch.documento_tipo = input.documento_tipo;
  if (input.documento !== undefined) patch.documento = input.documento;
  if (input.razao_social !== undefined) patch.razao_social = input.razao_social;
  if (input.endereco !== undefined) patch.endereco = input.endereco;
  if (input.telefone !== undefined) patch.telefone = input.telefone;
  if (input.data_nascimento !== undefined) patch.data_nascimento = input.data_nascimento;
  if (input.cidade_id !== undefined) patch.cidade_id = input.cidade_id;
  const row = await atualizarProfile(admin, id, patch);
  return rowParaUsuario(row);
}

/**
 * Soft delete: move pra lixeira. Mantém o auth user por 30 dias (login
 * é bloqueado via check no auth-context). Apagado definitivamente pelo
 * pg_cron após 30 dias.
 */
export async function removerUsuarioDaEquipe(
  admin: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  const atual = await buscarProfile(admin, id);
  if (!atual) return;
  if (atual.papel === "admin" || atual.papel === "artista") {
    throw new Error("Este usuário não pode ser removido por esta rota.");
  }
  await moverProfileParaLixeira(admin, id, deletadoPor);
}

/**
 * Reseta a senha de um usuário. Devolve a nova senha temporária pra UI
 * exibir (uma única vez).
 */
export async function resetarSenhaDoUsuario(
  admin: SupabaseClient,
  id: string
): Promise<{ senhaTemporaria: string }> {
  const atual = await buscarProfile(admin, id);
  if (!atual) throw new Error("Usuário não encontrado.");
  if (atual.papel === "admin" || atual.papel === "artista") {
    throw new Error("Use a aba Segurança para alterar a própria senha.");
  }
  const senhaTemporaria = gerarSenhaAleatoria();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: senhaTemporaria,
  });
  if (error) throw new Error(error.message ?? "Falha ao resetar senha.");
  // Volta o flag pra "padrão" + guarda nova senha em plaintext. Não
  // bloqueia em caso de erro (a senha já foi resetada no auth com
  // sucesso).
  await admin
    .from("profiles")
    .update({ senha_padrao: true, senha_padrao_valor: senhaTemporaria })
    .eq("id", id);
  return { senhaTemporaria };
}
