import { describe, it, expect } from "vitest";
import {
  sha256Hex,
  canonicalizarConteudo,
  hashConteudoContrato,
  gerarVerificacaoId,
  verificacaoIdValido,
  gerarCodigoOtp,
  hashOtp,
  otpConfere,
} from "./integridade";

describe("hash do conteúdo", () => {
  it("sha256Hex bate com vetor conhecido", () => {
    // printf 'gigscontrol' | openssl dgst -sha256  (vetor independente)
    expect(sha256Hex("gigscontrol")).toBe(
      "6899397d234f9a0b45c8a8ae6f9c25ef0a0aad0fff812fc3db884b95b230d3ad"
    );
  });

  it("CRLF, CR e trailing spaces não mudam a identidade do contrato", () => {
    const a = hashConteudoContrato("Cláusula 1.\nCláusula 2.");
    const b = hashConteudoContrato("Cláusula 1.\r\nCláusula 2.");
    const c = hashConteudoContrato("Cláusula 1.   \rCláusula 2.\t");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("mudar UMA letra muda o hash (detecção de alteração)", () => {
    expect(hashConteudoContrato("Cachê: R$ 3.000,00")).not.toBe(
      hashConteudoContrato("Cachê: R$ 8.000,00")
    );
  });

  it("canonicalizar preserva o texto visível", () => {
    expect(canonicalizarConteudo("a  b\r\nc")).toBe("a  b\nc");
  });
});

describe("verificação pública", () => {
  it("gera ids no formato GC-XXXX-XXXX sem caracteres ambíguos", () => {
    for (let i = 0; i < 100; i++) {
      const id = gerarVerificacaoId();
      expect(verificacaoIdValido(id)).toBe(true);
      expect(id).not.toMatch(/[01OILU]/);
    }
  });

  it("valida case-insensitive e rejeita lixo", () => {
    expect(verificacaoIdValido("gc-abcd-efgh".replace("b", "3"))).toBe(
      verificacaoIdValido("GC-A3CD-EFGH".toLowerCase())
    );
    expect(verificacaoIdValido("GC-0000-1111")).toBe(false); // ambíguos proibidos
    expect(verificacaoIdValido("qualquer-coisa")).toBe(false);
  });

  it("100 ids seguidos sem colisão (sanidade)", () => {
    const s = new Set(Array.from({ length: 100 }, gerarVerificacaoId));
    expect(s.size).toBe(100);
  });
});

describe("OTP", () => {
  it("código tem 6 dígitos", () => {
    for (let i = 0; i < 200; i++) {
      expect(gerarCodigoOtp()).toMatch(/^\d{6}$/);
    }
  });

  it("hash usa o token como sal: mesmo código, tokens diferentes → hashes diferentes", () => {
    expect(hashOtp("token-a", "123456")).not.toBe(hashOtp("token-b", "123456"));
  });

  it("otpConfere aceita o código certo e rejeita o errado", () => {
    const h = hashOtp("tok", "654321");
    expect(otpConfere("tok", "654321", h)).toBe(true);
    expect(otpConfere("tok", "654322", h)).toBe(false);
    expect(otpConfere("outro", "654321", h)).toBe(false);
  });
});
