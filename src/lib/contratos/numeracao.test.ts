import { describe, it, expect } from "vitest";
import { calcularNumeracao } from "./numeracao";
import { secoesValidas, type SecaoModelo } from "@/lib/mappers/contratoModelo";

describe("calcularNumeracao — seção de cláusulas (container)", () => {
  it("numera várias cláusulas na MESMA seção, com subs N.M e contagem global", () => {
    const secoes: SecaoModelo[] = [
      {
        id: "s1",
        tipo: "clausula",
        titulo: "CONDIÇÕES GERAIS",
        itens: [
          { id: "c1", tipo: "clausula", texto: "DO OBJETO" },
          { id: "c1a", tipo: "subclausula", texto: "..." },
          { id: "c1b", tipo: "subclausula", texto: "..." },
          { id: "p1", tipo: "paragrafo", texto: "..." },
          { id: "c2", tipo: "clausula", texto: "DOS SERVIÇOS" },
          { id: "c2a", tipo: "subclausula", texto: "..." },
        ],
      },
      {
        id: "s2",
        tipo: "clausula",
        titulo: "",
        itens: [
          { id: "c3", tipo: "clausula", texto: "DO PAGAMENTO" },
          { id: "c3a", tipo: "subclausula", texto: "..." },
        ],
      },
    ];
    const num = calcularNumeracao(secoes);
    expect(num.clausulas).toEqual({ c1: 1, c2: 2, c3: 3 });
    expect(num.itens).toEqual({ c1a: "1.1", c1b: "1.2", c2a: "2.1", c3a: "3.1" });
  });

  it("sub-cláusula sem cláusula aberta cria cláusula implícita (numeração não quebra)", () => {
    const secoes: SecaoModelo[] = [
      {
        id: "s1",
        tipo: "clausula",
        titulo: "",
        itens: [
          { id: "a", tipo: "subclausula", texto: "..." },
          { id: "b", tipo: "subclausula", texto: "..." },
          { id: "c", tipo: "clausula", texto: "SEGUINTE" },
          { id: "d", tipo: "subclausula", texto: "..." },
        ],
      },
    ];
    const num = calcularNumeracao(secoes);
    expect(num.itens).toEqual({ a: "1.1", b: "1.2", d: "2.1" });
    expect(num.clausulas).toEqual({ c: 2 });
  });
});

describe("secoesValidas — formato antigo (1 seção = 1 cláusula)", () => {
  it("título antigo vira TÍTULO DA SEÇÃO (sem item cláusula); subs numeram via cláusula implícita", () => {
    const antigas = [
      {
        id: "s1",
        tipo: "clausula",
        titulo: "II DO OBJETO DO CONTRATO",
        itens: [
          { id: "i1", tipo: "subclausula", texto: "aaa" },
          { id: "i2", tipo: "paragrafo", texto: "bbb" },
        ],
      },
      {
        id: "s2",
        tipo: "clausula",
        titulo: "III DOS SERVIÇOS",
        itens: [{ id: "i3", tipo: "subclausula", texto: "ccc" }],
      },
    ];
    const secoes = secoesValidas(antigas);
    expect(secoes).toEqual(antigas);
    // Numeração N.M continua a mesma do render antigo (1.1, 2.1…).
    const num = calcularNumeracao(secoes);
    expect(num.clausulas).toEqual({});
    expect(num.itens).toEqual({ i1: "1.1", i3: "2.1" });
  });

  it("seção já no formato novo passa intacta (sem re-migrar)", () => {
    const novas = [
      {
        id: "s1",
        tipo: "clausula",
        titulo: "GERAL",
        itens: [
          { id: "c1", tipo: "clausula", texto: "DO OBJETO" },
          { id: "i1", tipo: "subclausula", texto: "aaa" },
        ],
      },
    ];
    expect(secoesValidas(novas)).toEqual(novas);
  });
});
