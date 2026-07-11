import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contrato, ContratoStatus } from "@/lib/mappers/contrato";
import { rowParaContrato, type ContratoEscrita } from "@/lib/mappers/contrato";
import { resumoAssinantesDoWorkspace } from "@/lib/services/contratoSignatarios.service";
import { listarVendasDoWorkspace } from "@/lib/services/vendas.service";
import {
  listarContratos as repoListar,
  buscarContrato as repoBuscar,
  criarContrato as repoCriar,
  atualizarContrato as repoAtualizar,
  removerContrato as repoRemover,
  proximoNumeroContrato,
  contarContratosDesde,
} from "@/lib/repositories/contratos.repo";
import { buscarVenda, escoposDeVendas } from "@/lib/repositories/vendas.repo";
import type {
  ContratoCreateInput,
  ContratoUpdateInput,
} from "@/lib/validators/contratos.schema";
import { getPlano, type PlanoId } from "@/lib/planos";
import { janelaDoCicloISO } from "@/lib/services/cicloLimite";
import type { SessaoAutenticada } from "@/lib/api/session";
import { verTodosContratos, podeVerContrato } from "@/lib/api/permissoes";

/**
 * Resolve o ARTISTA de um contrato pela venda vinculada (contrato → venda →
 * vendas.artist_id). Contrato avulso (venda_id NULL) → sem artista → null
 * (admin-only). O "dono" para o escopo "só os que ele criou" NÃO sai daqui —
 * vem de `contratos.criado_por` (o criador real do contrato, não o vendedor da
 * venda). Usado pelas rotas [id]/signatários pra gatear por artista.
 */
export async function resolverEscopoContrato(
  supabase: SupabaseClient,
  vendaId: string | null
): Promise<{ artistId: string | null }> {
  if (!vendaId) return { artistId: null };
  const venda = await buscarVenda(supabase, vendaId);
  return { artistId: venda?.artist_id ?? null };
}

/**
 * Limite mensal de contratos do plano atingido (espelha LimitePlanoEquipeError).
 * A rota traduz pra HTTP 409.
 */
export class LimiteContratosError extends Error {
  status = 409;
  constructor(public limite: number, public plano: string) {
    super(
      `Limite de ${limite} contratos no mês atingido no plano ${plano}. Faça upgrade ou aguarde o próximo mês.`
    );
    this.name = "LimiteContratosError";
  }
}

function entradaParaEscrita(
  input: ContratoCreateInput | ContratoUpdateInput
): ContratoEscrita {
  const out: ContratoEscrita = {};
  if (input.venda_id !== undefined) out.venda_id = input.venda_id ?? null;
  if (input.modelo_id !== undefined) out.modelo_id = input.modelo_id ?? null;
  if (input.status !== undefined) out.status = input.status;
  if (input.corpo_preenchido !== undefined)
    out.corpo_preenchido = input.corpo_preenchido ?? null;
  if (input.local_assinatura !== undefined)
    out.local_assinatura = input.local_assinatura ?? null;
  if (input.data_emissao !== undefined)
    out.data_emissao = input.data_emissao ?? null;
  if (input.data_assinatura !== undefined)
    out.data_assinatura = input.data_assinatura ?? null;
  if (input.observacoes !== undefined)
    out.observacoes = input.observacoes ?? null;
  if (input.pasta_id !== undefined) out.pasta_id = input.pasta_id ?? null;
  return out;
}

export async function listarContratosDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Contrato[]> {
  const rows = await repoListar(supabase);
  // Sem sessão OU quem vê tudo (admin/super/legado) → lista completa.
  if (!sessao || verTodosContratos(sessao)) return rows.map(rowParaContrato);
  // Caso contrário (artista OU operacional com vínculo): filtra por artista
  // visível, resolvido via a venda de cada contrato (batch). Avulso → admin-only.
  const vendaIds = Array.from(
    new Set(rows.map((r) => r.venda_id).filter((v): v is string => !!v))
  );
  const escopos = await escoposDeVendas(supabase, vendaIds);
  const visiveis = rows.filter((r) => {
    const artistId = r.venda_id ? escopos.get(r.venda_id)?.artistId ?? null : null;
    return podeVerContrato(sessao, artistId);
  });
  return visiveis.map(rowParaContrato);
}

export async function buscarContratoPorId(
  supabase: SupabaseClient,
  id: string
): Promise<Contrato | null> {
  const row = await repoBuscar(supabase, id);
  return row ? rowParaContrato(row) : null;
}

export async function criarContratoNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  planoId: PlanoId,
  input: ContratoCreateInput,
  /** Quem cria (r.sessao.userId) — grava `criado_por` p/ o escopo "só os que ele criou". */
  criadoPor?: string,
  /** true = pula a checagem de limite (usado após pagar o contrato excedente). */
  pularLimite = false
): Promise<Contrato> {
  const plano = getPlano(planoId);
  if (!pularLimite) {
    const usadosNoCiclo = await contarContratosDesde(
      supabase,
      workspaceId,
      await janelaDoCicloISO(workspaceId)
    );
    if (usadosNoCiclo >= plano.maxContratosMes) {
      throw new LimiteContratosError(plano.maxContratosMes, plano.nome);
    }
  }

  const escrita = entradaParaEscrita(input);
  if (criadoPor) escrita.criado_por = criadoPor;
  escrita.numero = await proximoNumeroContrato(supabase, workspaceId);
  escrita.status = escrita.status ?? "rascunho";
  if (!escrita.data_emissao)
    escrita.data_emissao = new Date().toISOString().slice(0, 10);
  const row = await repoCriar(supabase, workspaceId, escrita);
  return rowParaContrato(row);
}

export async function atualizarContratoPorId(
  supabase: SupabaseClient,
  id: string,
  input: ContratoUpdateInput
): Promise<Contrato> {
  const row = await repoAtualizar(supabase, id, entradaParaEscrita(input));
  return rowParaContrato(row);
}

export async function removerContratoPorId(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await repoRemover(supabase, id, deletadoPor);
}

/**
 * Resumo (KPIs) do dashboard de contratos, computado NO SERVIDOR — o passo 1 da
 * paginação: o cliente recebe só os números + as listinhas curtas, não o array
 * inteiro de contratos.
 *
 * CORRETO POR CONSTRUÇÃO: reusa EXATAMENTE o mesmo caminho de escopo que a
 * listagem (`listarContratosDoWorkspace`) e as MESMAS fórmulas do
 * DashboardContratos, só que aqui. Por isso os números batem 1:1 com o que o
 * dashboard mostra hoje.
 *
 * Período: [inicio, fim] em ISO (instantes). Ambos null = "Visão geral" (tudo).
 * O cliente resolve o mês/atalho pra esses limites e envia.
 *
 * NOTA DE ESCALA: nesta fase ainda carrega as listas escopadas no servidor
 * (contratos/vendas/assinantes) pra garantir paridade exata. Trocar por COUNT/
 * SUM em SQL é um follow-up que NÃO muda o contrato deste endpoint.
 */
export type ContratosResumo = {
  /** Total de contratos NO PERÍODO. */
  total: number;
  /** Total de contratos SEM filtro de período (pro empty-state "nenhum ainda"). */
  totalGeral: number;
  porStatus: Record<ContratoStatus, number>;
  taxa: number;
  aguardando: number;
  vendasSemContrato: number;
  recentes: Contrato[];
  listaPorStatus: Record<ContratoStatus, Contrato[]>;
};

export async function resumoContratosDoWorkspace(
  supabase: SupabaseClient,
  // Mesma sessão estreitada que `autenticarComWorkspace` devolve (workspaceId
  // garantido). resumoAssinantesDoWorkspace exige o id como string.
  sessao: SessaoAutenticada & { workspaceId: string },
  inicio: string | null,
  fim: string | null
): Promise<ContratosResumo> {
  const [contratos, assinantes, vendas] = await Promise.all([
    listarContratosDoWorkspace(supabase, sessao),
    resumoAssinantesDoWorkspace(supabase, sessao.workspaceId),
    listarVendasDoWorkspace(supabase, sessao),
  ]);

  const ini = inicio ? new Date(inicio).getTime() : null;
  const f = fim ? new Date(fim).getTime() : null;
  const noPeriodo = (iso: string | null | undefined): boolean => {
    if (ini === null && f === null) return true; // Visão geral
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    if (ini !== null && t < ini) return false;
    if (f !== null && t > f) return false;
    return true;
  };

  const contratosPeriodo = contratos.filter((c) => noPeriodo(c.criadoEm));
  const ordenados = [...contratosPeriodo].sort((a, b) =>
    b.criadoEm.localeCompare(a.criadoEm)
  );

  const porStatus: Record<ContratoStatus, number> = {
    rascunho: 0,
    enviado: 0,
    assinado: 0,
    cancelado: 0,
  };
  const listaPorStatus: Record<ContratoStatus, Contrato[]> = {
    rascunho: [],
    enviado: [],
    assinado: [],
    cancelado: [],
  };
  for (const c of ordenados) {
    porStatus[c.status] += 1;
    // Só as 5 primeiras por status (o modal do dashboard mostra até 5).
    if (listaPorStatus[c.status].length < 5) listaPorStatus[c.status].push(c);
  }

  const denom = porStatus.enviado + porStatus.assinado;
  const taxa = denom > 0 ? Math.round((porStatus.assinado / denom) * 100) : 0;

  // Aguardando = enviados no período SEM nenhuma assinatura coletada.
  const aguardando = contratosPeriodo.filter(
    (c) =>
      c.status === "enviado" &&
      !(assinantes[c.id] ?? []).some((a) => a.status === "assinado")
  ).length;

  // Vendas do período SEM contrato ativo (não-cancelado) vinculado. O conjunto
  // "com contrato" usa TODOS os contratos (qualquer período), igual ao dashboard.
  const comContrato = new Set(
    contratos
      .filter((c) => c.status !== "cancelado" && c.vendaId)
      .map((c) => c.vendaId)
  );
  const vendasSemContrato = vendas.filter(
    (v) => noPeriodo(v.criadoEm) && !comContrato.has(v.id)
  ).length;

  return {
    total: contratosPeriodo.length,
    totalGeral: contratos.length,
    porStatus,
    taxa,
    aguardando,
    vendasSemContrato,
    recentes: ordenados.slice(0, 5),
    listaPorStatus,
  };
}
