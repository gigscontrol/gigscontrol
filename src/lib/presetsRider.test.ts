import { describe, it, expect } from "vitest";
import {
  normalizarPresets,
  presetAtivo,
  aplicarPreset,
  MAX_PRESETS_POR_CATEGORIA,
} from "./presetsRider";

const PRESET_1 = {
  nome: "Padrão",
  itens: [
    { nome: "Garrafa de Jack Daniels N7", qtd: 1 },
    { nome: "Energético Redbull Tradicional", qtd: 6 },
    { nome: "Refrigerante Lata", qtd: 6 },
    { nome: "Garrafa de Água", qtd: 6 },
  ],
};
const PRESET_2 = {
  nome: "Festival",
  itens: [
    { nome: "Garrafa de Jack Daniels N7", qtd: 10 },
    { nome: "Energético Redbull Tradicional", qtd: 6 },
    { nome: "Refrigerante Lata", qtd: 6 },
    { nome: "Garrafa de Água", qtd: 6 },
  ],
};

/** Cardápio do form: catálogo com quantidades zeradas + alguns extras. */
const CARDAPIO = [
  { nome: "Garrafa de Jack Daniels N7", qtd: 0 },
  { nome: "Energético Redbull Tradicional", qtd: 0 },
  { nome: "Refrigerante Lata", qtd: 0 },
  { nome: "Garrafa de Água", qtd: 0 },
  { nome: "Pizza Gigante Calabresa", qtd: 0 },
];

describe("normalizarPresets", () => {
  it("lixo vira vazio, nunca lança", () => {
    for (const raw of [null, undefined, 42, "x", [], { camarim: "nope" }]) {
      const p = normalizarPresets(raw);
      expect(p.camarim).toEqual([]);
      expect(p.efeitos).toEqual([]);
      expect(p.tecnico).toEqual([]);
    }
  });

  it("aceita presets válidos e descarta slot sem nome ou sem itens", () => {
    const p = normalizarPresets({
      camarim: [
        PRESET_1,
        { nome: "", itens: PRESET_1.itens }, // sem nome → fora
        { nome: "Vazio", itens: [] }, // sem itens → fora
        { nome: "Só zeros", itens: [{ nome: "Água", qtd: 0 }] }, // qtd 0 → item fora → preset fora
      ],
    });
    expect(p.camarim).toHaveLength(1);
    expect(p.camarim[0].nome).toBe("Padrão");
    expect(p.camarim[0].itens).toHaveLength(4);
  });

  it("corta em MAX_PRESETS_POR_CATEGORIA", () => {
    const muitos = Array.from({ length: 6 }, (_, i) => ({
      nome: `P${i}`,
      itens: [{ nome: "Água", qtd: 1 }],
    }));
    expect(normalizarPresets({ efeitos: muitos }).efeitos).toHaveLength(
      MAX_PRESETS_POR_CATEGORIA
    );
  });
});

describe("aplicarPreset + presetAtivo (o ciclo do seletor)", () => {
  it("aplicar preset preenche as quantidades por nome e zera o resto", () => {
    const aplicado = aplicarPreset(CARDAPIO, PRESET_1);
    expect(aplicado.find((i) => i.nome === "Garrafa de Jack Daniels N7")?.qtd).toBe(1);
    expect(aplicado.find((i) => i.nome === "Garrafa de Água")?.qtd).toBe(6);
    expect(aplicado.find((i) => i.nome === "Pizza Gigante Calabresa")?.qtd).toBe(0);
    expect(aplicado).toHaveLength(CARDAPIO.length); // nada anexado: tudo já estava
  });

  it("item do preset fora do cardápio é anexado ao fim", () => {
    const preset = { nome: "X", itens: [{ nome: "Item Exótico", qtd: 2 }] };
    const aplicado = aplicarPreset(CARDAPIO, preset);
    expect(aplicado[aplicado.length - 1]).toEqual({ nome: "Item Exótico", qtd: 2 });
  });

  it("depois de aplicar, o preset aparece como ATIVO", () => {
    const aplicado = aplicarPreset(CARDAPIO, PRESET_2);
    expect(presetAtivo(aplicado, [PRESET_1, PRESET_2])).toBe(1);
  });

  it("editar QUALQUER quantidade derruba pra Personalizado (null)", () => {
    const aplicado = aplicarPreset(CARDAPIO, PRESET_1);
    const editado = aplicado.map((i) =>
      i.nome === "Refrigerante Lata" ? { ...i, qtd: 9 } : i
    );
    expect(presetAtivo(editado, [PRESET_1, PRESET_2])).toBeNull();
  });

  it("desfazer a edição na mão REACENDE o preset (estado derivado)", () => {
    const aplicado = aplicarPreset(CARDAPIO, PRESET_1);
    const editado = aplicado.map((i) =>
      i.nome === "Refrigerante Lata" ? { ...i, qtd: 9 } : i
    );
    const desfeito = editado.map((i) =>
      i.nome === "Refrigerante Lata" ? { ...i, qtd: 6 } : i
    );
    expect(presetAtivo(desfeito, [PRESET_1, PRESET_2])).toBe(0);
  });

  it("adicionar item extra também derruba pra Personalizado", () => {
    const aplicado = aplicarPreset(CARDAPIO, PRESET_1);
    const comExtra = aplicado.map((i) =>
      i.nome === "Pizza Gigante Calabresa" ? { ...i, qtd: 1 } : i
    );
    expect(presetAtivo(comExtra, [PRESET_1, PRESET_2])).toBeNull();
  });

  it("linhas com qtd 0 não entram na identidade (cardápios diferentes, mesmo preset)", () => {
    const cardapioMenor = CARDAPIO.slice(0, 4); // sem a pizza
    const a = aplicarPreset(CARDAPIO, PRESET_1);
    const b = aplicarPreset(cardapioMenor, PRESET_1);
    expect(presetAtivo(a, [PRESET_1])).toBe(0);
    expect(presetAtivo(b, [PRESET_1])).toBe(0);
  });

  it("trocar de preset por cima de outro funciona (aplicar 2 depois do 1)", () => {
    const um = aplicarPreset(CARDAPIO, PRESET_1);
    const dois = aplicarPreset(um, PRESET_2);
    expect(presetAtivo(dois, [PRESET_1, PRESET_2])).toBe(1);
    expect(dois.find((i) => i.nome === "Garrafa de Jack Daniels N7")?.qtd).toBe(10);
  });
});
