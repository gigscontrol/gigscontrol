import { afterEach, describe, expect, it } from "vitest";
import {
  formatarData,
  formatarDataExtenso,
  formatarDataHora,
  formatarDiaMes,
  formatarNumero,
  hojeISO,
  tempoRelativo,
} from "./formatters";
import { setIdiomaFormatos, setPreferencias } from "./preferencias";
import { dataNoMes } from "./periodo";

const t = (s: string, p?: Record<string, string | number>) =>
  p ? Object.entries(p).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s) : s;

afterEach(() => {
  setPreferencias({ formatoData: "dmy" });
  setIdiomaFormatos("pt");
});

describe("formatarData", () => {
  it("dia puro não volta um dia (era meia-noite UTC)", () => {
    expect(formatarData("2026-08-24")).toBe("24/08/2026");
  });
  it("timestamp vira o dia LOCAL", () => {
    expect(formatarData(new Date(2026, 7, 24, 23, 30))).toBe("24/08/2026");
  });
  it("segue a preferência MM/DD", () => {
    setPreferencias({ formatoData: "mdy" });
    expect(formatarData("2026-08-24")).toBe("08/24/2026");
    expect(formatarDiaMes("2026-08-24")).toBe("08/24");
  });
  it("vazio ou inválido = string vazia", () => {
    expect(formatarData(undefined)).toBe("");
    expect(formatarData("lixo")).toBe("");
  });
  it("data e hora", () => {
    expect(formatarDataHora(new Date(2026, 7, 24, 14, 5))).toBe("24/08/2026, 14:05");
  });
});

describe("idioma da interface", () => {
  it("mês por extenso e números seguem o idioma", () => {
    expect(formatarDataExtenso("2026-08-24", { month: "long" })).toBe("agosto");
    setIdiomaFormatos("en");
    expect(formatarDataExtenso("2026-08-24", { month: "long" })).toBe("August");
    expect(formatarNumero(1500)).toBe("1,500");
  });
});

describe("hojeISO", () => {
  it("usa o dia local mesmo à noite (toISOString virava amanhã)", () => {
    expect(hojeISO(new Date(2026, 9, 21, 23, 50))).toBe("2026-10-21");
  });
});

describe("tempoRelativo", () => {
  const agora = new Date(2026, 9, 22, 12, 0);
  it("minutos, horas e dias", () => {
    expect(tempoRelativo(new Date(2026, 9, 22, 11, 55).toISOString(), t, { agora })).toBe("há 5 min");
    expect(tempoRelativo(new Date(2026, 9, 22, 9, 0).toISOString(), t, { agora })).toBe("há 3h");
    expect(tempoRelativo(new Date(2026, 9, 21, 12, 0).toISOString(), t, { agora })).toBe("há 1 dia");
  });
  it("depois de 7 dias mostra a data", () => {
    expect(tempoRelativo(new Date(2026, 9, 1, 12, 0).toISOString(), t, { agora })).toBe("01/10/2026");
  });
});

describe("dataNoMes", () => {
  const out = { ano: 2026, mes: 9, tudo: false };
  it("dia puro e timestamp", () => {
    expect(dataNoMes("2026-10-01", out)).toBe(true);
    expect(dataNoMes("2026-09-30", out)).toBe(false);
  });
  it("sem data: fora, a não ser com semDataEntra", () => {
    expect(dataNoMes(undefined, out)).toBe(false);
    expect(dataNoMes(undefined, out, { semDataEntra: true })).toBe(true);
  });
  it("tudo = sempre", () => {
    expect(dataNoMes(undefined, { ...out, tudo: true })).toBe(true);
  });
});
