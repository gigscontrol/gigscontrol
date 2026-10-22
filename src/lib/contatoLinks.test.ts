import { describe, expect, it } from "vitest";
import { linkInstagram, linkMapa, linkTelefone, linkWhatsApp } from "./contatoLinks";

describe("contatoLinks", () => {
  it("Instagram aceita @perfil, perfil e link; o resto fica texto", () => {
    expect(linkInstagram("@casa.noturna")).toBe("https://www.instagram.com/casa.noturna/");
    expect(linkInstagram(" casa_noturna ")).toBe("https://www.instagram.com/casa_noturna/");
    expect(linkInstagram("https://instagram.com/casa?igsh=x")).toBe("https://www.instagram.com/casa/");
    expect(linkInstagram("instagram.com/casa")).toBe("https://www.instagram.com/casa/");
    expect(linkInstagram("Casa Noturna")).toBe("");
    expect(linkInstagram("https://casa.com.br")).toBe("");
    expect(linkInstagram("")).toBe("");
  });

  it("telefone vira tel: com +, só com dígitos", () => {
    expect(linkTelefone("+55 (41) 99999-0000")).toBe("tel:+5541999990000");
    expect(linkTelefone("")).toBe("");
  });

  it("WhatsApp usa o número como está (não força 55)", () => {
    expect(linkWhatsApp("5541999990000")).toBe("https://wa.me/5541999990000");
    expect(linkWhatsApp("+1 305 555 0100")).toBe("https://wa.me/13055550100");
    expect(linkWhatsApp("  ")).toBe("");
  });

  it("mapa junta endereço e cidade e codifica", () => {
    expect(linkMapa("Rua XV de Novembro, 100", "Curitiba, PR")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Rua%20XV%20de%20Novembro%2C%20100%2C%20Curitiba%2C%20PR"
    );
    expect(linkMapa("", "Curitiba, PR")).toContain("query=Curitiba%2C%20PR");
    expect(linkMapa("  ")).toBe("");
  });
});
