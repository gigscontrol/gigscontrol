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
import { buscarVenda, escoposDeVendas } from "@/lib/repositories/vendas.repo";
import type {
  ContratoCreateInput,
  ContratoUpdateInput,
} from "@/lib/validators/contratos.schema";
import { getPlano, type PlanoId } from "@/lib/planos";
import { janelaDoCicloISO } from "@/lib/services/cicloLimite";
import type { SessaoAutenticada } from "@/lib/api/session";
import { verTodosContratos, podeVerContrato } from "@/lib/api/permissoes";
import { hashConteudoContrato } from "@/lib/contratos/integridade";
import { registrarEventoContrato } from "@/lib/services/contratoEventos.service";
import { listarPorContrato } from "@/lib/repositories/contratoSignatarios.repo";

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

/**
 * Tentativa de alterar o CONTEÚDO de um contrato já assinado/finalizado
 * (mig 98 — detecção de alteração). A rota traduz pra HTTP 409.
 */
export class ContratoImutavelError extends Error {
  status = 409;
  constructor() {
    super(
      "Este contrato já tem assinatura registrada — o conteúdo não pode mais ser alterado. Cancele-o e gere um novo se precisar mudar algo."
    );
    this.name = "ContratoImutavelError";
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
    // Autoria = criador REAL do contrato (contratos.criado_por), não o vendedor
    // da venda vinculada: próprio embute em contratos.criar, de outros pede ver_outros.
    return podeVerContrato(sessao, artistId, r.criado_por ?? null);
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
  // Trilha (mig 98): nascimento do contrato — primeiro elo da cadeia.
  await registrarEventoContrato({
    contratoId: row.id,
    workspaceId,
    tipo: "criado",
    detalhes: { numero: row.numero, criadoPor: criadoPor ?? null },
  });
  return rowParaContrato(row);
}

export async function atualizarContratoPorId(
  supabase: SupabaseClient,
  id: string,
  input: ContratoUpdateInput
): Promise<Contrato> {
  const escrita = entradaParaEscrita(input);
  const existente = await repoBuscar(supabase, id);

  // TRAVA DE CONTEÚDO (mig 98 — integridade): comparação por hash CANÔNICO
  // (CRLF/espaços invisíveis não contam como mudança).
  const mudaCorpo =
    existente !== null &&
    escrita.corpo_preenchido !== undefined &&
    hashConteudoContrato(escrita.corpo_preenchido ?? "") !==
      hashConteudoContrato(existente.corpo_preenchido ?? "");

  if (mudaCorpo && existente) {
    // Já finalizado/assinado → imutável. Com assinatura PARCIAL idem: mudar o
    // texto depois de alguém assinar invalidaria o que essa pessoa assinou.
    if (existente.status === "assinado" || existente.finalizado_em) {
      throw new ContratoImutavelError();
    }
    // A checagem de assinatura parcial vale pra QUALQUER status com hash
    // selado (já foi enviado ao menos uma vez): regredir o status pra
    // "rascunho" num PATCH e editar o corpo no seguinte não pode destravar o
    // texto que alguém já assinou.
    if (existente.conteudo_hash) {
      const sigs = await listarPorContrato(supabase, id);
      if (sigs.some((s) => s.status === "assinado")) {
        throw new ContratoImutavelError();
      }
      // Pré-assinatura, mas JÁ ENVIADO: versiona + re-sela + registra a
      // alteração na trilha. Rascunho nunca enviado edita livre.
      escrita.conteudo_hash = hashConteudoContrato(escrita.corpo_preenchido ?? "");
      escrita.conteudo_versao = (existente.conteudo_versao ?? 1) + 1;
    }
  }

  const row = await repoAtualizar(supabase, id, escrita);

  // Trilha só DEPOIS do update confirmado (não registra alteração que falhou).
  if (existente && escrita.conteudo_hash !== undefined) {
    await registrarEventoContrato({
      contratoId: id,
      workspaceId: existente.workspace_id,
      tipo: "conteudo_alterado",
      detalhes: {
        hashAnterior: existente.conteudo_hash,
        hash: escrita.conteudo_hash,
        versao: escrita.conteudo_versao,
      },
    });
  }

  // Cancelamento pela agência → evento na trilha (best-effort).
  if (
    existente &&
    escrita.status === "cancelado" &&
    existente.status !== "cancelado"
  ) {
    await registrarEventoContrato({
      contratoId: id,
      workspaceId: existente.workspace_id,
      tipo: "cancelado",
      detalhes: { statusAnterior: existente.status },
    });
  }
  return rowParaContrato(row);
}

/**
 * Contrato FINALIZADO não pode ir pra lixeira: o código GC-XXXX-XXXX impresso
 * no PDF das partes deixaria de responder na verificação pública — pra
 * contraparte, indistinguível de fraude. A rota traduz pra HTTP 409.
 */
export class ContratoFinalizadoError extends Error {
  status = 409;
  constructor() {
    super(
      "Este contrato foi finalizado e tem verificação pública ativa — não pode ser excluído. Cancele-o se precisar tirá-lo de circulação."
    );
    this.name = "ContratoFinalizadoError";
  }
}

export async function removerContratoPorId(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  const existente = await repoBuscar(supabase, id);
  if (existente && (existente.finalizado_em || existente.verificacao_id)) {
    throw new ContratoFinalizadoError();
  }
  await repoRemover(supabase, id, deletadoPor);
}
