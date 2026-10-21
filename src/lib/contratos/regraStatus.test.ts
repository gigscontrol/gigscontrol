import { describe, expect, it } from "vitest";
import { erroTrocaStatus } from "./regraStatus";

describe("erroTrocaStatus", () => {
  it("deixa marcar enviado à mão um rascunho", () => {
    expect(erroTrocaStatus({ statusAtual: "rascunho", statusNovo: "enviado", finalizado: false })).toBeNull();
  });

  it("exige motivo pra marcar assinado sem as assinaturas", () => {
    expect(erroTrocaStatus({ statusAtual: "enviado", statusNovo: "assinado", finalizado: false })?.status).toBe(400);
    expect(
      erroTrocaStatus({ statusAtual: "enviado", statusNovo: "assinado", finalizado: false, motivo: "   " })?.status
    ).toBe(400);
    expect(
      erroTrocaStatus({ statusAtual: "enviado", statusNovo: "assinado", finalizado: false, motivo: "assinado em papel" })
    ).toBeNull();
  });

  it("finalizado não volta pra rascunho nem enviado", () => {
    expect(erroTrocaStatus({ statusAtual: "assinado", statusNovo: "rascunho", finalizado: true })?.status).toBe(409);
    expect(erroTrocaStatus({ statusAtual: "cancelado", statusNovo: "enviado", finalizado: true })?.status).toBe(409);
  });

  it("finalizado pode ser cancelado e reativado como assinado, sem motivo", () => {
    expect(erroTrocaStatus({ statusAtual: "assinado", statusNovo: "cancelado", finalizado: true })).toBeNull();
    expect(erroTrocaStatus({ statusAtual: "cancelado", statusNovo: "assinado", finalizado: true })).toBeNull();
  });

  it("desmarcar um assinado manual é livre", () => {
    expect(erroTrocaStatus({ statusAtual: "assinado", statusNovo: "enviado", finalizado: false })).toBeNull();
  });

  it("sem troca não há erro", () => {
    expect(erroTrocaStatus({ statusAtual: "assinado", statusNovo: "assinado", finalizado: true })).toBeNull();
  });
});
