import { describe, expect, it } from "vitest";
import { corComoTexto, razaoContraste } from "./contraste";

describe("corComoTexto", () => {
  it("mistura a cor com o texto do tema (ou com o escuro fixo na folha branca)", () => {
    expect(corComoTexto("#eab308")).toBe("color-mix(in srgb, #eab308 50%, var(--text-primary))");
    expect(corComoTexto("#eab308", "claro")).toBe("color-mix(in srgb, #eab308 50%, #111726)");
  });
  it("50% de mistura passa de 4,5:1 em toda a paleta (pior caso calculado no tema claro)", () => {
    const mix = (a: string, b: string, p: number) => {
      const h = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
      const [x, y] = [h(a), h(b)];
      return "#" + x.map((v, i) => Math.round(v * p + y[i] * (1 - p)).toString(16).padStart(2, "0")).join("");
    };
    const paleta = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#6366f1"];
    for (const c of paleta) {
      const texto = mix(c, "#111726", 0.5); // tema claro: texto principal escuro
      const chip = mix(c, "#ffffff", 0.13); // chip com 13% da cor sobre branco
      expect(razaoContraste(texto, chip)!).toBeGreaterThanOrEqual(4.5);
    }
  });
});
