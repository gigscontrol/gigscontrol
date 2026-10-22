import { describe, expect, it } from "vitest";
import { corTextoSobre, razaoContraste } from "./contraste";

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
