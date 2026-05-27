/**
 * Gerador de senha aleatória "amigável" — usada quando o admin cria
 * um artista no GIGS CONTROL.
 *
 * Formato: `Palavra1-Palavra2-NNNN`
 * Exemplo: `Lyra-Bravo-7421` (15 chars, mix de case + número + símbolo)
 *
 * Por que não Math.random() de 12 chars aleatórios?
 *   - Senha aparece UMA vez pro admin copiar e mandar pro artista.
 *   - Dígitos+letras puros tipo "K7gQp2nXw1aZ" são fáceis de errar
 *     ao digitar/ditar. Palavras + número são mais à prova de erro
 *     e ainda passam folgado na política do avaliarSenha (NIST):
 *     ≥12 chars, 3 tipos de char, não está em SENHAS_COMUNS.
 *   - Aleatoriedade: ~25 palavras × 25 palavras × 10000 números =
 *     6.25 milhões de combinações. Não é Fort Knox, mas pra senha
 *     INICIAL (que o artista vai trocar no primeiro login) é mais
 *     que suficiente.
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
];

/** Sorteia um item de um array. */
function sortear<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Inteiro entre min (inclusivo) e max (inclusivo). */
function inteiroEntre(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gera uma senha aleatória legível.
 *
 * Garante passar em `avaliarSenha()`:
 *  - ≥ 12 chars (Lyra-Bravo-7421 tem 15)
 *  - Tem maiúscula (P primeira letra)
 *  - Tem minúscula
 *  - Tem dígito
 *  - Tem símbolo (-)
 *  - Não está em SENHAS_COMUNS
 */
export function gerarSenhaAleatoria(): string {
  const a = sortear(PALAVRAS);
  let b = sortear(PALAVRAS);
  // Evita repetir a mesma palavra duas vezes (estético)
  while (b === a) b = sortear(PALAVRAS);
  const numero = inteiroEntre(1000, 9999);
  return `${a}-${b}-${numero}`;
}
