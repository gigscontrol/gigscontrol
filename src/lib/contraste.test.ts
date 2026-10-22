import { describe, expect, it } from "vitest";
import { corComoTexto, corTextoSobre, razaoContraste } from "./contraste";

describe("corTextoSobre", () => {
  it("cor clara pede texto escuro", () => {
    expect(corTextoSobre("#22C55E")).toBe("#111726"); // verde: branco dava 2,3:1
    expect(corTextoSobre("#EAB308")).toBe("#111726"); // amarelo: 1,9:1
    expect(corTextoSobre("#06B6D4")).toBe("#111726"); // ciano: 2,4:1
  });
  it("cor escura segue com branco", () => {
    expect(corTextoSobre("#1E3A8A")).toBe("#FFFFFF");
    expect(corTextoSobre("#7C2D12")).toBe("#FFFFFF");
  });
  it("o escolhido sempre tem mais contraste que o outro", () => {
    for (const c of ["#F97316", "#3B82F6", "#A855F7", "#EC4899", "#14B8A6", "#888888"]) {
      const escolhido = corTextoSobre(c);
      const outro = escolhido === "#FFFFFF" ? "#111726" : "#FFFFFF";
      expect(razaoContraste(escolhido, c)!).toBeGreaterThanOrEqual(razaoContraste(outro, c)!);
    }
  });
  it("aceita #RGB; o que não é hex cai no branco", () => {
    expect(corTextoSobre("#FF0")).toBe("#111726");
    expect(corTextoSobre("var(--brand)")).toBe("#FFFFFF");
    expect(corTextoSobre(undefined)).toBe("#FFFFFF");
  });
});

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
