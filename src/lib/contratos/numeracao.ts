import type { SecaoModelo } from "@/lib/mappers/contratoModelo";

/**
 * Numeração automática das cláusulas e sub-cláusulas de um modelo.
 *
 * - Seções do tipo "clausula" são numeradas 1, 2, 3… pela ordem em que
 *   aparecem (as outras seções — título, partes, assinaturas, anexo — não
 *   entram na contagem).
 * - Dentro de cada cláusula, os itens do tipo "subclausula" recebem N.1,
 *   N.2, N.3… (os itens "paragrafo" não recebem número).
 *
 * O usuário nunca digita número — reordenar renumera tudo automaticamente.
 */
export type Numeracao = {
  /** secaoId (cláusula) -> número (1, 2, 3…) */
  clausulas: Record<string, number>;
  /** itemId (sub-cláusula) -> rótulo "N.M" */
  itens: Record<string, string>;
};

export function calcularNumeracao(secoes: SecaoModelo[]): Numeracao {
  const clausulas: Record<string, number> = {};
  const itens: Record<string, string> = {};
  let n = 0;
  for (const s of secoes) {
    if (s.tipo !== "clausula") continue;
    n++;
    clausulas[s.id] = n;
    let m = 0;
    for (const it of s.itens) {
      if (it.tipo === "subclausula") {
        m++;
        itens[it.id] = `${n}.${m}`;
      }
    }
  }
  return { clausulas, itens };
}
