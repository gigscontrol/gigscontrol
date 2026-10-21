import { describe, expect, it } from "vitest";
import { linkMapa, linkTelefone, linkWhatsApp } from "./contatoLinks";

describe("contatoLinks", () => {
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
