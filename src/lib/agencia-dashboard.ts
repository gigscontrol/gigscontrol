import type {
  Venda,
  Orcamento,
  Artista,
  Contratante,
  Casa,
  Cidade,
  AgendaDateRange,
} from "@/types";
import { statusEfetivoParcela } from "@/types";
import type { Contrato } from "@/lib/mappers/contrato";
import type { UsuarioEquipe } from "@/lib/mappers/usuario";

/**
 * Funções PURAS de agregação do Dashboard da Agência.
 *
 * Recebem os arrays já carregados pelos contexts + o intervalo do período e
 * devolvem os dados prontos pra UI (StatCards, alertas, linhas de ranking).
 * NADA de fetch/estado aqui — tudo determinístico e testável (o "hoje" é
 * injetável nas funções que dependem da data atual).
 */

// ---------------------------------------------------------------------------
// Período (mesma semântica do Dashboard financeiro/contratos/contatos)
// ---------------------------------------------------------------------------

export type Periodo = { ano: number; mes: number; tudo: boolean };

export const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
export const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Resolve {ano, mes(0-based), tudo}. "Visão geral" = all-time. */
export function resolverPeriodo(
  range: AgendaDateRange,
  customMonth: string | null,
  customYear: number | null,
  hoje: Date = new Date()
): Periodo {
  if (range === "Visão geral")
    return { ano: hoje.getFullYear(), mes: hoje.getMonth(), tudo: true };
  if (range === "Mês anterior") {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Próximo mês") {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Personalizado" && customMonth && customYear !== null) {
    return {
      ano: customYear,
      mes: Math.max(0, MESES_CURTO.indexOf(customMonth)),
      tudo: false,
    };
  }
  // "Mês atual" (padrão)
  return { ano: hoje.getFullYear(), mes: hoje.getMonth(), tudo: false };
}

/**
 * A data ISO cai no período? Em "Visão geral", tudo passa. Compara por data
 * local (mesmo tratamento do Dashboard.tsx pra não divergir entre módulos):
 * datas curtas (YYYY-MM-DD) ganham T12:00:00, timestamps completos vão direto.
 */
export function dataNoMes(
  dataISO: string | undefined,
  p: Periodo
): boolean {
  if (p.tudo) return true;
  if (!dataISO) return false;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === p.ano && d.getMonth() === p.mes;
}

// ---------------------------------------------------------------------------
// StatCards
// ---------------------------------------------------------------------------

export type ContagemAgencia = {
  artistas: number;
  equipe: number;
  /** Artistas com acesso suspenso (equipe não tem esse conceito → contribui 0). */
  suspensos: number;
  /** Membros da equipe bloqueados (ativo === false, "Bloqueado" na AbaEquipe). */
  bloqueados: number;
};

export function contarStatCards(
  artistas: Artista[],
  equipe: UsuarioEquipe[]
): ContagemAgencia {
  return {
    artistas: artistas.length,
    equipe: equipe.length,
    suspensos: artistas.filter((a) => a.acessoSuspenso === true).length,
    bloqueados: equipe.filter((u) => u.ativo === false).length,
  };
}

// ---------------------------------------------------------------------------
// Alertas (estado ATUAL — ignoram o seletor de período)
// ---------------------------------------------------------------------------

export type AlertasAgencia = {
  /** Σ valor das parcelas atrasadas (vendas não-canceladas). */
  parcelasAtrasadasValor: number;
  /** Nº de parcelas atrasadas. */
  parcelasAtrasadasContagem: number;
  /** Contratos aguardando assinatura = status "enviado". */
  contratosAguardando: number;
  /** Orçamentos pendente/negociação criados há ≥7 dias. */
  orcamentosParados: number;
  /** Vendas sem contrato ativo (mesma definição do Dashboard de Contratos). */
  showsSemContrato: number;
};

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export function calcularAlertas(
  vendas: Venda[],
  orcamentos: Orcamento[],
  contratos: Contrato[],
  hoje: Date = new Date()
): AlertasAgencia {
  // (a) Parcelas atrasadas — só de vendas NÃO-canceladas.
  let parcelasAtrasadasValor = 0;
  let parcelasAtrasadasContagem = 0;
  for (const v of vendas) {
    if (v.status === "cancelada") continue;
    for (const p of v.parcelas) {
      if (statusEfetivoParcela(p, hoje) === "atrasado") {
        parcelasAtrasadasValor += p.valor;
        parcelasAtrasadasContagem += 1;
      }
    }
  }

  // (b) Contratos aguardando assinatura — status "enviado" (enviado, sem
  // assinatura de volta). Valores de status reais: rascunho/enviado/
  // assinado/cancelado.
  const contratosAguardando = contratos.filter((c) => c.status === "enviado").length;

  // (c) Orçamentos parados — pendente/negociação criados há ≥7 dias.
  const orcamentosParados = orcamentos.filter((o) => {
    if (o.status !== "pendente" && o.status !== "negociacao") return false;
    const criado = new Date(o.criadoEm).getTime();
    if (Number.isNaN(criado)) return false;
    return hoje.getTime() - criado >= SETE_DIAS_MS;
  }).length;

  // (d) Shows sem contrato — mesma definição do DashboardContratos (contratos
  // não-cancelados com venda vinculada cobrem a venda), porém sem o filtro de
  // período (a faixa de alertas é estado atual) e SEM vendas canceladas —
  // venda cancelada não precisa de contrato.
  const comContrato = new Set(
    contratos.filter((c) => c.status !== "cancelado" && c.vendaId).map((c) => c.vendaId)
  );
  const showsSemContrato = vendas.filter(
    (v) => v.status !== "cancelada" && !comContrato.has(v.id)
  ).length;

  return {
    parcelasAtrasadasValor,
    parcelasAtrasadasContagem,
    contratosAguardando,
    orcamentosParados,
    showsSemContrato,
  };
}

// ---------------------------------------------------------------------------
// Rankings (filtrados pelo período por criadoEm)
// ---------------------------------------------------------------------------

/**
 * Uma linha de ranking. Carrega DUAS métricas (`a` = métrica padrão, `b` =
 * alternativa) porque cada card tem um toggle; o RankingCard decide qual
 * exibir/ordenar. Ex.: R1 → a = bruto, b = taxa; R2 → a = valor, b = nº shows.
 */
export type RankingLinha = {
  id: string;
  nome: string;
  /** Cor pessoal (artista/membro), quando houver — pinta o avatar e a barra. */
  cor?: string;
  a: number;
  b: number;
};

/** Vendas não-canceladas dentro do período (base dos rankings de vendas). */
function vendasDoPeriodo(vendas: Venda[], periodo: Periodo): Venda[] {
  return vendas.filter(
    (v) => v.status !== "cancelada" && dataNoMes(v.criadoEm, periodo)
  );
}

/**
 * R1 — Faturamento por artista. a = Bruto (Σ cache), b = Taxa de agência
 * (Σ taxaAgenciaValor). Agrupa por artistaId; cor = artista.color.
 */
export function rankingFaturamentoPorArtista(
  vendas: Venda[],
  artistas: Artista[],
  periodo: Periodo
): RankingLinha[] {
  const mapa = new Map<string, { bruto: number; taxa: number }>();
  for (const v of vendasDoPeriodo(vendas, periodo)) {
    const cur = mapa.get(v.artistaId) ?? { bruto: 0, taxa: 0 };
    cur.bruto += v.cache || 0;
    cur.taxa += v.taxaAgenciaValor ?? 0;
    mapa.set(v.artistaId, cur);
  }
  const linhas: RankingLinha[] = [];
  for (const [id, { bruto, taxa }] of mapa) {
    const artista = artistas.find((a) => a.id === id);
    linhas.push({
      id,
      nome: artista?.name ?? "—",
      cor: artista?.color,
      a: bruto,
      b: taxa,
    });
  }
  return linhas;
}

/**
 * R2 — Contratantes. a = Valor (Σ cache), b = Shows (nº de vendas).
 * Agrupa por contratanteId; nome via lista de contratantes.
 */
export function rankingContratantes(
  vendas: Venda[],
  contratantes: Contratante[],
  periodo: Periodo
): RankingLinha[] {
  const mapa = new Map<string, { valor: number; shows: number }>();
  for (const v of vendasDoPeriodo(vendas, periodo)) {
    if (!v.contratanteId) continue;
    const cur = mapa.get(v.contratanteId) ?? { valor: 0, shows: 0 };
    cur.valor += v.cache || 0;
    cur.shows += 1;
    mapa.set(v.contratanteId, cur);
  }
  const linhas: RankingLinha[] = [];
  for (const [id, { valor, shows }] of mapa) {
    const c = contratantes.find((x) => x.id === id);
    linhas.push({ id, nome: c?.nome ?? "—", a: valor, b: shows });
  }
  return linhas;
}

/**
 * R3 — Casas. a = Shows (nº de vendas), b = Valor (Σ cache). Ignora vendas
 * sem casa. Nome via lista de casas.
 */
export function rankingCasas(
  vendas: Venda[],
  casas: Casa[],
  periodo: Periodo
): RankingLinha[] {
  const mapa = new Map<string, { shows: number; valor: number }>();
  for (const v of vendasDoPeriodo(vendas, periodo)) {
    if (!v.casaId) continue;
    const cur = mapa.get(v.casaId) ?? { shows: 0, valor: 0 };
    cur.shows += 1;
    cur.valor += v.cache || 0;
    mapa.set(v.casaId, cur);
  }
  const linhas: RankingLinha[] = [];
  for (const [id, { shows, valor }] of mapa) {
    const c = casas.find((x) => x.id === id);
    linhas.push({ id, nome: c?.nome ?? "—", a: shows, b: valor });
  }
  return linhas;
}

/**
 * R4 — Cidades. a = Valor (Σ cache), b = Shows (nº de vendas). Nome = cidade
 * + UF (estado) quando houver. Ignora vendas sem cidade.
 */
export function rankingCidades(
  vendas: Venda[],
  cidades: Cidade[],
  periodo: Periodo
): RankingLinha[] {
  const mapa = new Map<string, { valor: number; shows: number }>();
  for (const v of vendasDoPeriodo(vendas, periodo)) {
    if (!v.cidadeId) continue;
    const cur = mapa.get(v.cidadeId) ?? { valor: 0, shows: 0 };
    cur.valor += v.cache || 0;
    cur.shows += 1;
    mapa.set(v.cidadeId, cur);
  }
  const linhas: RankingLinha[] = [];
  for (const [id, { valor, shows }] of mapa) {
    const c = cidades.find((x) => x.id === id);
    const nome = c
      ? c.estado
        ? `${c.nome} · ${c.estado}`
        : c.nome
      : "—";
    linhas.push({ id, nome, a: valor, b: shows });
  }
  return linhas;
}

/**
 * R5 — Vendas por usuário. a = Valor (Σ cache), b = Nº de vendas. Agrupa por
 * criadoPor; nome = criadoPorNome ?? membro da equipe ?? "—"; cor = cor do
 * membro da equipe (quando disponível).
 */
export function rankingVendasPorUsuario(
  vendas: Venda[],
  equipe: UsuarioEquipe[],
  periodo: Periodo
): RankingLinha[] {
  const mapa = new Map<string, { valor: number; qtd: number; nome: string }>();
  for (const v of vendasDoPeriodo(vendas, periodo)) {
    const id = v.criadoPor ?? "";
    const cur = mapa.get(id) ?? { valor: 0, qtd: 0, nome: v.criadoPorNome ?? "" };
    cur.valor += v.cache || 0;
    cur.qtd += 1;
    if (!cur.nome && v.criadoPorNome) cur.nome = v.criadoPorNome;
    mapa.set(id, cur);
  }
  const linhas: RankingLinha[] = [];
  for (const [id, { valor, qtd, nome }] of mapa) {
    const membro = equipe.find((u) => u.id === id);
    linhas.push({
      id: id || "—",
      nome: nome || membro?.nome || "—",
      cor: membro?.cor,
      a: valor,
      b: qtd,
    });
  }
  return linhas;
}

/**
 * R6 — Orçamentos por usuário. a = Valor (Σ valorCache), b = Nº. Conta TODOS
 * os orçamentos criados no período (qualquer status — mede pipeline gerado).
 * Agrupa por criadoPor; nome/cor como no R5.
 */
export function rankingOrcamentosPorUsuario(
  orcamentos: Orcamento[],
  equipe: UsuarioEquipe[],
  periodo: Periodo
): RankingLinha[] {
  const mapa = new Map<string, { valor: number; qtd: number; nome: string }>();
  for (const o of orcamentos) {
    if (!dataNoMes(o.criadoEm, periodo)) continue;
    const id = o.criadoPor ?? "";
    const cur = mapa.get(id) ?? { valor: 0, qtd: 0, nome: o.criadoPorNome ?? "" };
    cur.valor += o.valorCache || 0;
    cur.qtd += 1;
    if (!cur.nome && o.criadoPorNome) cur.nome = o.criadoPorNome;
    mapa.set(id, cur);
  }
  const linhas: RankingLinha[] = [];
  for (const [id, { valor, qtd, nome }] of mapa) {
    const membro = equipe.find((u) => u.id === id);
    linhas.push({
      id: id || "—",
      nome: nome || membro?.nome || "—",
      cor: membro?.cor,
      a: valor,
      b: qtd,
    });
  }
  return linhas;
}
