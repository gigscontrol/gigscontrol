import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlano, precoPorMes, type PlanoId, type CicloCobranca } from "@/lib/planos";
import type {
  Assinatura,
  StatusAssinatura,
  UsuarioPlataforma,
  StatusUsuario,
} from "@/lib/plataforma";

/**
 * Camada de leitura/escrita da plataforma — usada pelo painel super-admin.
 * Sempre recebe um `admin` (cliente service_role) e atravessa workspaces.
 */

// ============================================================
// Tipos brutos do banco
// ============================================================

type WorkspaceRow = {
  id: string;
  nome: string;
  plano: PlanoId;
  ciclo: CicloCobranca;
  status: string;
  criado_em: string;
};

type ProfileRow = {
  id: string;
  workspace_id: string | null;
  nome: string;
  email: string;
  papel: UsuarioPlataforma["papel"];
  is_super_admin: boolean;
  status: string;
  criado_em: string | null;
  deletado_em: string | null;
};

function statusAssinaturaValido(s: string | null | undefined): StatusAssinatura {
  if (s === "ativa" || s === "trial" || s === "suspensa" || s === "cancelada") return s;
  return "ativa";
}

function statusUsuarioValido(s: string | null | undefined): StatusUsuario {
  if (s === "ativo" || s === "bloqueado" || s === "desativado") return s;
  return "ativo";
}

/**
 * Calcula a próxima cobrança a partir de `criado_em + ciclo`.
 * Avança em intervalos do ciclo até passar da data atual.
 */
function calcularProximaCobranca(criadoEm: string, ciclo: CicloCobranca): string {
  const inicio = new Date(criadoEm);
  const agora = new Date();
  const passo = ciclo === "anual" ? 12 : 1;
  const proxima = new Date(inicio);
  while (proxima <= agora) {
    proxima.setMonth(proxima.getMonth() + passo);
  }
  return proxima.toISOString().slice(0, 10);
}

/** Estado de acesso efetivo (mesma regra da rota /api/workspace/onboarding). */
function estadoAcesso(
  status: string,
  trialTerminaEm: string | null
): "ok" | "graca" | "bloqueado" {
  const agora = Date.now();
  const prazo = trialTerminaEm ? new Date(trialTerminaEm).getTime() : null;
  if (status === "ativa") return "ok";
  if (status === "suspended" || status === "cancelled") return "bloqueado";
  if (status === "trial") {
    if (!prazo || agora <= prazo) return "ok";
    if (agora <= prazo + 86_400_000) return "graca";
    return "bloqueado";
  }
  if (status === "graca") return prazo && agora <= prazo ? "graca" : "bloqueado";
  return "ok";
}

/** Status interno da subscription → rótulo exibido no painel. */
function statusAdmin(
  subStatus: string,
  trialTerminaEm: string | null
): StatusAssinatura {
  const e = estadoAcesso(subStatus, trialTerminaEm);
  if (subStatus === "ativa") return "ativa";
  if (subStatus === "trial") return e === "ok" ? "trial" : "suspensa"; // trial expirado
  if (subStatus === "cancelled") return "cancelada";
  return "suspensa"; // graca / suspended / desconhecido
}

/** Dias restantes até o prazo relevante. Negativo = expirado. */
function diasRestantes(
  subStatus: string,
  trialTerminaEm: string | null,
  proximaCobranca: string | null
): number | null {
  let alvo: string | null = null;
  if (subStatus === "ativa") alvo = proximaCobranca;
  else if (subStatus === "trial" || subStatus === "graca") alvo = trialTerminaEm;
  if (!alvo) return null;
  return Math.ceil((new Date(alvo).getTime() - Date.now()) / 86_400_000);
}

// ============================================================
// Assinaturas (= workspaces + contagens)
// ============================================================

export async function listarAssinaturas(
  admin: SupabaseClient
): Promise<Assinatura[]> {
  // Workspaces
  const { data: workspaces, error: errWs } = await admin
    .from("workspaces")
    .select("id, nome, plano, ciclo, status, criado_em")
    .order("criado_em", { ascending: false });
  if (errWs) throw errWs;

  // Profiles ativos (não-deletados, não-super-admin)
  const { data: profiles, error: errProf } = await admin
    .from("profiles")
    .select("id, workspace_id, nome, email, papel, is_super_admin, status, deletado_em")
    .is("deletado_em", null);
  if (errProf) throw errProf;

  // Artistas ativos
  const { data: artists, error: errArt } = await admin
    .from("artists")
    .select("id, workspace_id, deletado_em")
    .is("deletado_em", null);
  if (errArt) throw errArt;

  // Subscriptions — fonte REAL de status/datas (o app gateia por ela).
  const { data: subs } = await admin
    .from("subscriptions")
    .select("workspace_id, status, ciclo, inicio_em, trial_termina_em, proxima_cobranca");
  const subByWs = new Map<
    string,
    {
      status: string;
      ciclo: string | null;
      inicio_em: string | null;
      trial_termina_em: string | null;
      proxima_cobranca: string | null;
    }
  >();
  for (const s of subs ?? []) subByWs.set(s.workspace_id, s);

  const profilesByWs = new Map<string, typeof profiles>();
  for (const p of profiles ?? []) {
    if (!p.workspace_id) continue;
    const arr = profilesByWs.get(p.workspace_id) ?? [];
    arr.push(p);
    profilesByWs.set(p.workspace_id, arr);
  }

  const artistasCount = new Map<string, number>();
  for (const a of artists ?? []) {
    if (!a.workspace_id) continue;
    artistasCount.set(a.workspace_id, (artistasCount.get(a.workspace_id) ?? 0) + 1);
  }

  const assinaturas: Assinatura[] = (workspaces ?? []).map((w: WorkspaceRow) => {
    const ws = profilesByWs.get(w.id) ?? [];
    const dono = ws.find((p) => p.papel === "admin" && !p.is_super_admin);
    const usuariosEquipe = ws.filter(
      (p) => p.papel !== "admin" && p.papel !== "artista"
    );
    const sub = subByWs.get(w.id);
    const subStatus = sub?.status ?? null;
    const trialEm = sub?.trial_termina_em ?? null;
    // Data exibida como "próximo pagamento":
    //  - ativa       → data real do Stripe, ou projeção pelo ciclo (conta sem Stripe)
    //  - trial/graça → o prazo (trial_termina_em)
    //  - suspensa/cancelada → null ("—")
    let proxima: string | null = null;
    if (subStatus === "ativa") {
      proxima =
        sub?.proxima_cobranca ??
        calcularProximaCobranca(
          sub?.inicio_em ?? w.criado_em,
          (sub?.ciclo as CicloCobranca) ?? w.ciclo
        );
    } else if (subStatus === "trial" || subStatus === "graca") {
      proxima = sub?.proxima_cobranca ?? (trialEm ? trialEm.slice(0, 10) : null);
    }
    return {
      workspaceId: w.id,
      nomeWorkspace: w.nome,
      responsavel: dono?.nome ?? "—",
      email: dono?.email ?? "",
      plano: w.plano,
      ciclo: (sub?.ciclo as CicloCobranca) ?? w.ciclo,
      // Status/dias vêm da subscription real; sem sub, cai no campo do workspace.
      status: subStatus ? statusAdmin(subStatus, trialEm) : statusAssinaturaValido(w.status),
      diasRestantes: subStatus ? diasRestantes(subStatus, trialEm, proxima) : null,
      artistasEmUso: artistasCount.get(w.id) ?? 0,
      usuariosEmUso: usuariosEquipe.length,
      inicioEm: w.criado_em.slice(0, 10),
      proximaCobranca: proxima,
    };
  });

  return assinaturas;
}

const STATUS_INTERNO: Record<StatusAssinatura, string> = {
  ativa: "ativa",
  trial: "trial",
  suspensa: "suspended",
  cancelada: "cancelled",
};

export async function alterarStatusAssinatura(
  admin: SupabaseClient,
  workspaceId: string,
  status: StatusAssinatura
): Promise<void> {
  const interno = STATUS_INTERNO[status];
  const patch: Record<string, unknown> = { status: interno };
  if (status === "ativa") patch.trial_termina_em = null;
  // "Marcar teste" pelo painel = teste fresco de 7 dias.
  if (status === "trial") {
    patch.trial_termina_em = new Date(Date.now() + 7 * 86_400_000).toISOString();
  }
  // Fonte da verdade = subscriptions (é o que o app olha pra liberar o acesso).
  const { error } = await admin
    .from("subscriptions")
    .update(patch)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  // Espelha no workspace (compat com código legado que ainda leia w.status).
  await admin.from("workspaces").update({ status: interno }).eq("id", workspaceId);
}

/**
 * Dá dias grátis: estende o acesso setando a assinatura como `trial` com novo
 * prazo. Soma a partir do maior entre AGORA e o prazo atual (não perde os dias
 * que ainda restam). É um comp LOCAL — não mexe no Stripe.
 */
export async function estenderDiasAssinatura(
  admin: SupabaseClient,
  workspaceId: string,
  dias: number
): Promise<void> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("trial_termina_em")
    .eq("workspace_id", workspaceId)
    .maybeSingle<{ trial_termina_em: string | null }>();
  const agora = Date.now();
  const atual = sub?.trial_termina_em ? new Date(sub.trial_termina_em).getTime() : 0;
  const base = Math.max(agora, atual);
  const novo = new Date(base + dias * 86_400_000).toISOString();
  const { error } = await admin
    .from("subscriptions")
    .update({ status: "trial", trial_termina_em: novo })
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  await admin.from("workspaces").update({ status: "trial" }).eq("id", workspaceId);
}

export async function alterarPlanoAssinatura(
  admin: SupabaseClient,
  workspaceId: string,
  plano: PlanoId
): Promise<void> {
  const { error } = await admin
    .from("workspaces")
    .update({ plano })
    .eq("id", workspaceId);
  if (error) throw error;
}

// ============================================================
// Usuários da plataforma
// ============================================================

export async function listarUsuariosPlataforma(
  admin: SupabaseClient
): Promise<UsuarioPlataforma[]> {
  // Profiles ativos (excluindo lixeira e super-admin)
  const { data: profiles, error: errProf } = await admin
    .from("profiles")
    .select(
      "id, workspace_id, nome, email, papel, is_super_admin, status, criado_em, deletado_em"
    )
    .eq("is_super_admin", false)
    .is("deletado_em", null);
  if (errProf) throw errProf;

  // Workspaces para mapear nome
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, nome");
  const wsNome = new Map<string, string>();
  for (const w of workspaces ?? []) wsNome.set(w.id, w.nome);

  // last_sign_in_at via admin auth API
  const lastSignInById = new Map<string, string>();
  try {
    // listUsers retorna paginado; pegamos as primeiras páginas (max 1000 users)
    const { data: pageOne } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of pageOne?.users ?? []) {
      if (u.last_sign_in_at) lastSignInById.set(u.id, u.last_sign_in_at);
    }
  } catch {
    // se falhar, last_sign_in fica vazio — não bloqueia
  }

  return (profiles ?? []).map((p: ProfileRow) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    workspaceId: p.workspace_id ?? "",
    nomeWorkspace: p.workspace_id ? wsNome.get(p.workspace_id) ?? "—" : "—",
    papel: p.papel,
    status: statusUsuarioValido(p.status),
    ultimoAcesso: lastSignInById.get(p.id) ?? "",
    criadoEm: (p.criado_em ?? "").slice(0, 10),
  }));
}

export async function alterarStatusUsuario(
  admin: SupabaseClient,
  usuarioId: string,
  status: StatusUsuario
): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ status })
    .eq("id", usuarioId);
  if (error) throw error;
}

// ============================================================
// KPIs do dashboard
// ============================================================

export type KpisPlataforma = {
  mrr: number;
  arr: number;
  totalUsuarios: number;
  agencias: number;
  totalArtistas: number;
  /** Usuários com last_sign_in_at nos últimos 30 dias. */
  ativos30d: number;
};

export async function kpisPlataforma(
  admin: SupabaseClient
): Promise<KpisPlataforma> {
  const assinaturas = await listarAssinaturas(admin);
  const ativas = assinaturas.filter((a) => a.status === "ativa");

  let mrr = 0;
  for (const a of ativas) mrr += precoPorMes(getPlano(a.plano), a.ciclo);

  const agencias = assinaturas.filter((a) =>
    ["equipe", "time", "agencia", "agencia-plus", "agencia-max"].includes(a.plano)
  ).length;

  const totalArtistas = assinaturas.reduce((s, a) => s + a.artistasEmUso, 0);
  const totalUsuarios = assinaturas.reduce(
    (s, a) => s + a.usuariosEmUso + 1, // +1 admin do workspace
    0
  );

  // ativos30d via last_sign_in_at
  let ativos30d = 0;
  try {
    const { data: pageOne } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const u of pageOne?.users ?? []) {
      if (u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() >= limite) {
        ativos30d++;
      }
    }
  } catch {
    // ignore
  }

  return { mrr, arr: mrr * 12, totalUsuarios, agencias, totalArtistas, ativos30d };
}
