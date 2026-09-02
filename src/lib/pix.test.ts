import { describe, it, expect } from "vitest";
import { detectarChavePix, cpfValido, cnpjValido } from "./pix";

describe("detectarChavePix", () => {
  it("vazio → null", () => {
    expect(detectarChavePix("")).toBeNull();
    expect(detectarChavePix("   ")).toBeNull();
  });

  it("e-mail", () => {
    expect(detectarChavePix("dj@exemplo.com")).toBe("email");
    expect(detectarChavePix("dj@quebrado")).toBe("desconhecida");
  });

  it("chave aleatória (UUID)", () => {
    expect(detectarChavePix("123e4567-e89b-42d3-a456-426614174000")).toBe("aleatoria");
  });

  it("CPF válido (11 dígitos com DV corretos), com ou sem máscara", () => {
    // 529.982.247-25 é um CPF de teste com DV válidos.
    expect(detectarChavePix("529.982.247-25")).toBe("cpf");
    expect(detectarChavePix("52998224725")).toBe("cpf");
  });

  it("11 dígitos SEM DV de CPF → celular", () => {
    expect(detectarChavePix("11987654321")).toBe("telefone");
    expect(detectarChavePix("(11) 98765-4321")).toBe("telefone");
  });

  it("telefone: fixo (10), E.164 e com código do país", () => {
    expect(detectarChavePix("1133334444")).toBe("telefone");
    expect(detectarChavePix("+5511987654321")).toBe("telefone");
    expect(detectarChavePix("5511987654321")).toBe("telefone");
  });

  it("CNPJ válido; inválido não passa como CNPJ", () => {
    // 11.222.333/0001-81 tem DV válidos.
    expect(detectarChavePix("11.222.333/0001-81")).toBe("cnpj");
    expect(detectarChavePix("11.222.333/0001-99")).toBe("desconhecida");
  });

  it("lixo → desconhecida", () => {
    expect(detectarChavePix("abc123")).toBe("desconhecida");
    expect(detectarChavePix("123")).toBe("desconhecida");
  });
});

describe("validadores", () => {
  it("cpfValido rejeita sequências repetidas e DV errado", () => {
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("529.982.247-25")).toBe(true);
  });
  it("cnpjValido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
  });
});
