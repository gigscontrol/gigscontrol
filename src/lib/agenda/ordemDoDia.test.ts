import { describe, expect, it } from "vitest";
import { ordenarShowsDoDia } from "./ordemDoDia";

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
