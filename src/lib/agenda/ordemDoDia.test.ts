import { describe, expect, it } from "vitest";
import { layoutDoDia, ordenarShowsDoDia } from "./ordemDoDia";

type S = { id: string; status: "confirmado" | "cancelado"; time: string };

describe("ordenarShowsDoDia", () => {
  it("horário crescente, a definir depois, cancelados por último", () => {
    const dia: S[] = [
      { id: "cancelado-0030", status: "cancelado", time: "00:30" },
      { id: "0030", status: "confirmado", time: "00:30" },
      { id: "0230-cz", status: "confirmado", time: "02:30" },
      { id: "a-definir", status: "confirmado", time: "" },
      { id: "2300", status: "confirmado", time: "23:00" },
      { id: "0130", status: "confirmado", time: "01:30" },
    ];
    expect(ordenarShowsDoDia(dia).map((s) => s.id)).toEqual([
      "0030",
      "0130",
      "0230-cz",
      "2300",
      "a-definir",
      "cancelado-0030",
    ]);
  });

  it("não altera a lista original", () => {
    const dia: S[] = [
      { id: "b", status: "confirmado", time: "23:00" },
      { id: "a", status: "confirmado", time: "22:00" },
    ];
    ordenarShowsDoDia(dia);
    expect(dia.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("layoutDoDia", () => {
  it("até 2 itens: cartão completo", () => {
    expect(layoutDoDia(0)).toEqual({ modo: "cheio", visiveis: 0, ocultos: 0 });
    expect(layoutDoDia(2)).toEqual({ modo: "cheio", visiveis: 2, ocultos: 0 });
  });

  it("de 3 a 5: linhas compactas, sem esconder nada", () => {
    expect(layoutDoDia(3)).toEqual({ modo: "compacto", visiveis: 3, ocultos: 0 });
    expect(layoutDoDia(5)).toEqual({ modo: "compacto", visiveis: 5, ocultos: 0 });
  });

  it("acima de 5: 4 linhas + o resto no '+N mais'", () => {
    expect(layoutDoDia(6)).toEqual({ modo: "compacto", visiveis: 4, ocultos: 2 });
    expect(layoutDoDia(12)).toEqual({ modo: "compacto", visiveis: 4, ocultos: 8 });
  });
});
