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
      papel: input.papel,
      escopo: input.escopo,
      funcoes: input.funcoes,
      status: "ativo",
      // Membro da equipe nasce com a senha aleatória gerada acima.
      senha_padrao: true,
      senha_padrao_valor: senhaTemporaria,
    });
    return { usuario: rowParaUsuario(row), senhaTemporaria };
  } catch (e) {
    // Se o profile não pôde ser criado, remove o auth user pra evitar órfão.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    throw e;
  }
}

export async function atualizarUsuarioDaEquipe(
  admin: SupabaseClient,
  id: string,
  input: UsuarioUpdateInput
): Promise<UsuarioEquipe> {
  const patch: Parameters<typeof atualizarProfile>[2] = {};
  if (input.nome !== undefined) patch.nome = input.nome;
  if (input.papel !== undefined) patch.papel = input.papel;
  if (input.escopo !== undefined) patch.escopo = input.escopo;
  if (input.funcoes !== undefined) patch.funcoes = input.funcoes;
  if (input.ativo !== undefined) patch.status = input.ativo ? "ativo" : "bloqueado";
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
  id: string
): Promise<void> {
  const atual = await buscarProfile(admin, id);
  if (!atual) return;
  if (atual.papel === "admin" || atual.papel === "artista") {
    throw new Error("Este usuário não pode ser removido por esta rota.");
  }
  await moverProfileParaLixeira(admin, id);
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
