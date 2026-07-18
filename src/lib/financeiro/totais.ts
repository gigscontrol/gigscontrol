/**
 * Totais dos cards do Financeiro — CADA UM COM SUA PRÓPRIA RÉGUA DE DATA.
 *
 * Antes os quatro cards saíam de um único recorte por data de VENCIMENTO, e
 * isso produzia três números errados ao mesmo tempo:
 *
 *  - "Recebido" contava a parcela no mês em que ela VENCEU, não no mês em que
 *    o dinheiro entrou. Numa base real: R$ 1.750 vencido em fev e R$ 1.000
 *    vencido em jun, ambos pagos em 18/jul, apareciam em fevereiro e junho —
 *    julho mostrava 3.900 quando o caixa do mês tinha sido 6.650.
 *  - "Atrasado" só via o vencido DO MÊS olhado, então R$ 2.250 vencidos em
 *    janeiro sumiam da tela em julho (o card lia "0").
 *  - "Total em vendas" era a soma dos outros três — nunca o total vendido —
 *    e por isso mostrava 6.150 numa base com 56.900 em vendas.
 *
 * Lógica pura, com `hoje` injetável, pra poder ser provada por execução
 * (`scripts/test-totais-financeiro.ts`) em vez de conferida no olho.
 */

import { dataNoMes, type Periodo } from "../agencia-dashboard";
import { totaisPorMoeda } from "../formatters";
import type { Moeda } from "@/types";

/** Status já resolvido da parcela (vencimento + pagamento + cancelamento). */
export type StatusParcela = "pago" | "atrasado" | "pendente" | "cancelado";

/** O mínimo que o cálculo precisa saber de cada parcela. */
export type LinhaTotais = {
  status: StatusParcela;
  moeda: Moeda;
  valor: number;
  dataVencimento: string;
  /** Preenchido quando marcada paga. Ausente em lançamentos antigos. */
  dataPagamento?: string;
};

export type TotaisFinanceiro = {
  /** Caixa que entrou no período, pelo dia do PAGAMENTO. */
  recebido: string;
  /** Vence no período e ainda está em dia. */
  aReceber: string;
  /** Tudo que já venceu e está em aberto — de TODOS os meses. */
  atrasado: string;
  /** Em aberto vencendo nos próximos 90 dias a partir de hoje. */
  previsto: string;
  /** Soma crua do atrasado, pro alerta "tem X atrasado". */
  atrasadoNum: number;
};

export function calcularTotaisFinanceiro(
  linhas: LinhaTotais[],
  periodo: Periodo,
  hojeRef: Date
): TotaisFinanceiro {
  const rec: { valor: number; moeda: Moeda }[] = [];
  const recv: { valor: number; moeda: Moeda }[] = [];
  const atr: { valor: number; moeda: Moeda }[] = [];
  const prev: { valor: number; moeda: Moeda }[] = [];
  let atrasadoNum = 0;

  const hoje = new Date(hojeRef);
  hoje.setHours(0, 0, 0, 0);
  const limite90 = new Date(hoje);
  limite90.setDate(limite90.getDate() + 90);

  for (const l of linhas) {
    // Cancelada (baixada/isentada) não é receita nem dívida.
    if (l.status === "cancelado") continue;
    const item = { valor: l.valor, moeda: l.moeda };

    if (l.status === "pago") {
      // Parcela antiga marcada paga SEM data de pagamento cai no vencimento —
      // sem esse fallback o dinheiro dela sumiria do painel.
      const quandoEntrou = l.dataPagamento || l.dataVencimento;
      if (dataNoMes(quandoEntrou, periodo)) rec.push(item);
      continue;
    }

    if (l.status === "atrasado") {
      // Ignora o período de propósito: dívida vencida em junho continua
      // vencida quando você olha julho.
      atr.push(item);
      atrasadoNum += l.valor;
      continue;
    }

    if (dataNoMes(l.dataVencimento, periodo)) recv.push(item);

    const venc = new Date(`${l.dataVencimento}T12:00:00`);
    if (!Number.isNaN(venc.getTime()) && venc >= hoje && venc <= limite90) {
      prev.push(item);
    }
  }

  return {
    recebido: totaisPorMoeda(rec),
    aReceber: totaisPorMoeda(recv),
    atrasado: totaisPorMoeda(atr),
    previsto: totaisPorMoeda(prev),
    atrasadoNum,
  };
}
