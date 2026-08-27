import { randomInt } from "node:crypto";

/**
 * Gerador de senha aleatória "amigável" — usada quando o admin cria
 * um artista no GIGS CONTROL.
 *
 * Formato: `Palavra1-Palavra2-Palavra3-NNNN`
 * Exemplo: `Lyra-Bravo-Onix-7421` (≥18 chars, mix de case + número + símbolo)
 *
 * Por que palavras e não 12 chars aleatórios?
 *   - Senha aparece UMA vez pro admin copiar e mandar pro artista.
 *   - Dígitos+letras puros tipo "K7gQp2nXw1aZ" são fáceis de errar
 *     ao digitar/ditar. Palavras + número são mais à prova de erro
 *     e ainda passam folgado na política do avaliarSenha (NIST).
 *
 * Endurecido na auditoria de 27/08/2026:
 *   - `crypto.randomInt` (CSPRNG) no lugar de Math.random(), que é
 *     previsível e não serve pra material de credencial.
 *   - 3 palavras de uma lista de 48 + número: 48×47×46×9000 ≈ 934
 *     MILHÕES de combinações (~30 bits) — vs ~5,4M (~22 bits) do
 *     formato antigo de 2 palavras. Pra senha INICIAL (trocada no
 *     primeiro login) com rate limit no login, é folga confortável.
 */

const PALAVRAS = [
  "Lyra",
  "Vega",
  "Orion",
  "Atlas",
  "Nova",
  "Echo",
  "Tango",
  "Bravo",
  "Delta",
  "Sierra",
  "Lima",
  "Kilo",
  "Onix",
  "Jade",
  "Ruby",
  "Iris",
  "Sol",
  "Lua",
  "Mar",
  "Rio",
  "Fox",
  "Wolf",
  "Hawk",
  "Lynx",
  "Sage",
  "Norte",
  "Sul",
  "Leste",
  "Oeste",
  "Cedro",
  "Pinho",
  "Coral",
  "Perola",
  "Ambar",
  "Cobre",
  "Ferro",
  "Prata",
  "Ouro",
  "Trigo",
  "Cacau",
  "Manga",
  "Kiwi",
  "Figo",
  "Uva",
  "Brisa",
  "Rocha",
  "Vento",
  "Chuva",
] as const;

/** Sorteia um item de um array com CSPRNG. */
function sortear<T>(arr: readonly T[]): T {
  return arr[randomInt(arr.length)];
}

/**
 * Gera uma senha aleatória legível.
 *
 * Garante passar em `avaliarSenha()`:
 *  - ≥ 12 chars (Sol-Lua-Mar-1000 tem 16; o comum passa de 18)
 *  - Tem maiúscula (primeira letra de cada palavra)
 *  - Tem minúscula
 *  - Tem dígito
 *  - Tem símbolo (-)
 *  - Não está em SENHAS_COMUNS
 */
export function gerarSenhaAleatoria(): string {
  const a = sortear(PALAVRAS);
  let b = sortear(PALAVRAS);
  while (b === a) b = sortear(PALAVRAS);
  let c = sortear(PALAVRAS);
  while (c === a || c === b) c = sortear(PALAVRAS);
  const numero = randomInt(1000, 10000); // [1000, 9999]
  return `${a}-${b}-${c}-${numero}`;
}
