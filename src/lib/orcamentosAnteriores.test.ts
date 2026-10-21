import { describe, expect, it } from "vitest";
import type { Casa, Cidade, Orcamento } from "@/types";
import { idsDaCidade, orcamentosDaCidade, orcamentosDoEvento } from "./orcamentosAnteriores";

const cidade = (id: string, nome: string, estado: string, ibgeId?: string) =>
  ({ id, nome, estado, ibgeId, regiao: "Sul" }) as Cidade;
const orc = (id: string, criadoEm: string, extra: Partial<Orcamento> = {}) =>
  ({ id, numero: id, criadoEm, cidadeId: "", casaId: undefined, ...extra }) as unknown as Orcamento;

const cidades = [
  cidade("c1", "Curitiba", "PR", "4106902"),
  cidade("c2", "Curitiba", "PR"), // cadastro antigo, sem IBGE
  cidade("c3", "São José dos Pinhais", "PR", "4125506"),
];

describe("idsDaCidade", () => {
  it("casa por IBGE e também o cadastro antigo com mesmo nome + UF", () => {
    expect([...idsDaCidade({ ibgeId: "4106902", nome: "Curitiba", uf: "PR" }, cidades)].sort()).toEqual(["c1", "c2"]);
  });

  it("ignora acento e maiúscula no nome", () => {
    expect([...idsDaCidade({ nome: "sao jose dos pinhais", uf: "pr" }, cidades)]).toEqual(["c3"]);
  });

  it("cidade sem cadastro → vazio", () => {
    expect(idsDaCidade({ ibgeId: "999", nome: "Londrina", uf: "PR" }, cidades).size).toBe(0);
  });
});

describe("orcamentosDaCidade", () => {
  it("só os da cidade, mais recente primeiro", () => {
    const lista = [
      orc("ORC-1", "2026-09-01", { cidadeId: "c1" }),
      orc("ORC-2", "2026-10-05", { cidadeId: "c2" }),
      orc("ORC-3", "2026-10-10", { cidadeId: "c3" }),
    ];
    expect(orcamentosDaCidade(lista, new Set(["c1", "c2"])).map((o) => o.id)).toEqual(["ORC-2", "ORC-1"]);
    expect(orcamentosDaCidade(lista, new Set())).toEqual([]);
  });
});

describe("orcamentosDoEvento", () => {
  const casas = [{ id: "k1", nome: "Burley Club" }] as Casa[];
  const lista = [
    orc("ORC-1", "2026-09-01", { casaId: "k1" }),
    orc("ORC-2", "2026-10-05", { detalhesEvento: { nomeEvento: "Réveillon Burley 2027" } }),
    orc("ORC-3", "2026-10-10", { detalhesEvento: { nomeLocal: "Pedrão Bar" } }),
  ];

  it("acha pelo nome da casa, do evento ou do local, sem acento", () => {
    expect(orcamentosDoEvento(lista, casas, ["burley"]).map((o) => o.id)).toEqual(["ORC-2", "ORC-1"]);
    expect(orcamentosDoEvento(lista, casas, ["", "pedrao"]).map((o) => o.id)).toEqual(["ORC-3"]);
  });

  it("menos de 4 letras não procura", () => {
    expect(orcamentosDoEvento(lista, casas, ["bur"])).toEqual([]);
  });
});
