import { describe, expect, it } from "vitest";
import { resolverMes } from "./periodo";

const OUT_2026 = new Date(2026, 9, 20); // 20/10/2026 (mes 0-based = 9)

describe("resolverMes", () => {
  it("Visão geral = tudo, apontando pro mês corrente", () => {
    expect(resolverMes("Visão geral", null, null, OUT_2026)).toEqual({ ano: 2026, mes: 9, tudo: true });
  });

  it("Mês atual / anterior / próximo", () => {
    expect(resolverMes("Mês atual", null, null, OUT_2026)).toEqual({ ano: 2026, mes: 9, tudo: false });
    expect(resolverMes("Mês anterior", null, null, OUT_2026)).toEqual({ ano: 2026, mes: 8, tudo: false });
    expect(resolverMes("Próximo mês", null, null, OUT_2026)).toEqual({ ano: 2026, mes: 10, tudo: false });
  });

  it("vira o ano em janeiro e dezembro", () => {
    expect(resolverMes("Mês anterior", null, null, new Date(2026, 0, 15))).toEqual({ ano: 2025, mes: 11, tudo: false });
    expect(resolverMes("Próximo mês", null, null, new Date(2026, 11, 31))).toEqual({ ano: 2027, mes: 0, tudo: false });
  });

  it("Personalizado usa o mês abreviado e o ano escolhidos", () => {
    expect(resolverMes("Personalizado", "Mar", 2025, OUT_2026)).toEqual({ ano: 2025, mes: 2, tudo: false });
  });

  it("Personalizado incompleto cai no mês atual", () => {
    expect(resolverMes("Personalizado", null, 2025, OUT_2026)).toEqual({ ano: 2026, mes: 9, tudo: false });
    expect(resolverMes("Personalizado", "Mar", null, OUT_2026)).toEqual({ ano: 2026, mes: 9, tudo: false });
  });
});
