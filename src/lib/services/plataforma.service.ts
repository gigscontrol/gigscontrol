import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlano,
  precoPorMes,
  type PlanoId,
  type CicloCobranca,
  type Moeda,
} from "@/lib/planos";
// Fonte única da regra de acesso (mesma do onboarding e do gate de mutação).
import { estadoAcessoDe as estadoAcesso } from "@/lib/acesso";
// Moeda de cobrança derivada do país do workspace (mesma regra do checkout).
import { regiaoDe } from "@/lib/regiao";
import { concederDiasCortesia } from "@/lib/services/pagamentos.service";
import type {
  Assinatura,
  StatusAssinatura,
  UsuarioPlataforma,
  StatusUsuario,
  UltimoPagamento,
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
  pais_padrao: string | null;
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
 * Status interno da subscription (+ validade) → rótulo exibido no painel.
 *
 * MODELO PRÉ-PAGO: deriva de `acesso_ate` via `estadoAcessoDe` (mesma fonte
 * do gate de acesso). 'suspended'/'cancelled' mandam sempre — mesmo com
 * validade futura restante (ver `estadoAcessoDe`).
 */
function statusAdmin(subStatus: string, acessoAte: string | null): StatusAssinatura {
  if (subStatus === "suspended") return "suspensa";
  if (subStatus === "cancelled") return "cancelada";
  const e = estadoAcesso(subStatus, acessoAte);
  if (e === "bloqueado") return "suspensa"; // validade vencida além da graça
  return "ativa"; // 'ok' ou 'graca' → acesso liberado
}

/** Dias restantes até `acesso_ate`. Negativo = expirado (ainda em graça). */
function diasRestantes(acessoAte: string | null): number | null {
  if (!acessoAte) return null;
  return Math.ceil((new Date(acessoAte).getTime() - Date.now()) / 86_400_000);
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
    .select("id, nome, plano, ciclo, status, criado_em, pais_padrao")
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

  // Subscriptions — fonte REAL de status/validade (o app gateia por ela).
  const { data: subs } = await admin
    .from("subscriptions")
    .select("workspace_id, status, ciclo, inicio_em, acesso_ate");
  const subByWs = new Map<
    string,
    {
      status: string;
      ciclo: string | null;
      inicio_em: string | null;
      acesso_ate: string | null;
    }
  >();
  for (const s of subs ?? []) subByWs.set(s.workspace_id, s);

  // Último pagamento por workspace (ledger `pagamentos` — migração 84).
  // Ordena desc e pega o primeiro de cada workspace na varredura.
  const { data: pagamentos } = await admin
    .from("pagamentos")
    .select("workspace_id, provider, metodo, valor, moeda, criado_em")
    .order("criado_em", { ascending: false });
  const ultimoPagamentoByWs = new Map<string, UltimoPagamento>();
  for (const pg of pagamentos ?? []) {
    if (ultimoPagamentoByWs.has(pg.workspace_id)) continue; // já achou o mais recente
    ultimoPagamentoByWs.set(pg.workspace_id, {
      data: pg.criado_em,
      provider: pg.provider as UltimoPagamento["provider"],
      metodo: pg.metodo,
      valor: pg.valor,
      moeda: pg.moeda as Moeda | null,
    });
  }

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
    const acessoAte = sub?.acesso_ate ?? null;
    return {
      workspaceId: w.id,
      nomeWorkspace: w.nome,
      responsavel: dono?.nome ?? "—",
      email: dono?.email ?? "",
      plano: w.plano,
      ciclo: (sub?.ciclo as CicloCobranca) ?? w.ciclo,
      moeda: regiaoDe(w.pais_padrao).moeda,
      // Status/dias vêm da subscription real; sem sub, cai no campo do workspace.
      status: subStatus ? statusAdmin(subStatus, acessoAte) : statusAssinaturaValido(w.status),
      diasRestantes: subStatus ? diasRestantes(acessoAte) : null,
      artistasEmUso: artistasCount.get(w.id) ?? 0,
      usuariosEmUso: usuariosEquipe.length,
      inicioEm: w.criado_em.slice(0, 10),
      acessoAte,
      ultimoPagamento: ultimoPagamentoByWs.get(w.id) ?? null,
    };
  });

  return assinaturas;
}

// ============================================================
// Receita realizada (substitui MRR/ARR projetado)
// ============================================================

export type ReceitaRealizada = {
  /** Soma de `pagamentos.valor` (centavos) nos últimos 30 dias, por moeda. */
  ultimos30dBrl: number;
  ultimos30dUsd: number;
  /** Soma de `pagamentos.valor` (centavos) nos últimos 12 meses, por moeda. */
  ultimos12mBrl: number;
  ultimos12mUsd: number;
  /** Workspaces com validade futura (acesso_ate > agora). */
  workspacesComValidadeFutura: number;
};

/**
 * Receita REALIZADA (não projetada): soma `pagamentos.valor` de pagamentos
 * reais (stripe/mercadopago — exclui 'cortesia' e 'cupom', que não são
 * receita: mês grátis) no período, por moeda. Substitui o antigo MRR/ARR
 * projetado por ciclo.
 */
export async function receitaRealizada(
  admin: SupabaseClient
): Promise<ReceitaRealizada> {
  const agora = Date.now();
  const desde30d = new Date(agora - 30 * 86_400_000).toISOString();
  const desde12m = new Date(agora - 365 * 86_400_000).toISOString();

  const { data: pagamentos } = await admin
    .from("pagamentos")
    .select("valor, moeda, provider, criado_em")
    .not("provider", "in", "(cortesia,cupom)")
    .gte("criado_em", desde12m);

  let ultimos30dBrl = 0;
  let ultimos30dUsd = 0;
  let ultimos12mBrl = 0;
  let ultimos12mUsd = 0;
  for (const pg of pagamentos ?? []) {
    const valor = pg.valor ?? 0;
    const usd = pg.moeda === "usd";
    if (usd) ultimos12mUsd += valor;
    else ultimos12mBrl += valor;
    if (pg.criado_em >= desde30d) {
      if (usd) ultimos30dUsd += valor;
      else ultimos30dBrl += valor;
    }
  }

  const { count: workspacesComValidadeFutura } = await admin
    .from("subscriptions")
    .select("workspace_id", { count: "exact", head: true })
    .gt("acesso_ate", new Date(agora).toISOString());

  return {
    ultimos30dBrl,
    ultimos30dUsd,
    ultimos12mBrl,
    ultimos12mUsd,
    workspacesComValidadeFutura: workspacesComValidadeFutura ?? 0,
  };
}

/** Histórico de pagamentos de um workspace (ledger `pagamentos`), mais recentes primeiro. */
export type HistoricoPagamento = {
  id: string;
  data: string;
  provider: "stripe" | "mercadopago" | "cortesia" | "cupom";
  metodo: string | null;
  valor: number | null;
  moeda: Moeda | null;
  dias: number;
  plano: string | null;
  ciclo: string | null;
};

export async function historicoPagamentos(
  admin: SupabaseClient,
  workspaceId: string
): Promise<HistoricoPagamento[]> {
  const { data, error } = await admin
    .from("pagamentos")
    .select("id, criado_em, provider, metodo, valor, moeda, dias_concedidos, plano, ciclo")
    .eq("workspace_id", workspaceId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    data: p.criado_em,
    provider: p.provider as HistoricoPagamento["provider"],
    metodo: p.metodo,
    valor: p.valor,
    moeda: p.moeda as Moeda | null,
    dias: p.dias_concedidos,
    plano: p.plano,
    ciclo: p.ciclo,
  }));
}

/**
 * MODELO PRÉ-PAGO: o painel só liga/desliga o acesso manualmente — não seta
 * mais 'trial'/'ativa' (isso é derivado de `acesso_ate`, ver `statusAdmin`).
 *
 *  - 'suspensa'  → status='suspended' na subscription: bloqueia NA HORA,
 *                  mesmo com validade futura restante (ver `estadoAcessoDe`).
 *  - 'ativa'     → "reativar": limpa o status pra 'ativa' e deixa o ACESSO
 *                  REAL voltar a ser ditado por `acesso_ate` (se já venceu,
 *                  volta bloqueado; se ainda tem validade, volta liberado).
 *  - 'cancelada' → status='cancelled': bloqueia sempre (chargeback/cancelamento).
 *  - 'trial'     → não é mais um estado que o painel escreve (deixa de existir
 *                  como ação; `statusAdmin` nunca devolve 'trial' pra sub real).
 */
export async function alterarStatusAssinatura(
  admin: SupabaseClient,
  workspaceId: string,
  status: StatusAssinatura
): Promise<void> {
  const interno =
    status === "suspensa" ? "suspended" : status === "cancelada" ? "cancelled" : "ativa";
  // Fonte da verdade = subscriptions (é o que o app olha pra liberar o acesso).
  const { error } = await admin
    .from("subscriptions")
    .update({ status: interno })
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  // Espelha no workspace (compat com código legado que ainda leia w.status).
  await admin.from("workspaces").update({ status: interno }).eq("id", workspaceId);
}

/**
 * Dá dias grátis: soma em `acesso_ate` via `concederDiasCortesia` (RPC
 * idempotente `registrar_pagamento_estender`, migração 84). Fica registrado
 * no ledger `pagamentos` com provider='cortesia' — auditável no histórico.
 * Soma a partir do maior entre AGORA e a validade atual (nunca perde dias).
 */
export async function estenderDiasAssinatura(
  admin: SupabaseClient,
  workspaceId: string,
  dias: number
): Promise<void> {
  await concederDiasCortesia(workspaceId, dias, "cortesia_admin");
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
  /** MRR separado por moeda — não dá pra somar BRL + USD sem câmbio. */
  mrrBrl: number;
  mrrUsd: number;
  arrBrl: number;
  arrUsd: number;
  totalUsuarios: number;
  agencias: number;
  totalArtistas: number;
  /** Usuários com last_sign_in_at nos últimos 30 dias. */
  ativos30d: number;
  /** Contagens reais cross-workspace (todos os tenants, não-deletados). */
  totalShows: number;
  totalContratos: number;
  totalOrcamentos: number;
};

/** Conta linhas não-deletadas de uma tabela em TODOS os workspaces. */
async function contarTabela(admin: SupabaseClient, tabela: string): Promise<number> {
  const { count } = await admin
    .from(tabela)
    .select("*", { count: "exact", head: true })
    .is("deletado_em", null);
  return count ?? 0;
}

export async function kpisPlataforma(
  admin: SupabaseClient
): Promise<KpisPlataforma> {
  const assinaturas = await listarAssinaturas(admin);
  const ativas = assinaturas.filter((a) => a.status === "ativa");

  // Soma o MRR na moeda REAL de cada assinatura (não mistura BRL com USD).
  let mrrBrl = 0;
  let mrrUsd = 0;
  for (const a of ativas) {
    const preco = precoPorMes(getPlano(a.plano), a.ciclo, a.moeda);
    if (a.moeda === "usd") mrrUsd += preco;
    else mrrBrl += preco;
  }

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

  const [totalShows, totalContratos, totalOrcamentos] = await Promise.all([
    contarTabela(admin, "shows"),
    contarTabela(admin, "contratos"),
    contarTabela(admin, "orcamentos"),
  ]);

  return {
    mrrBrl,
    mrrUsd,
    arrBrl: mrrBrl * 12,
    arrUsd: mrrUsd * 12,
    totalUsuarios,
    agencias,
    totalArtistas,
    ativos30d,
    totalShows,
    totalContratos,
    totalOrcamentos,
  };
}
