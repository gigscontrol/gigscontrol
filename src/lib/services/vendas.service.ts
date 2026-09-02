import type { SupabaseClient } from "@supabase/supabase-js";
import type { Venda, Parcela, ParcelaMeta } from "@/types";
import {
  rowParaVenda,
  rowParaParcela,
  type VendaEscrita,
  type ParcelaEscrita,
} from "@/lib/mappers/venda";
import {
  listarVendas as repoListar,
  buscarVenda as repoBuscar,
  proximoNumeroVenda,
  criarVendaRow,
  atualizarVendaRow,
  removerVendaRow,
} from "@/lib/repositories/vendas.repo";
import {
  sincronizarShowNoGoogle,
  atualizarShowNoGoogle,
} from "@/lib/google/calendario";
import { algumaParcelaTemHistorico } from "@/lib/parcelaHistorico";
import {
  listarParcelasDaVenda,
  listarTodasParcelas,
  inserirParcelasEmLote,
  removerParcelasDaVenda,
  atualizarParcelaRow,
} from "@/lib/repositories/parcelas.repo";
import type {
  VendaCreateInput,
  VendaUpdateInput,
  ParcelaUpdateInput,
} from "@/lib/validators/vendas.schema";
import { criarShowNoWorkspace, atualizarShowPorId } from "@/lib/services/shows.service";
import { atualizarOrcamentoPorId, buscarOrcamentoPorId } from "@/lib/services/orcamentos.service";
import { resolverTaxaAgencia } from "@/lib/services/taxaAgencia.service";
import { buscarFusoPadrao } from "@/lib/services/workspacePrefs.service";
import type { SessaoAutenticada } from "@/lib/api/session";
import { aplicarFiltroVendas } from "@/lib/api/permissoes";

/** OrÃ§amento jÃ¡ tem uma venda ativa â€” bloqueia concretizar de novo. */
export class VendaDuplicadaError extends Error {
  status = 409;
  constructor(public numeroExistente: string) {
    super(
      `Este orÃ§amento jÃ¡ foi concretizado na venda ${numeroExistente}. ` +
        `Abra a venda existente em vez de criar outra.`
    );
    this.name = "VendaDuplicadaError";
  }
}

/**
 * Soma das parcelas nÃ£o bate com o cachÃª. Guard de integridade financeira do
 * servidor (o cliente jÃ¡ valida, mas integraÃ§Ã£o externa/request adulterado nÃ£o).
 */
export class ParcelasNaoBatemError extends Error {
  status = 400;
  constructor(soma: number, cache: number) {
    super(
      `As parcelas somam R$ ${soma.toFixed(2)}, mas o cachÃª Ã© R$ ${cache.toFixed(2)}. ` +
        `Ajuste as parcelas para que a soma bata com o cachÃª.`
    );
    this.name = "ParcelasNaoBatemError";
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normalizarUuid(v: string | null | undefined): string | null {
  if (!v) return null;
  return UUID_RE.test(v) ? v : null;
}

function vendaInputParaEscrita(
  input: VendaCreateInput | VendaUpdateInput
): VendaEscrita {
  const out: VendaEscrita = {};
  if (input.orcamento_id !== undefined) out.orcamento_id = normalizarUuid(input.orcamento_id ?? null);
  if (input.contratante_id !== undefined) out.contratante_id = normalizarUuid(input.contratante_id ?? null);
  if (input.contratante_nome !== undefined) out.contratante_nome = input.contratante_nome;
  if (input.contratante_email !== undefined) out.contratante_email = input.contratante_email;
  if (input.contratante_telefone !== undefined) out.contratante_telefone = input.contratante_telefone;
  if (input.contratante_documento !== undefined) out.contratante_documento = input.contratante_documento;
  if (input.contratante_razao_social !== undefined) out.contratante_razao_social = input.contratante_razao_social;
  if (input.contratante_endereco !== undefined) out.contratante_endereco = input.contratante_endereco;
  if (input.nome_evento !== undefined) out.nome_evento = input.nome_evento;
  if (input.evento_instagram !== undefined) out.evento_instagram = input.evento_instagram;
  if (input.nome_local !== undefined) out.nome_local = input.nome_local;
  if (input.capacidade_publico !== undefined) out.capacidade_publico = input.capacidade_publico;
  if (input.endereco_local !== undefined) out.endereco_local = input.endereco_local;
  if (input.data_show !== undefined) out.data_show = input.data_show;
  if (input.horario !== undefined) out.horario = input.horario;
  if (input.horario_fim !== undefined) out.horario_fim = input.horario_fim;
  if (input.fuso_horario !== undefined) out.fuso_horario = input.fuso_horario;
  if (input.cidade_id !== undefined) out.cidade_id = normalizarUuid(input.cidade_id ?? null);
  if (input.casa_id !== undefined) out.casa_id = normalizarUuid(input.casa_id ?? null);
  if (input.artist_id !== undefined) out.artist_id = normalizarUuid(input.artist_id ?? null);
  if (input.line_up !== undefined) out.line_up = input.line_up;
  if (input.cache !== undefined) out.cache = input.cache;
  if (input.moeda !== undefined) out.moeda = input.moeda;
  if (input.duracao_horas !== undefined) out.duracao_horas = input.duracao_horas;
  if (input.duracao_minutos !== undefined) out.duracao_minutos = input.duracao_minutos;
  if (input.camarim !== undefined) out.camarim = input.camarim;
  if (input.efeitos !== undefined) out.efeitos = input.efeitos;
  if (input.hotel !== undefined) out.hotel = input.hotel;
  if (input.tecnico !== undefined) out.tecnico = input.tecnico;
  if (input.logistica !== undefined) out.logistica = input.logistica;
  if (input.observacoes !== undefined) out.observacoes = input.observacoes;
  if (input.info_extra !== undefined) out.info_extra = input.info_extra;
  return out;
}

export async function carregarVendaCompleta(
  supabase: SupabaseClient,
  id: string
): Promise<Venda | null> {
  const row = await repoBuscar(supabase, id);
  if (!row) return null;
  const parcelas = await listarParcelasDaVenda(supabase, id);
  return rowParaVenda(row, parcelas.map(rowParaParcela));
}

export async function listarVendasDoWorkspace(
  supabase: SupabaseClient,
  sessao?: SessaoAutenticada
): Promise<Venda[]> {
  const filtro = sessao
    ? <Q,>(q: Q) => aplicarFiltroVendas(q as never, sessao) as Q
    : undefined;
  const [vendas, todasParcelas] = await Promise.all([
    repoListar(supabase, filtro),
    listarTodasParcelas(supabase),
  ]);
  const porVenda = new Map<string, Parcela[]>();
  for (const p of todasParcelas) {
    const arr = porVenda.get(p.venda_id) ?? [];
    arr.push(rowParaParcela(p));
    porVenda.set(p.venda_id, arr);
  }
  return vendas.map((v) => rowParaVenda(v, porVenda.get(v.id) ?? []));
}

/**
 * A venda `id` Ã© visÃ­vel para a sessÃ£o? Reusa EXATAMENTE o filtro da lista
 * (aplicarFiltroVendas), sÃ³ que estreitado ao id â€” se a linha passa no escopo
 * (modelo novo OU legado) e casa o id, Ã© visÃ­vel. Zero divergÃªncia com a lista;
 * usado no GET /vendas/[id] pra fechar o vazamento de leitura por link direto.
 */
export async function vendaVisivelParaSessao(
  supabase: SupabaseClient,
  sessao: SessaoAutenticada,
  id: string
): Promise<boolean> {
  const rows = await repoListar(supabase, <Q,>(q: Q) =>
    (
      aplicarFiltroVendas(q as never, sessao) as unknown as {
        eq(col: string, val: string): unknown;
      }
    ).eq("id", id) as Q
  );
  return rows.length > 0;
}

export async function buscarVendaPorId(
  supabase: SupabaseClient,
  id: string
): Promise<Venda | null> {
  return carregarVendaCompleta(supabase, id);
}

/**
 * Cria uma venda. Orquestra:
 *   1) gera nÃºmero
 *   2) insere venda
 *   3) insere parcelas (se houver)
 *   4) se hÃ¡ orcamento_id: cria show novo (ou atualiza existente do orÃ§amento)
 *      e vincula show_id na venda; marca o orÃ§amento como aceito.
 *   5) se NÃƒO hÃ¡ orcamento_id: cria show direto e vincula.
 */
export async function criarVendaCompleta(
  supabase: SupabaseClient,
  workspaceId: string,
  criadoPor: string,
  input: VendaCreateInput
): Promise<Venda> {
  // 0: guard anti-duplicaÃ§Ã£o. Se este orÃ§amento jÃ¡ tem uma venda ATIVA,
  // nÃ£o cria outra. Protege contra double-click / re-concretizaÃ§Ã£o (bug
  // que gerou duas VND-0003 do mesmo ORC-0004).
  if (input.orcamento_id) {
    const { data: existente } = await supabase
      .from("vendas")
      .select("id, numero")
      .eq("orcamento_id", input.orcamento_id)
      .is("deletado_em", null)
      .limit(1)
      .maybeSingle();
    if (existente) {
      throw new VendaDuplicadaError(existente.numero as string);
    }
  }

  // GUARD DE INTEGRIDADE FINANCEIRA: se hÃ¡ parcelas, a soma dos valores tem que
  // bater com o cachÃª. O cliente (ConcretizarVenda) jÃ¡ valida, mas uma integraÃ§Ã£o
  // externa (n8n/zapier â€” o schema aceita string de propÃ³sito) ou um request
  // adulterado poderia gravar parcelas que nÃ£o fecham, e aÃ­ os dashboards
  // divergem ("a receber" != "faturamento"). TolerÃ¢ncia p/ arredondamento de
  // centavos ao ratear percentuais.
  const parcelasIn = input.parcelas ?? [];
  if (parcelasIn.length > 0) {
    const somaParcelas = parcelasIn.reduce((acc, p) => acc + (p.valor ?? 0), 0);
    const tolerancia = 0.01 * parcelasIn.length + 0.01;
    if (Math.abs(somaParcelas - input.cache) > tolerancia) {
      throw new ParcelasNaoBatemError(somaParcelas, input.cache);
    }
  }

  // 1 + 2: cria a venda
  const escrita = vendaInputParaEscrita(input);
  escrita.numero = await proximoNumeroVenda(supabase, workspaceId);
  // Herda do orÃ§amento o que o input nÃ£o trouxe (info_extra + fuso do horÃ¡rio).
  // Cliente concretizar pode editar antes; se nÃ£o editou, assume o do orÃ§amento.
  const faltaInfoExtra = escrita.info_extra === undefined || escrita.info_extra === null;
  const faltaFuso = escrita.fuso_horario === undefined || escrita.fuso_horario === null;
  if (input.orcamento_id && (faltaInfoExtra || faltaFuso)) {
    const orc = await buscarOrcamentoPorId(supabase, input.orcamento_id);
    if (faltaInfoExtra && orc?.infoExtra) escrita.info_extra = orc.infoExtra;
    if (faltaFuso && orc?.fusoHorario) escrita.fuso_horario = orc.fusoHorario;
  }
  // Taxa da agÃªncia (comissÃ£o, informativa): recalcula do artista + cachÃª final.
  // Nos modos VARIÃVEIS sem valor reenviado na concretizaÃ§Ã£o, herda a do
  // orÃ§amento pra nÃ£o zerar o que foi definido lÃ¡.
  let taxaVenda = await resolverTaxaAgencia(supabase, {
    artistId: escrita.artist_id ?? null,
    cache: escrita.cache ?? null,
    taxaDigitada: input.taxa_digitada,
    preservarVariavelSemInput: true,
  });
  if (!taxaVenda && input.orcamento_id) {
    const orc = await buscarOrcamentoPorId(supabase, input.orcamento_id);
    if (orc && orc.taxaAgenciaValor !== undefined) {
      taxaVenda = {
        taxa_agencia_valor: orc.taxaAgenciaValor,
        taxa_modo_aplicado: orc.taxaModoAplicado ?? "sem-taxa",
      };
    }
  }
  if (taxaVenda) {
    escrita.taxa_agencia_valor = taxaVenda.taxa_agencia_valor;
    escrita.taxa_modo_aplicado = taxaVenda.taxa_modo_aplicado;
  }
  // Default do fuso do horÃ¡rio = fuso padrÃ£o da agÃªncia (se input/orÃ§amento nÃ£o deram).
  if (escrita.fuso_horario === undefined || escrita.fuso_horario === null) {
    escrita.fuso_horario = await buscarFusoPadrao(supabase, workspaceId);
  }
  const vendaRow = await criarVendaRow(supabase, workspaceId, criadoPor, escrita);

  // A venda JÃ existe. Os passos seguintes (parcelas, show, aceite do orÃ§amento)
  // sÃ£o escritas separadas (supabase-js nÃ£o tem transaÃ§Ã£o). Se qualquer um
  // falhar, desfazemos a venda no catch â€” senÃ£o sobra venda sem parcelas E o
  // guard anti-duplicaÃ§Ã£o acima trava TODA re-tentativa (venda soft-deletada Ã©
  // ignorada pelo guard, entÃ£o a re-tentativa passa).
  try {
    // 3: parcelas (se houver)
  const hojeYmd = new Date().toISOString().slice(0, 10);
  const parcelasPayload: ParcelaEscrita[] = (input.parcelas ?? []).map((p) => ({
    percentual: p.percentual,
    valor: p.valor,
    data_vencimento: p.data_vencimento ?? null,
    status_base: p.status_base ?? "pendente",
    // Mesma regra do PATCH: 'pago' sem data â†’ hoje; 'pendente' â†’ sempre null.
    // (fecha o buraco de integraÃ§Ã£o que gravava pago sem data de pagamento.)
    data_pagamento:
      p.status_base === "pago" ? p.data_pagamento ?? hojeYmd : null,
    observacao: p.observacao ?? null,
  }));
  const parcelasInseridas = await inserirParcelasEmLote(
    supabase,
    workspaceId,
    vendaRow.id,
    parcelasPayload
  );

  // 4 + 5: sincronizar show
  let showIdFinal: string | null = null;
  if (input.data_show) {
    const showPayload = {
      artist_id: normalizarUuid(input.artist_id ?? null),
      contratante_id: normalizarUuid(input.contratante_id ?? null),
      casa_id: normalizarUuid(input.casa_id ?? null),
      cidade_id: normalizarUuid(input.cidade_id ?? null),
      data: input.data_show,
      horario: input.horario ?? null,
      status: "confirmado" as const,
      valor: input.cache ?? null,
      orcamento_id: normalizarUuid(input.orcamento_id ?? null),
      venda_id: vendaRow.id,
    };

    if (input.orcamento_id) {
      const orc = await buscarOrcamentoPorId(supabase, input.orcamento_id);
      if (orc?.showId) {
        await atualizarShowPorId(supabase, orc.showId, showPayload);
        showIdFinal = orc.showId;
      } else {
        const show = await criarShowNoWorkspace(supabase, workspaceId, showPayload, criadoPor);
        showIdFinal = show.id;
      }
      // Atualiza o orÃ§amento (aceito + show_id + data/horario sincronizados)
      await atualizarOrcamentoPorId(supabase, input.orcamento_id, {
        status: "aceito",
        show_id: showIdFinal,
        data_show: input.data_show,
        horario: input.horario ?? null,
        casa_id: normalizarUuid(input.casa_id ?? null),
      });
    } else {
      const show = await criarShowNoWorkspace(supabase, workspaceId, showPayload, criadoPor);
      showIdFinal = show.id;
    }

    // Persistir show_id na venda
    await atualizarVendaRow(supabase, vendaRow.id, { show_id: showIdFinal });

    // Google Calendar (best-effort): cria o evento de dia inteiro no
    // calendÃ¡rio do artista conectado. Falha aqui NÃƒO quebra a venda.
    if (showIdFinal && input.artist_id) {
      try {
        await sincronizarShowNoGoogle(supabase, {
          artistId: input.artist_id,
          showId: showIdFinal,
          input,
        });
      } catch (e) {
        console.error("[google-calendar] falha ao sincronizar show:", e);
      }
    }
  }

    // Retorno consistente: re-busca a venda jÃ¡ com show_id e parcelas resolvidas
    const final = await carregarVendaCompleta(supabase, vendaRow.id);
    if (!final) {
      // fallback improvÃ¡vel
      return rowParaVenda(
        { ...vendaRow, show_id: showIdFinal },
        parcelasInseridas.map(rowParaParcela)
      );
    }
    return final;
  } catch (e) {
    // Cleanup compensatÃ³rio: a venda ficou meio-feita â†’ soft-delete pra nÃ£o
    // deixar Ã³rfÃ£o nem travar a re-tentativa. (best-effort + log)
    await removerVendaRow(supabase, vendaRow.id, criadoPor).catch((err) =>
      console.error("[criarVendaCompleta] falha ao limpar venda parcial:", err)
    );
    throw e;
  }
}

/** A venda editada, no formato que o Google Calendar consome (snake_case). */
export function vendaParaInputDoGoogle(v: Venda): VendaCreateInput {
  return {
    contratante_nome: v.contratanteNome || null,
    contratante_telefone: v.contratanteTelefone || null,
    nome_evento: v.nomeEvento || null,
    nome_local: v.nomeLocal || null,
    capacidade_publico: v.capacidadePublico ?? null,
    endereco_local: v.enderecoLocal || null,
    data_show: v.dataShow || null,
    horario: v.horario || null,
    horario_fim: v.horarioFim ?? null,
    cache: v.cache,
    camarim: v.camarim,
    efeitos: v.efeitos,
    hotel: v.hotel,
    tecnico: v.tecnico,
    logistica: v.logistica,
  };
}

/**
 * Edita uma venda. Diferente do PATCH antigo (que sÃ³ mexia na linha da venda e
 * deixava show/parcelas/Google desatualizados), esta versÃ£o propaga a ediÃ§Ã£o:
 *
 *   1) PARCELAS (D5): se o input trouxe parcelas e NENHUMA tem histÃ³rico
 *      financeiro (`parcelaTemHistorico`: paga, cancelada, fixada ou cobrada),
 *      regenera. Se QUALQUER uma tem, NÃƒO TOCA em nada e devolve
 *      `parcelasPreservadas: true` pra UI avisar que o Financeiro precisa de
 *      revisÃ£o. O deleteâ†’insert nÃ£o recria `meta` â€” apagar destruiria o
 *      comprovante, o motivo do cancelamento e o log de cobranÃ§as. Perder isso
 *      Ã© MUITO pior que uma parcela desatualizada.
 *   2) taxa da agÃªncia (recalculada quando artista/cachÃª/valor digitado mudam);
 *   3) linha da venda;
 *   4) SHOW da agenda (data/horÃ¡rio/casa/cidade/artista/valor) â€” senÃ£o a agenda
 *      mostraria o show na data velha;
 *   5) Google Calendar (best-effort â€” falha NÃƒO derruba a ediÃ§Ã£o).
 */
export async function atualizarVendaPorId(
  supabase: SupabaseClient,
  id: string,
  input: VendaUpdateInput
): Promise<{ venda: Venda; parcelasPreservadas: boolean }> {
  // O "antes" Ã© necessÃ¡rio de qualquer jeito (parcelas, taxa, show_id) â€” carrega
  // uma vez sÃ³, a partir da row (que traz workspace_id e show_id).
  const rowAntes = await repoBuscar(supabase, id);
  if (!rowAntes) throw new Error("Venda nÃ£o encontrada.");
  const antes = rowParaVenda(
    rowAntes,
    (await listarParcelasDaVenda(supabase, id)).map(rowParaParcela)
  );

  const escrita = vendaInputParaEscrita(input);

  // 1: parcelas (D5)
  let parcelasPreservadas = false;
  if (input.parcelas !== undefined) {
    if (algumaParcelaTemHistorico(antes.parcelas)) {
      // Nem as pendentes sÃ£o mexidas: na dÃºvida, preserva o dado e avisa.
      parcelasPreservadas = true;
    } else {
      const novas = input.parcelas ?? [];
      const cacheAlvo = input.cache !== undefined ? input.cache : antes.cache;
      // Mesmo guard de integridade da criaÃ§Ã£o: a soma tem que bater com o cachÃª.
      if (novas.length > 0) {
        const soma = novas.reduce((acc, p) => acc + (p.valor ?? 0), 0);
        const tolerancia = 0.01 * novas.length + 0.01;
        if (Math.abs(soma - cacheAlvo) > tolerancia) {
          throw new ParcelasNaoBatemError(soma, cacheAlvo);
        }
      }
      const hojeYmd = new Date().toISOString().slice(0, 10);
      const payload: ParcelaEscrita[] = novas.map((p) => ({
        percentual: p.percentual,
        valor: p.valor,
        data_vencimento: p.data_vencimento ?? null,
        status_base: p.status_base ?? "pendente",
        data_pagamento: p.status_base === "pago" ? p.data_pagamento ?? hojeYmd : null,
        observacao: p.observacao ?? null,
      }));
      // Ordem deleteâ†’insert. Se o insert falhar o erro propaga: sÃ³ se perdem
      // parcelas PENDENTES (regenerÃ¡veis pelo form) â€” nenhum pagamento.
      await removerParcelasDaVenda(supabase, id);
      await inserirParcelasEmLote(supabase, rowAntes.workspace_id, id, payload);
    }
  }

  // 2: taxa da agÃªncia â€” recalcula quando o que a define muda.
  if (
    input.artist_id !== undefined ||
    input.cache !== undefined ||
    input.taxa_digitada !== undefined
  ) {
    const artistId =
      input.artist_id !== undefined
        ? normalizarUuid(input.artist_id ?? null)
        : antes.artistaId || null;
    const cache = input.cache !== undefined ? input.cache : antes.cache ?? null;
    const taxa = await resolverTaxaAgencia(supabase, {
      artistId,
      cache,
      taxaDigitada: input.taxa_digitada,
      preservarVariavelSemInput: true,
    });
    if (taxa) {
      escrita.taxa_agencia_valor = taxa.taxa_agencia_valor;
      escrita.taxa_modo_aplicado = taxa.taxa_modo_aplicado;
    }
  }

  // 3: linha da venda
  await atualizarVendaRow(supabase, id, escrita);
  const final = await carregarVendaCompleta(supabase, id);
  if (!final) throw new Error("Venda nÃ£o encontrada apÃ³s atualizaÃ§Ã£o.");

  // 4 + 5: show + Google. SÃ³ quando o input mexeu em algo que o show reflete.
  const mexeuNoShow =
    input.data_show !== undefined ||
    input.horario !== undefined ||
    input.casa_id !== undefined ||
    input.cidade_id !== undefined ||
    input.artist_id !== undefined ||
    input.contratante_id !== undefined ||
    input.cache !== undefined;

  if (rowAntes.show_id && mexeuNoShow) {
    // Payload montado do estado FINAL (o input Ã© parcial). SEM `status`: nÃ£o
    // ressuscita show cancelado nem re-carimba o que jÃ¡ estava lÃ¡.
    await atualizarShowPorId(supabase, rowAntes.show_id, {
      artist_id: normalizarUuid(final.artistaId),
      contratante_id: normalizarUuid(final.contratanteId),
      casa_id: normalizarUuid(final.casaId ?? null),
      cidade_id: normalizarUuid(final.cidadeId),
      data: final.dataShow || null,
      horario: final.horario || null,
      valor: final.cache ?? null,
    });

    if (final.artistaId) {
      try {
        await atualizarShowNoGoogle(supabase, {
          artistId: final.artistaId,
          showId: rowAntes.show_id,
          input: vendaParaInputDoGoogle(final),
        });
      } catch (e) {
        console.error("[google-calendar] falha ao atualizar show editado:", e);
      }
    }
  }

  return { venda: final, parcelasPreservadas };
}

export async function removerVendaPorId(
  supabase: SupabaseClient,
  id: string,
  deletadoPor?: string
): Promise<void> {
  await removerVendaRow(supabase, id, deletadoPor);
}

// ---------- Parcelas ----------

export async function atualizarParcelaPorId(
  supabase: SupabaseClient,
  id: string,
  input: ParcelaUpdateInput,
  /** Meta jÃ¡ computada pela rota (pagamento/cancelamento/cobranÃ§as + sessÃ£o). */
  meta?: ParcelaMeta
): Promise<Parcela> {
  const payload: ParcelaEscrita = {};
  if (meta !== undefined) payload.meta = meta;
  if (input.percentual !== undefined) payload.percentual = input.percentual;
  if (input.valor !== undefined) payload.valor = input.valor;
  if (input.data_vencimento !== undefined) payload.data_vencimento = input.data_vencimento;
  if (input.status_base !== undefined) payload.status_base = input.status_base;
  // Sincroniza dataPagamento conforme status_base
  if (input.data_pagamento !== undefined) {
    payload.data_pagamento = input.data_pagamento;
  } else if (input.status_base === "pago") {
    payload.data_pagamento = new Date().toISOString().slice(0, 10);
  } else if (input.status_base === "pendente") {
    payload.data_pagamento = null;
  }
  if (input.observacao !== undefined) payload.observacao = input.observacao;

  const row = await atualizarParcelaRow(supabase, id, payload);
  return rowParaParcela(row);
}
