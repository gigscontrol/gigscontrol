/**
 * Apresentação de QUANTIDADES fora dos contratos: número com 2 dígitos, sem
 * o por-extenso ("03 Passagens aéreas…"). O formato "03 (três)" fica SÓ nos
 * contratos (ver formatarQuantidade em contratos/extenso.ts) — pedido do
 * dono: nos textos de orçamento/venda o extenso fica formal demais.
 */
export function numeroQtd(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Plural dos itens de HOTEL quando qtd > 1: "Quarto Duplo" → "Quartos
 * Duplos". Cobre o catálogo (Quarto Single/Duplo/Triplo) e variações comuns
 * digitadas (Diária, Suíte). Nome fora do padrão fica como está.
 */
export function pluralizarItemHotel(nome: string, qtd: number): string {
  if (qtd <= 1) return nome;
  return nome
    .replace(/^Quarto\b/, "Quartos")
    .replace(/^Diária\b/, "Diárias")
    .replace(/^Suíte\b/, "Suítes")
    .replace(/\bDuplo\b/, "Duplos")
    .replace(/\bTriplo\b/, "Triplos");
}
