import { describe, it, expect } from "vitest";
import { passaNoFiltro, filtroAtivo, artistasDosContatos, contatoPassa } from "./filtroArtistas";

describe("filtro de artistas", () => {
  it("coisa de artista marcado passa; de desmarcado não; sem artista sempre passa", () => {
    expect(passaNoFiltro("a1", ["a1"])).toBe(true);
    expect(passaNoFiltro("a2", ["a1"])).toBe(false);
    expect(passaNoFiltro(null, [])).toBe(true);
    expect(passaNoFiltro("", ["a1"])).toBe(true);
    expect(passaNoFiltro(undefined, ["a1"])).toBe(true);
  });

  it("filtro ativo só quando há artista desmarcado", () => {
    expect(filtroAtivo(["a1", "a2"], ["a1", "a2"])).toBe(false);
    expect(filtroAtivo(["a1"], ["a1", "a2"])).toBe(true);
    expect(filtroAtivo([], [])).toBe(false);
    expect(filtroAtivo([], ["a1"])).toBe(true);
  });

  it("contato herda os artistas do histórico; sem histórico sempre aparece", () => {
    const mapa = artistasDosContatos(
      [{ artistaId: "a1", contratanteId: "c1", casaId: "k1", cidadeId: "z1" }],
      [{ artistaId: "a2", contratanteId: "c2", casaId: "k1", cidadeId: "z2" }],
      [{ artistaId: "a3", contratanteId: "c3", casaId: null, cidadeId: null }]
    );
    // c1 só trabalhou com a1
    expect(contatoPassa(mapa.contratantes, "c1", ["a1"])).toBe(true);
    expect(contatoPassa(mapa.contratantes, "c1", ["a2"])).toBe(false);
    // casa k1 teve a1 e a2: basta um marcado
    expect(contatoPassa(mapa.casas, "k1", ["a2"])).toBe(true);
    expect(contatoPassa(mapa.casas, "k1", ["a3"])).toBe(false);
    // orçamento também conta
    expect(contatoPassa(mapa.contratantes, "c3", ["a3"])).toBe(true);
    // contato recém-criado, sem histórico: nunca some
    expect(contatoPassa(mapa.contratantes, "novo", [])).toBe(true);
    expect(contatoPassa(mapa.cidades, "z9", ["a1"])).toBe(true);
  });
});
