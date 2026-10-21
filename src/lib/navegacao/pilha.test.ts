import { describe, it, expect } from "vitest";
import { registrarVisita, temAnterior, anterior, restaurarPilha, LIMITE_PILHA } from "./pilha";

describe("pilha de navegação", () => {
  it("empilha visitas e reconhece o voltar", () => {
    let p = ["/app/financeiro"];
    p = registrarVisita(p, "/app/vendas/vendas/v1");
    expect(p).toEqual(["/app/financeiro", "/app/vendas/vendas/v1"]);
    expect(anterior(p)).toBe("/app/financeiro");
    // voltar (do app ou do navegador) chega na penúltima → desempilha
    p = registrarVisita(p, "/app/financeiro");
    expect(p).toEqual(["/app/financeiro"]);
    expect(temAnterior(p)).toBe(false);
  });

  it("caso real: abriu a venda pelo Financeiro → Voltar é o Financeiro, não a lista de vendas", () => {
    let p = ["/app/financeiro/pagamentos"];
    p = registrarVisita(p, "/app/vendas/vendas/v1");
    expect(anterior(p)).toBe("/app/financeiro/pagamentos");
  });

  it("re-render na mesma URL não duplica", () => {
    const p = ["/a", "/b"];
    expect(registrarVisita(p, "/b")).toBe(p);
  });

  it("substituir troca o topo (salvar formulário não deixa o form no histórico)", () => {
    let p = ["/app/vendas/vendas", "/app/vendas/vendas/nova"];
    p = registrarVisita(p, "/app/vendas/vendas/v9", true);
    expect(p).toEqual(["/app/vendas/vendas", "/app/vendas/vendas/v9"]);
    expect(anterior(p)).toBe("/app/vendas/vendas");
  });

  it("modal com endereço: abrir empilha, fechar volta", () => {
    let p = ["/app/vendas/vendas/v1"];
    p = registrarVisita(p, "/app/vendas/vendas/v1?show=s1");
    expect(anterior(p)).toBe("/app/vendas/vendas/v1");
    p = registrarVisita(p, "/app/vendas/vendas/v1");
    expect(p).toEqual(["/app/vendas/vendas/v1"]);
  });

  it("tem limite de tamanho", () => {
    let p: string[] = [];
    for (let i = 0; i < LIMITE_PILHA + 10; i++) p = registrarVisita(p, `/p${i}`);
    expect(p.length).toBe(LIMITE_PILHA);
    expect(p[p.length - 1]).toBe(`/p${LIMITE_PILHA + 9}`);
  });

  it("restaura só se a pilha salva termina na URL atual (F5)", () => {
    expect(restaurarPilha(["/a", "/b"], "/b")).toEqual(["/a", "/b"]);
    // chegou por link / outra aba / após login → recomeça
    expect(restaurarPilha(["/a", "/b"], "/c")).toEqual(["/c"]);
    expect(restaurarPilha("lixo", "/c")).toEqual(["/c"]);
    expect(restaurarPilha([1, 2], "/c")).toEqual(["/c"]);
    expect(restaurarPilha(null, "/c")).toEqual(["/c"]);
  });
});
