import { describe, expect, it } from "vitest";
import { criarPilhaModais } from "./pilhaModais";

describe("pilha de modais", () => {
  it("só o último aberto fica no topo", () => {
    const p = criarPilhaModais();
    const ficha = p.abrir();
    expect(p.noTopo(ficha)).toBe(true);
    const confirmacao = p.abrir();
    expect(p.noTopo(confirmacao)).toBe(true);
    expect(p.noTopo(ficha)).toBe(false);
  });

  it("fechar o de cima devolve o topo pro de baixo", () => {
    const p = criarPilhaModais();
    const ficha = p.abrir();
    const confirmacao = p.abrir();
    p.fechar(confirmacao);
    expect(p.noTopo(ficha)).toBe(true);
    expect(p.tamanho).toBe(1);
  });

  it("fechar o de baixo primeiro (desmonte de cima pra baixo) não bagunça", () => {
    const p = criarPilhaModais();
    const show = p.abrir();
    const notas = p.abrir();
    p.fechar(show);
    expect(p.noTopo(notas)).toBe(true);
    expect(p.tamanho).toBe(1);
    p.fechar(notas);
    expect(p.tamanho).toBe(0);
    expect(p.noTopo(notas)).toBe(false);
  });

  it("fechar duas vezes é inofensivo", () => {
    const p = criarPilhaModais();
    const a = p.abrir();
    const b = p.abrir();
    p.fechar(b);
    p.fechar(b);
    expect(p.tamanho).toBe(1);
    expect(p.noTopo(a)).toBe(true);
  });
});
