import { describe, it, expect } from "vitest";
import { estadoAcessoDe, estadoAcessoDeSub } from "./acesso";

/**
 * O gate de acesso é a regra mais cara de errar do produto: decide quem usa o
 * app e quem é barrado. Casos espelham o contrato documentado em acesso.ts.
 */

const DIA = 86_400_000;
const iso = (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString();

describe("estadoAcessoDe", () => {
  it("dentro da validade → ok", () => {
    expect(estadoAcessoDe("ativa", iso(10 * DIA))).toBe("ok");
  });

  it("vencida há menos de 1 dia → graca", () => {
    expect(estadoAcessoDe("ativa", iso(-DIA / 2))).toBe("graca");
  });

  it("vencida além da graça → bloqueado", () => {
    expect(estadoAcessoDe("ativa", iso(-2 * DIA))).toBe("bloqueado");
  });

  it("suspended bloqueia MESMO com validade futura (chargeback)", () => {
    expect(estadoAcessoDe("suspended", iso(300 * DIA))).toBe("bloqueado");
  });

  it("cancelled bloqueia mesmo com validade futura", () => {
    expect(estadoAcessoDe("cancelled", iso(300 * DIA))).toBe("bloqueado");
  });

  it("sem acesso_ate (stub de checkout abandonado) → bloqueado, fecha o trial eterno", () => {
    expect(estadoAcessoDe("trial", null)).toBe("bloqueado");
  });

  it("data inválida → bloqueado (fail-closed)", () => {
    expect(estadoAcessoDe("ativa", "nao-e-data")).toBe("bloqueado");
  });
});

describe("estadoAcessoDeSub", () => {
  it("sem subscription (workspace legado da mig 25) → ok, grandfathering deliberado", () => {
    expect(estadoAcessoDeSub(null)).toBe("ok");
  });

  it("subscription com status null → ok (legado)", () => {
    expect(estadoAcessoDeSub({ status: null, acesso_ate: null })).toBe("ok");
  });

  it("subscription real delega pra estadoAcessoDe", () => {
    expect(
      estadoAcessoDeSub({ status: "ativa", acesso_ate: iso(5 * DIA) })
    ).toBe("ok");
    expect(estadoAcessoDeSub({ status: "trial", acesso_ate: null })).toBe(
      "bloqueado"
    );
  });
});
