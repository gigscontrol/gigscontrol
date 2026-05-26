import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanoId } from "@/lib/planos";

/**
 * Cria workspace + profile vinculado a um auth user já existente.
 *
 * Chamado quando um usuário acabou de confirmar email pela primeira vez
 * (callback do Supabase). Lê os metadados que foram setados no
 * `supabase.auth.signUp({ options: { data } })` durante o cadastro.
 *
 * Idempotente: se o profile já existe, devolve { criado: false }.
 */
export type DadosSignupMeta = {
  nome?: string;
  nome_agencia?: string;
  plano_escolhido?: PlanoId;
};

export type ResultadoSetup = {
  criado: boolean;
  workspaceId: string;
  profileId: string;
};

export async function setupWorkspaceParaNovoUsuario(
  admin: SupabaseClient,
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown> | null;
  }
): Promise<ResultadoSetup> {
  // 1. Já existe profile? Idempotência.
  const { data: jaTem } = await admin
    .from("profiles")
    .select("id, workspace_id")
    .eq("id", user.id)
    .maybeSingle();
  if (jaTem) {
    return {
      criado: false,
      workspaceId: jaTem.workspace_id as string,
      profileId: jaTem.id as string,
    };
  }

  const meta = (user.user_metadata ?? {}) as DadosSignupMeta;
  const nomeAgencia =
    typeof meta.nome_agencia === "string" && meta.nome_agencia.trim()
      ? meta.nome_agencia.trim()
      : "Minha Agência";
  const nome =
    typeof meta.nome === "string" && meta.nome.trim()
      ? meta.nome.trim()
      : user.email.split("@")[0];
  const planoId: PlanoId =
    (meta.plano_escolhido as PlanoId | undefined) ?? "individual";

  // 2. Cria workspace
  const { data: workspace, error: errWs } = await admin
    .from("workspaces")
    .insert({
      nome: nomeAgencia,
      plano: planoId,
      status: "ativo",
      ciclo: "mensal",
    })
    .select("id")
    .single();
  if (errWs || !workspace) {
    throw new Error(`Falha ao criar workspace: ${errWs?.message ?? "?"}`);
  }

  // 3. Cria profile vinculado, papel = admin (dono da conta)
  const { data: profile, error: errProf } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      workspace_id: workspace.id,
      nome,
      email: user.email,
      papel: "admin",
      is_super_admin: false,
      status: "ativo",
      escopo: {
        verTodosContatos: true,
        verTodasVendas: true,
        editarTodosEventos: true,
      },
      funcoes: {},
    })
    .select("id")
    .single();
  if (errProf || !profile) {
    // Se profile falhar, faz rollback do workspace pra não deixar órfão
    await admin.from("workspaces").delete().eq("id", workspace.id);
    throw new Error(`Falha ao criar profile: ${errProf?.message ?? "?"}`);
  }

  return {
    criado: true,
    workspaceId: workspace.id as string,
    profileId: profile.id as string,
  };
}
