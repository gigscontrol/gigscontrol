import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanoId, CicloCobranca } from "@/lib/planos";
import { moedaAgenciaDe } from "@/lib/regiao";

/**
 * Gera um slug a partir do nome (lowercase, sem acentos, só letras
 * e números) e garante unicidade global checando contra `workspaces.slug`.
 * Se já em uso, adiciona sufixo numérico (twobookings, twobookings2, ...).
 */
async function gerarSlugUnico(
  admin: SupabaseClient,
  nome: string
): Promise<string> {
  // Normaliza: NFD pra separar acentos, remove combining marks, lowercase
  // e mantém só [a-z0-9]
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const semente = base || "agencia";

  for (let i = 0; i < 100; i++) {
    const tentativa = i === 0 ? semente : `${semente}${i + 1}`;
    const { data } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", tentativa)
      .maybeSingle();
    if (!data) return tentativa;
  }
  // Fallback extremo: random
  return `${semente}${Math.random().toString(36).slice(2, 8)}`;
}

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
  ciclo_escolhido?: CicloCobranca;
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
  },
  /** País do IP no cadastro (ISO2) — define a moeda padrão da agência, invisível. */
  paisIso?: string | null
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
  // Ciclo escolhido na vitrine (mensal|anual). Valida o valor: só aceita
  // "anual", senão cai em "mensal".
  const cicloId: CicloCobranca =
    (meta.ciclo_escolhido as CicloCobranca) === "anual" ? "anual" : "mensal";

  // 2. Gera slug único a partir do nome da agência (workspaces.slug é
  //    NOT NULL desde a migração 21). Se já estiver em uso, adiciona
  //    sufixo 2, 3, ... até achar livre.
  const slug = await gerarSlugUnico(admin, nomeAgencia);

  // 3. Cria workspace
  // Status inicial: 'trial' (precisa passar pelo /pagamento). Não pode ser
  // 'ativo' (constraint só aceita 'ativa'/'trial'/'suspensa'/'cancelada').
  const { data: workspace, error: errWs } = await admin
    .from("workspaces")
    .insert({
      nome: nomeAgencia,
      plano: planoId,
      slug,
      status: "trial",
      ciclo: cicloId,
      // Moeda padrão pela região do IP (invisível): BR→BRL, Américas→USD,
      // Europa→EUR, resto→USD. O admin troca depois em Preferências.
      moeda: moedaAgenciaDe(paisIso),
    })
    .select("id")
    .single();
  if (errWs || !workspace) {
    throw new Error(`Falha ao criar workspace: ${errWs?.message ?? "?"}`);
  }

  // 3. Cria profile vinculado, papel = admin (dono da conta). NÃO grava
  // escopo/funcoes (legado morto) — as colunas são NOT NULL default '{}' no
  // banco, então o default cobre. Admin passa em tudo pelo motor de qualquer
  // forma.
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
