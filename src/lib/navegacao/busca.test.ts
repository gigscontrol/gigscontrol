import { describe, it, expect } from "vitest";
import { buscar, normalizar, pontuar, registrarRecente, resolverRecentes, type ItemBusca } from "./busca";

const itens: ItemBusca[] = [
  { id: "v1", tipo: "venda", titulo: "Skyfall Music", subtitulo: "Theuzzo", href: "/v1", texto: "VND-0063 Skyfall Music Theuzzo São Paulo", codigo: "VND-0063" },
  { id: "v2", tipo: "venda", titulo: "Formatura FMJ", href: "/v2", texto: "VND-0061 Formatura FMJ Dudu Curitiba", codigo: "VND-0061" },
  { id: "c1", tipo: "contratante", titulo: "Igor Fabrício", href: "/c1", texto: "Igor Fabrício +55 (41) 99767-3207 igor@x.com" },
  { id: "k1", tipo: "casa", titulo: "Level Club", href: "/k1", texto: "Level Club Curitiba" },
  { id: "p1", tipo: "pagina", titulo: "Todas as vendas", href: "/p1", texto: "Todas as vendas Vendas" },
];

describe("busca geral", () => {
  it("ignora acento e maiúscula", () => {
    expect(normalizar("FABRÍCIO  São")).toBe("fabricio sao");
    expect(buscar(itens, "fabricio").map((i) => i.id)).toEqual(["c1"]);
    expect(buscar(itens, "SAO PAULO").map((i) => i.id)).toEqual(["v1"]);
  });

  it("todas as palavras precisam aparecer, em qualquer ordem", () => {
    expect(buscar(itens, "curitiba dudu").map((i) => i.id)).toEqual(["v2"]);
    expect(buscar(itens, "curitiba theuzzo")).toEqual([]);
  });

  it("número da venda: exato vai pro topo; só o final também acha", () => {
    expect(buscar(itens, "vnd-0063")[0].id).toBe("v1");
    expect(buscar(itens, "0061")[0].id).toBe("v2");
  });

  it("telefone digitado só com números acha o formatado", () => {
    expect(buscar(itens, "997673207").map((i) => i.id)).toEqual(["c1"]);
  });

  it("começo do título pesa mais que meio do texto", () => {
    const a = pontuar(itens[3], "level");
    const b = pontuar(itens[1], "fmj");
    expect(a).toBeGreaterThan(b);
  });

  it("limita por tipo e consulta vazia não traz nada", () => {
    const muitos: ItemBusca[] = Array.from({ length: 9 }, (_, i) => ({
      id: `x${i}`, tipo: "casa", titulo: `Casa ${i}`, href: "/", texto: `Casa ${i}`,
    }));
    expect(buscar(muitos, "casa", 5)).toHaveLength(5);
    expect(buscar(itens, "   ")).toEqual([]);
  });
});

describe("recentes", () => {
  it("põe o último aberto na frente, sem repetir, até o limite", () => {
    expect(registrarRecente([], "a")).toEqual(["a"]);
    expect(registrarRecente(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(registrarRecente(["a", "b", "c", "d", "e"], "f")).toEqual(["f", "a", "b", "c", "d"]);
  });

  it("só devolve o que ainda existe no índice, na ordem dos recentes", () => {
    const r = resolverRecentes(["sumiu", "c1", "v1"], itens);
    expect(r.map((i) => i.id)).toEqual(["c1", "v1"]);
  });
});
