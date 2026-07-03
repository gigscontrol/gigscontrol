/**
 * Normaliza texto pra busca: sem acento, minúsculo, sem espaços nas pontas.
 *
 * Fonte única de verdade — usada pelo endpoint `/api/cidades-br` e pela base
 * client-side de cidades (`src/lib/data/cidades-br.ts`). Evita reimplementar a
 * mesma normalização (que precisa casar exatamente entre os dois) em vários
 * lugares.
 */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (combining marks)
    .toLowerCase()
    .trim();
}
