import { describe, it, expect } from "vitest";
import { comparar, ordenar, proximaOrdem, paginar } from "./lista";

describe("lista padrão — ordenar", () => {
  it("texto em português: sem diferença de acento/maiúscula e números em ordem natural", () => {
    const nomes = ["Évora", "abc", "Zeta", "ana", "VND-10", "VND-9"];
    expect(ordenar(nomes, (x) => x, "asc")).toEqual(["abc", "ana", "Évora", "VND-9", "VND-10", "Zeta"]);
  });

  it("números e decrescente", () => {
    expect(ordenar([3, 10, 1], (x) => x, "desc")).toEqual([10, 3, 1]);
  });

  it("vazio vai sempre pro fim, nas duas direções", () => {
    const v = ["b", "", null, "a", undefined];
    expect(ordenar(v, (x) => x, "asc").slice(0, 2)).toEqual(["a", "b"]);
    expect(ordenar(v, (x) => x, "desc").slice(0, 2)).toEqual(["b", "a"]);
    expect(comparar(null, "a", "desc")).toBe(1);
  });

  it("estável: empate mantém a ordem original", () => {
    const itens = [{ id: 1, g: "x" }, { id: 2, g: "x" }, { id: 3, g: "a" }];
    expect(ordenar(itens, (i) => i.g, "asc").map((i) => i.id)).toEqual([3, 1, 2]);
  });
});

describe("lista padrão — clique no título", () => {
  it("asc → desc → ordem original", () => {
    let o = proximaOrdem(null, "nome");
    expect(o).toEqual({ chave: "nome", direcao: "asc" });
    o = proximaOrdem(o, "nome");
    expect(o).toEqual({ chave: "nome", direcao: "desc" });
    expect(proximaOrdem(o, "nome")).toBeNull();
  });
  it("datas/valores começam do maior", () => {
    let o = proximaOrdem(null, "data", true);
    expect(o).toEqual({ chave: "data", direcao: "desc" });
    o = proximaOrdem(o, "data", true);
    expect(o).toEqual({ chave: "data", direcao: "asc" });
  });
  it("trocar de coluna recomeça", () => {
    expect(proximaOrdem({ chave: "a", direcao: "desc" }, "b")).toEqual({ chave: "b", direcao: "asc" });
  });
});

describe("lista padrão — paginar", () => {
  const cem = Array.from({ length: 103 }, (_, i) => i + 1);
  it("recorta e informa o intervalo", () => {
    const p = paginar(cem, 2, 50);
    expect(p.itens[0]).toBe(51);
    expect(p.inicio).toBe(51);
    expect(p.fim).toBe(100);
    expect(p.totalPaginas).toBe(3);
  });
  it("última página parcial e página fora do intervalo", () => {
    expect(paginar(cem, 3, 50).itens).toEqual([101, 102, 103]);
    expect(paginar(cem, 99, 50).pagina).toBe(3);
    expect(paginar(cem, 0, 50).pagina).toBe(1);
  });
  it("lista vazia", () => {
    const p = paginar([], 1, 50);
    expect(p).toMatchObject({ total: 0, inicio: 0, fim: 0, totalPaginas: 1, pagina: 1 });
  });
});
