/**
 * Converte um valor monetário digitado em pt-BR para número.
 *
 * Regras (nesta ordem):
 * - Remove espaços (inclusive NBSP) e o símbolo "R$".
 * - Tem "." E "," → "." é separador de milhar e "," é decimal.
 *     "2.500,00" → 2500 | "1.234.567,89" → 1234567.89
 * - Só "," → vírgula é o decimal.
 *     "2,50" → 2.5 | "1500,90" → 1500.9
 * - Só "." → se os pontos formam grupos de milhar plausíveis (o 1º grupo tem
 *   1–3 dígitos e os demais têm exatamente 3), tratamos como milhar; senão o
 *   "." é decimal.
 *     "2.500" → 2500 | "1.234.567" → 1234567 | "2.5" → 2.5 | "1000.00" → 1000
 * - Nenhum separador → Number direto.
 *     "15000" → 15000
 * - Entrada vazia ou não numérica → NaN.
 *     "" → NaN | "abc" → NaN
 */
export function parseValorBR(s: string): number {
  if (typeof s !== "string") return NaN;

  // Tira espaços (comuns e não-quebráveis) e o símbolo de moeda.
  let v = s.replace(/\s/g, "").replace(/R\$/gi, "");
  if (!v) return NaN;

  const temPonto = v.includes(".");
  const temVirgula = v.includes(",");

  if (temPonto && temVirgula) {
    // "." = milhar, "," = decimal.
    v = v.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    // Só vírgula = decimal (troca só a primeira; extras viram NaN em Number).
    v = v.replace(",", ".");
  } else if (temPonto) {
    // Só ponto: pode ser milhar ("2.500") ou decimal ("2.5").
    const partes = v.split(".");
    const milharPlausivel =
      partes.length > 1 &&
      partes[0].length >= 1 &&
      partes[0].length <= 3 &&
      partes.slice(1).every((p) => p.length === 3);
    if (milharPlausivel) v = partes.join("");
    // senão mantém como está (decimal).
  }
  // Nenhum separador → Number direto.

  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
