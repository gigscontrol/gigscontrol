import { describe, it, expect } from "vitest";
import { preencher, normalizarToken, VALORES_EXEMPLO } from "./variaveis";

describe("normalizarToken", () => {
  it("minúsculas, sem acentos, _ vira espaço, conectivos caem", () => {
    expect(normalizarToken("ENDEREÇO_CONTRATANTE")).toBe("endereco contratante");
    expect(normalizarToken("Data do Evento")).toBe("data evento");
    expect(normalizarToken("rider de camarim")).toBe("rider camarim");
    expect(normalizarToken("  razao_social  ")).toBe("razao social");
  });
});

describe("preencher — matching tolerante (mesmo valor por 3 caminhos)", () => {
  const valores = {
    contratante: "Marcos Lima",
    documento: "123.456.789-00",
    endereco: "Rua A, 1",
    email: "m@x.com",
    telefone: "(11) 90000-0000",
    razao_social: "Lima Eventos LTDA",
    artista: "Maninhoo",
    artista_documento: "12.345.678/0001-90",
    evento: "Réveillon",
    data: "31/12/2026",
    endereco_local: "Av. B, 2",
    horario: "23h00",
    "rider de camarim": "Água x12",
    chave_pix_artista: "pix@maninhoo.com",
  };

  it("match exato continua funcionando", () => {
    expect(preencher("{{contratante}}", valores)).toBe("Marcos Lima");
    expect(preencher("{{ rider de camarim }}", valores)).toBe("Água x12");
  });

  it("maiúsculas/acentos/underscores não importam", () => {
    expect(preencher("{{RAZAO_SOCIAL}}", valores)).toBe("Lima Eventos LTDA");
    expect(preencher("{{Razão Social}}", valores)).toBe("Lima Eventos LTDA");
    expect(preencher("{{RIDER_DE_CAMARIM}}", valores)).toBe("Água x12");
  });

  it("apelidos intuitivos resolvem pro token canônico", () => {
    expect(preencher("{{CNPJ_CONTRATANTE}}", valores)).toBe("123.456.789-00");
    expect(preencher("{{ENDEREÇO_CONTRATANTE}}", valores)).toBe("Rua A, 1");
    expect(preencher("{{NOME_CONTRATANTE}}", valores)).toBe("Marcos Lima");
    expect(preencher("{{EMAIL_CONTRATANTE}}", valores)).toBe("m@x.com");
    expect(preencher("{{TELEFONE_CONTRATANTE}}", valores)).toBe("(11) 90000-0000");
    expect(preencher("{{NOME_ARTISTA}}", valores)).toBe("Maninhoo");
    expect(preencher("{{CNPJ_ARTISTA}}", valores)).toBe("12.345.678/0001-90");
    expect(preencher("{{NOME_DO_EVENTO}}", valores)).toBe("Réveillon");
    expect(preencher("{{DATA_DO_EVENTO}}", valores)).toBe("31/12/2026");
    expect(preencher("{{DATA_DO_SHOW}}", valores)).toBe("31/12/2026");
    expect(preencher("{{ENDEREÇO_DO_EVENTO}}", valores)).toBe("Av. B, 2");
    expect(preencher("{{HORARIO_INICIO}}", valores)).toBe("23h00");
  });

  it("legado {{forma de pagamento}} e variações de PIX resolvem pra chave_pix_artista", () => {
    expect(preencher("{{forma de pagamento}}", valores)).toBe("pix@maninhoo.com");
    expect(preencher("{{FORMA_DE_PAGAMENTO}}", valores)).toBe("pix@maninhoo.com");
    expect(preencher("{{CHAVE_PIX}}", valores)).toBe("pix@maninhoo.com");
    expect(preencher("{{PIX}}", valores)).toBe("pix@maninhoo.com");
  });

  it("token desconhecido permanece visível", () => {
    expect(preencher("{{NAO_EXISTE_MESMO}}", valores)).toBe("{{NAO_EXISTE_MESMO}}");
  });

  it("mistura num texto real", () => {
    const tpl =
      "CONTRATANTE: {{razao_social}} inscrito no CNPJ sob nº {{CNPJ_CONTRATANTE}} com sede {{ENDEREÇO_CONTRATANTE}}, representada por {{NOME_CONTRATANTE}}.";
    expect(preencher(tpl, valores)).toBe(
      "CONTRATANTE: Lima Eventos LTDA inscrito no CNPJ sob nº 123.456.789-00 com sede Rua A, 1, representada por Marcos Lima."
    );
  });

  it("apelidos também resolvem contra os VALORES_EXEMPLO do preview", () => {
    expect(preencher("{{NOME_ARTISTA}}", VALORES_EXEMPLO)).toBe(
      VALORES_EXEMPLO.artista
    );
    expect(preencher("{{CNPJ_CONTRATANTE}}", VALORES_EXEMPLO)).toBe(
      VALORES_EXEMPLO.documento
    );
  });
});
