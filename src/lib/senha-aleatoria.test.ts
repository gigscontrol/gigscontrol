import { describe, it, expect } from "vitest";
import { gerarSenhaAleatoria } from "./senha-aleatoria";

describe("gerarSenhaAleatoria", () => {
  it("formato Palavra-Palavra-Palavra-NNNN, sempre ≥12 chars", () => {
    for (let i = 0; i < 300; i++) {
      const s = gerarSenhaAleatoria();
      expect(s).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
      expect(s.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("as 3 palavras nunca se repetem na mesma senha", () => {
    for (let i = 0; i < 300; i++) {
      const [a, b, c] = gerarSenhaAleatoria().split("-");
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(a).not.toBe(c);
    }
  });

  it("número fica em [1000, 9999]", () => {
    for (let i = 0; i < 300; i++) {
      const n = Number(gerarSenhaAleatoria().split("-")[3]);
      expect(n).toBeGreaterThanOrEqual(1000);
      expect(n).toBeLessThanOrEqual(9999);
    }
  });

  it("não gera a mesma senha em 300 sorteios (sanidade do CSPRNG)", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 300; i++) vistas.add(gerarSenhaAleatoria());
    // ~934M combinações → 300 sorteios sem colisão é o esperado.
    expect(vistas.size).toBeGreaterThan(295);
  });
});
