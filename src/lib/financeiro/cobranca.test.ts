import { describe, expect, it } from "vitest";
import { diasDeAtraso, linkCobrancaWhatsApp, textoCobranca, tipoCobranca, type DadosCobranca } from "./cobranca";

const HOJE = new Date("2026-10-21T15:00:00");
const base: DadosCobranca = {
  contratante: "Rafael Moreira",
  artista: "Maninho",
  evento: "Casamento",
  dataShow: "2026-08-23",
  vendaNumero: "VND-0045",
  indice: 1,
  total: 2,
  valor: "R$ 1.800,00",
  vencimento: "2026-08-24",
  pix: "41999990000",
  favorecido: "Fulano de Tal ME",
  vezesAntes: 0,
};

describe("diasDeAtraso", () => {
  it("positivo quando atrasou, negativo quando ainda vai vencer, 0 no dia", () => {
    expect(diasDeAtraso("2026-08-24", HOJE)).toBe(58);
    expect(diasDeAtraso("2026-10-23", HOJE)).toBe(-2);
    expect(diasDeAtraso("2026-10-21", HOJE)).toBe(0);
  });
});

describe("tipoCobranca", () => {
  it("lembrete antes de vencer, primeira na 1ª, insistência da 2ª em diante", () => {
    expect(tipoCobranca({ vencimento: "2026-10-23", vezesAntes: 0 }, HOJE)).toBe("lembrete");
    expect(tipoCobranca({ vencimento: "2026-08-24", vezesAntes: 0 }, HOJE)).toBe("primeira");
    expect(tipoCobranca({ vencimento: "2026-08-24", vezesAntes: 2 }, HOJE)).toBe("insistencia");
  });
});

describe("textoCobranca", () => {
  it("1ª cobrança: gentil, com valor, vencimento e PIX", () => {
    const t = textoCobranca(base, HOJE);
    expect(t).toContain("Olá, Rafael! Tudo bem?");
    expect(t).toContain("*parcela 1/2* do show do *Maninho* (Casamento, 23/08/2026), venda VND-0045");
    expect(t).toContain("*Valor:* R$ 1.800,00");
    expect(t).toContain("*Vencimento:* 24/08/2026");
    expect(t).toContain("*Chave:* 41999990000");
    expect(t).toContain("*Favorecido:* Fulano de Tal ME");
    expect(t).toContain("comprovante");
  });

  it("2ª em diante: direta, diz há quantos dias e pede uma data", () => {
    const t = textoCobranca({ ...base, vezesAntes: 1 }, HOJE);
    expect(t).toContain("Ainda não identificamos o pagamento");
    expect(t).toContain("(há 58 dias)");
    expect(t).toContain("Consegue me confirmar uma data");
    expect(t).toContain("Pra regularizar via PIX:");
  });

  it("lembrete: ainda não venceu", () => {
    const t = textoCobranca({ ...base, vencimento: "2026-10-23" }, HOJE);
    expect(t).toContain("vence em *23/10/2026*");
    expect(t).not.toContain("comprovante");
  });

  it("sem PIX, sem evento e sem nome não deixa buraco", () => {
    const t = textoCobranca({ ...base, pix: "", evento: "", contratante: "" }, HOJE);
    expect(t).not.toContain("PIX");
    expect(t).toContain("Olá! Tudo bem?");
    expect(t).toContain("do show do *Maninho* (23/08/2026)");
  });
});

describe("linkCobrancaWhatsApp", () => {
  it("usa o número com o país e codifica o texto; sem número, deixa escolher o contato", () => {
    expect(linkCobrancaWhatsApp("+55 (41) 99999-0000", "Oi *você*")).toBe("https://wa.me/5541999990000?text=Oi%20*voc%C3%AA*");
    expect(linkCobrancaWhatsApp(undefined, "Oi")).toBe("https://wa.me/?text=Oi");
  });
});
