import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contrato } from "@/lib/mappers/contrato";
import { rowParaContrato, type ContratoEscrita } from "@/lib/mappers/contrato";
import {
  listarContratos as repoListar,
  buscarContrato as repoBuscar,
  criarContrato as repoCriar,
  atualizarContrato as repoAtualizar,
  removerContrato as repoRemover,
  proximoNumeroContrato,
  contarContratosDesde,
} from "@/lib/repositories/contratos.repo";
import type {
  ContratoCreateInput,
  ContratoUpdateInput,
} from "@/lib/validators/contratos.schema";
import { getPlano, type PlanoId } from "@/lib/planos";
import { janelaDoCicloISO } from "@/lib/services/cicloLimite";

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
  supabase: SupabaseClient
): Promise<Contrato[]> {
  const rows = await repoListar(supabase);
  return rows.map(rowParaContrato);
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
  id: string
): Promise<void> {
  await repoRemover(supabase, id);
}
