import { describe, it, expect } from "vitest";
import { hojeBR, preencherSecoes, valoresDeVenda } from "./preencherSecoes";
import { LOGISTICA_VAZIA, type Artista, type Venda } from "@/types";
import type { SecaoModelo } from "@/lib/mappers/contratoModelo";

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

describe("preencherSecoes — seção Assinaturas (nomes resolvidos na geração)", () => {
  it("grava contratante/documento/artista resolvidos dentro da seção", () => {
    const secoes: SecaoModelo[] = [
      { id: "a", tipo: "assinaturas", testemunhas: [] },
    ];
    const [s] = preencherSecoes(secoes, {
      contratante: "Marcos Lima",
      documento: "109.293.599-17",
      artista: "Maninhoo",
    });
    expect(s).toEqual({
      id: "a",
      tipo: "assinaturas",
      testemunhas: [],
      contratanteNome: "Marcos Lima",
      contratanteDoc: "109.293.599-17",
      contratadoNome: "Maninhoo",
    });
  });
});

describe("preencherSecoes — seção Local e data", () => {
  it("resolve o local (com variáveis) e congela a data do dia", () => {
    const secoes: SecaoModelo[] = [
      { id: "ld", tipo: "localdata", local: "{{cidade}}", data: "" },
    ];
    const [s] = preencherSecoes(secoes, {
      cidade: "São José dos Pinhais",
      data_hoje: hojeBR(),
    });
    expect(s).toEqual({
      id: "ld",
      tipo: "localdata",
      local: "São José dos Pinhais",
      data: hojeBR(),
    });
  });
});

describe("valoresDeVenda — chave PIX e fallbacks de conteúdo (pt)", () => {
  it("documento do contratante ganha máscara; razão social vazia cai no nome", () => {
    const v = valoresDeVenda({
      venda: vendaBase({
        contratanteNome: "Matheus Henrique",
        contratanteDocumento: "10929359917",
      } as Partial<Venda>),
      artista,
      agencia: "GIGS",
      numero: "CTR-1",
    });
    expect(v.documento).toBe("109.293.599-17");
    expect(v.razao_social).toBe("Matheus Henrique");
  });

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
