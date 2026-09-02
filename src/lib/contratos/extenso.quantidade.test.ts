import { describe, it, expect } from "vitest";
import { formatarQuantidade, quantidadePorExtenso } from "./extenso";
import { linhasLogistica } from "@/lib/logisticaTexto";
import { LOGISTICA_VAZIA } from "@/types";

describe("formatarQuantidade — formato de contrato '01 (um)'", () => {
  it("dois dígitos + extenso, no idioma", () => {
    expect(formatarQuantidade(1)).toBe("01 (um)");
    expect(formatarQuantidade(2)).toBe("02 (dois)");
    expect(formatarQuantidade(3)).toBe("03 (três)");
    expect(formatarQuantidade(12)).toBe("12 (doze)");
    expect(formatarQuantidade(21)).toBe("21 (vinte e um)");
    expect(formatarQuantidade(3, "en")).toBe("03 (three)");
    expect(formatarQuantidade(5, "es")).toBe("05 (cinco)");
  });

  it("feminino flexiona só a última palavra (pt: uma/duas)", () => {
    expect(formatarQuantidade(1, "pt", "f")).toBe("01 (uma)");
    expect(formatarQuantidade(2, "pt", "f")).toBe("02 (duas)");
    expect(formatarQuantidade(21, "pt", "f")).toBe("21 (vinte e uma)");
    expect(quantidadePorExtenso(1, "fr", "f")).toBe("une");
  });
});

describe("linhasLogistica — formato extenso", () => {
  const logistica = {
    ...LOGISTICA_VAZIA,
    aereaIdaQtd: 2,
    aereaIdaOrigem: "GRU",
    aereaIdaDestino: "CWB",
    bagagemDespachadaQtd: 1,
  };

  it("usa '02 (duas)' no feminino em todas as superfícies", () => {
    const linhas = linhasLogistica(logistica);
    expect(linhas[0]).toBe("02 (duas) Passagem aérea ida (GRU>CWB)");
    expect(linhas[1]).toBe("01 (uma) Bagagem despachada extra");
  });
});
