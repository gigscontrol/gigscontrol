import { describe, it, expect } from "vitest";
import { calcularTotaisFinanceiro, type LinhaTotais } from "./totais";
import type { Periodo } from "../agencia-dashboard";

/**
 * Régua de cada card do Financeiro (doc no próprio totais.ts):
 *  - recebido: pelo dia do PAGAMENTO (não do vencimento)
 *  - atrasado: ignora o período — dívida velha continua aparecendo
 *  - a receber: vence no período e está em dia
 *  - cancelado: não é receita nem dívida
 */

const JULHO: Periodo = { ano: 2026, mes: 6, tudo: false };
const HOJE = new Date("2026-07-15T12:00:00");

const linha = (l: Partial<LinhaTotais>): LinhaTotais => ({
  status: "pendente",
  moeda: "BRL",
  valor: 100,
  dataVencimento: "2026-07-20",
  ...l,
});

describe("calcularTotaisFinanceiro", () => {
  it("recebido conta pelo dia do PAGAMENTO, não do vencimento", () => {
    const t = calcularTotaisFinanceiro(
      [
        // venceu em fev, foi paga em julho → conta em julho
        linha({ status: "pago", valor: 1750, dataVencimento: "2026-02-10", dataPagamento: "2026-07-18" }),
        // venceu em julho, paga em julho
        linha({ status: "pago", valor: 1000, dataVencimento: "2026-07-05", dataPagamento: "2026-07-05" }),
        // paga em AGOSTO → não conta no recorte de julho
        linha({ status: "pago", valor: 999, dataVencimento: "2026-07-25", dataPagamento: "2026-08-02" }),
      ],
      JULHO,
      HOJE
    );
    expect(t.recebidoNum).toBe(2750);
  });

  it("pago sem dataPagamento (lançamento antigo) cai no vencimento — não some", () => {
    const t = calcularTotaisFinanceiro(
      [linha({ status: "pago", valor: 500, dataVencimento: "2026-07-10" })],
      JULHO,
      HOJE
    );
    expect(t.recebidoNum).toBe(500);
  });

  it("atrasado ignora o período: dívida de janeiro aparece olhando julho", () => {
    const t = calcularTotaisFinanceiro(
      [linha({ status: "atrasado", valor: 2250, dataVencimento: "2026-01-15" })],
      JULHO,
      HOJE
    );
    expect(t.atrasadoNum).toBe(2250);
  });

  it("a receber: só o que vence DENTRO do período olhado", () => {
    const t = calcularTotaisFinanceiro(
      [
        linha({ valor: 300, dataVencimento: "2026-07-28" }),
        linha({ valor: 400, dataVencimento: "2026-08-03" }), // fora de julho
      ],
      JULHO,
      HOJE
    );
    expect(t.aReceberNum).toBe(300);
  });

  it("cancelada não entra em nada", () => {
    const t = calcularTotaisFinanceiro(
      [linha({ status: "cancelado", valor: 9999 })],
      JULHO,
      HOJE
    );
    expect(t.totalNum).toBe(0);
  });

  it("totalNum = recebido + a receber + atrasado", () => {
    const t = calcularTotaisFinanceiro(
      [
        linha({ status: "pago", valor: 100, dataPagamento: "2026-07-01" }),
        linha({ status: "atrasado", valor: 200, dataVencimento: "2026-03-01" }),
        linha({ valor: 300, dataVencimento: "2026-07-30" }),
      ],
      JULHO,
      HOJE
    );
    expect(t.totalNum).toBe(600);
  });
});
