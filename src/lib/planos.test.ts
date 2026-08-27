import { describe, it, expect } from "vitest";
import {
  PLANOS,
  ehUpgrade,
  ehDowngrade,
  creditoDiasUpgrade,
  precoDia,
  diasDeCiclo,
  cabeNoPlano,
  type PlanoId,
} from "./planos";

/**
 * A escada de planos e a conversão de crédito de upgrade decidem DINHEIRO —
 * são a base do fix A1 da auditoria de 27/08/2026 (upgrade justo decidido no
 * webhook). Os testes travam a matemática, não os preços (que podem mudar).
 */

const primeiro = PLANOS[0].id as PlanoId;
const ultimo = PLANOS[PLANOS.length - 1].id as PlanoId;

describe("escada de planos", () => {
  it("o último plano é upgrade do primeiro, e não o contrário", () => {
    expect(ehUpgrade(primeiro, ultimo)).toBe(true);
    expect(ehUpgrade(ultimo, primeiro)).toBe(false);
    expect(ehDowngrade(ultimo, primeiro)).toBe(true);
  });

  it("um plano nunca é upgrade nem downgrade de si mesmo", () => {
    for (const p of PLANOS) {
      expect(ehUpgrade(p.id, p.id)).toBe(false);
      expect(ehDowngrade(p.id, p.id)).toBe(false);
    }
  });

  it("diasDeCiclo: mensal=30, anual=365", () => {
    expect(diasDeCiclo("mensal")).toBe(30);
    expect(diasDeCiclo("anual")).toBe(365);
  });
});

describe("creditoDiasUpgrade", () => {
  it("0 dias restantes → 0 de crédito", () => {
    expect(
      creditoDiasUpgrade({
        atual: primeiro,
        novo: ultimo,
        ciclo: "mensal",
        moeda: "brl",
        diasRestantes: 0,
      })
    ).toBe(0);
  });

  it("crédito nunca excede os dias restantes (novo plano é mais caro por dia)", () => {
    for (const dias of [1, 30, 200, 365]) {
      const credito = creditoDiasUpgrade({
        atual: primeiro,
        novo: ultimo,
        ciclo: "mensal",
        moeda: "brl",
        diasRestantes: dias,
      });
      expect(credito).toBeGreaterThanOrEqual(0);
      expect(credito).toBeLessThanOrEqual(dias);
    }
  });

  it("fórmula: floor(diasRestantes × preçoDiaAtual / preçoDiaNovo)", () => {
    const dias = 200;
    const esperado = Math.floor(
      (dias * precoDia(primeiro, "mensal", "brl")) /
        precoDia(ultimo, "mensal", "brl")
    );
    expect(
      creditoDiasUpgrade({
        atual: primeiro,
        novo: ultimo,
        ciclo: "mensal",
        moeda: "brl",
        diasRestantes: dias,
      })
    ).toBe(esperado);
  });

  it("diasRestantes negativo (validade vencida) → 0, nunca negativo", () => {
    expect(
      creditoDiasUpgrade({
        atual: primeiro,
        novo: ultimo,
        ciclo: "mensal",
        moeda: "brl",
        diasRestantes: -10,
      })
    ).toBe(0);
  });
});

describe("cabeNoPlano", () => {
  it("uso zerado cabe em qualquer plano", () => {
    for (const p of PLANOS) {
      expect(
        cabeNoPlano({ destino: p.id, artistas: 0, usuarios: 0, modelos: 0 })
      ).toEqual([]);
    }
  });

  it("uso acima do limite aponta a dimensão e quanto remover", () => {
    const menor = PLANOS[0];
    const estourado = cabeNoPlano({
      destino: menor.id,
      artistas: menor.maxArtistas + 3,
      usuarios: 0,
      modelos: 0,
    });
    expect(estourado).toHaveLength(1);
    expect(estourado[0]).toMatchObject({ dimensao: "artistas", remover: 3 });
  });
});
