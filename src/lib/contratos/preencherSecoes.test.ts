import { describe, it, expect } from "vitest";
import { valoresDeVenda } from "./preencherSecoes";
import { LOGISTICA_VAZIA, type Artista, type Venda } from "@/types";

/** Venda mínima pro teste — só os campos que valoresDeVenda lê. */
function vendaBase(extra: Partial<Venda> = {}): Venda {
  return {
    contratanteNome: "Marcos",
    moeda: "BRL",
    camarim: [],
    efeitos: [],
    hotel: [],
    tecnico: [],
    logistica: { ...LOGISTICA_VAZIA },
    ...extra,
  } as unknown as Venda;
}

const artista = {
  name: "Maninhoo",
  pix: "529.982.247-25",
  riderTecnico: ["CDJ-3000 x2"],
} as unknown as Artista;

describe("valoresDeVenda — chave PIX e fallbacks de conteúdo (pt)", () => {
  it("nada selecionado na venda → textos de praxe", () => {
    const v = valoresDeVenda({
      venda: vendaBase(),
      artista,
      agencia: "GIGS",
      numero: "CTR-1",
    });
    expect(v["rider de camarim"]).toBe("Sem rider de camarim");
    expect(v["rider de efeitos"]).toBe("Sem efeitos");
    expect(v.hospedagem).toBe("Hospedagem já inclusa no cachê");
    expect(v.logistica).toBe("Logística já inclusa no cachê");
    expect(v.chave_pix_artista).toBe("529.982.247-25");
  });

  it("seleção da venda (qtd > 0) vence o fallback, no formato Nome xQtd", () => {
    const v = valoresDeVenda({
      venda: vendaBase({
        camarim: [
          { nome: "Whisky", qtd: 1 },
          { nome: "Água", qtd: 12 },
          { nome: "Ignorado", qtd: 0 },
        ],
        efeitos: [{ nome: "CO2", qtd: 4 }],
        hotel: [
          { nome: "Diária hotel 4 estrelas", qtd: 1 },
          { nome: "Quarto Duplo", qtd: 2 },
        ],
        logistica: { ...LOGISTICA_VAZIA, transladoTerrestre: true },
      } as Partial<Venda>),
      artista,
      agencia: "GIGS",
      numero: "CTR-1",
    });
    expect(v["rider de camarim"]).toBe("01 (um) Whisky, 12 (doze) Água");
    expect(v["rider de efeitos"]).toBe("04 (quatro) CO2");
    expect(v.hospedagem).toBe(
      "01 (um) Diária hotel 4 estrelas, 02 (dois) Quartos Duplos"
    );
    expect(v.logistica).toContain("Translado Terrestre");
  });

  it("fallbacks seguem o idioma do modelo (en)", () => {
    const v = valoresDeVenda({
      venda: vendaBase(),
      artista,
      agencia: "GIGS",
      numero: "CTR-1",
      idioma: "en",
    });
    expect(v.hospedagem).toBe("Accommodation already included in the fee");
    expect(v["rider de efeitos"]).toBe("No special effects");
  });

  it("rider técnico: seleção da venda vence; sem seleção cai no cadastro", () => {
    const semSelecao = valoresDeVenda({
      venda: vendaBase(),
      artista,
      agencia: "GIGS",
      numero: "CTR-1",
    });
    expect(semSelecao["rider tecnico"]).toBe("CDJ-3000 x2");
    const comSelecao = valoresDeVenda({
      venda: vendaBase({ tecnico: [{ nome: "DJM-900", qtd: 1 }] } as Partial<Venda>),
      artista,
      agencia: "GIGS",
      numero: "CTR-1",
    });
    expect(comSelecao["rider tecnico"]).toBe("01 (um) DJM-900");
  });
});
