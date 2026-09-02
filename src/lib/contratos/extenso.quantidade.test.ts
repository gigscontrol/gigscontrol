import { describe, it, expect } from "vitest";
import { formatarQuantidade, quantidadePorExtenso } from "./extenso";
import { linhasLogistica } from "@/lib/logisticaTexto";
import { numeroQtd, pluralizarItemHotel } from "@/lib/quantidades";
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

describe("linhasLogistica — texto (número só) × contrato (extenso), com plural", () => {
  const logistica = {
    ...LOGISTICA_VAZIA,
    aereaIdaQtd: 2,
    aereaIdaOrigem: "GRU",
    aereaIdaDestino: "CWB",
    aereaVoltaQtd: 1,
    aereaVoltaOrigem: "CWB",
    aereaVoltaDestino: "GRU",
    bagagemDespachadaQtd: 3,
  };

  it("texto (default): número com 2 dígitos, substantivo no plural quando > 1", () => {
    const linhas = linhasLogistica(logistica);
    expect(linhas[0]).toBe("02 Passagens aéreas ida (GRU>CWB)");
    expect(linhas[1]).toBe("01 Passagem aérea volta (CWB>GRU)");
    expect(linhas[2]).toBe("03 Bagagens despachadas extras");
  });

  it("contrato: mesmo plural, com o extenso no feminino", () => {
    const linhas = linhasLogistica(logistica, "contrato");
    expect(linhas[0]).toBe("02 (duas) Passagens aéreas ida (GRU>CWB)");
    expect(linhas[1]).toBe("01 (uma) Passagem aérea volta (CWB>GRU)");
    expect(linhas[2]).toBe("03 (três) Bagagens despachadas extras");
  });
});

describe("quantidades — numeroQtd e plural de hotel", () => {
  it("numeroQtd sempre com 2 dígitos", () => {
    expect(numeroQtd(1)).toBe("01");
    expect(numeroQtd(12)).toBe("12");
  });

  it("pluralizarItemHotel: quarto p/ 1, quartos p/ mais de 1", () => {
    expect(pluralizarItemHotel("Quarto Single", 1)).toBe("Quarto Single");
    expect(pluralizarItemHotel("Quarto Single", 2)).toBe("Quartos Single");
    expect(pluralizarItemHotel("Quarto Duplo", 3)).toBe("Quartos Duplos");
    expect(pluralizarItemHotel("Quarto Triplo", 2)).toBe("Quartos Triplos");
    expect(pluralizarItemHotel("Diária com café", 2)).toBe("Diárias com café");
    expect(pluralizarItemHotel("Chalé na praia", 2)).toBe("Chalé na praia");
  });
});
