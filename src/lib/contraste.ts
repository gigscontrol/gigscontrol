/**
 * Contraste de cores de identidade (artista, equipe, papel).
 *
 * As iniciais dos avatares ficam SEMPRE brancas (decisão do Bruno, 22/10:
 * iniciais escuras em cor clara foram testadas e recusadas). O que mora aqui
 * é a cor de identidade usada como TEXTO (corComoTexto) e a conta de razão
 * de contraste (WCAG 2.x) que os testes usam.
 *
 * Módulo puro — coberto por contraste.test.ts.
 */

const ESCURO = "#111726";

function luminancia(hex: string): number | null {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const canal = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

/** Razão de contraste WCAG entre duas cores hex (null se alguma não for hex). */
export function razaoContraste(a: string, b: string): number | null {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}


/**
 * Cor de identidade (artista, papel) usada como TEXTO sobre o chip tingido
 * com a própria cor. Pura, ela some no fundo: amarelo e ciano no tema claro,
 * azul-marinho no escuro (1,4–1,6:1). Misturada meio a meio com a cor do
 * texto principal do tema, passa de 4,5:1 com qualquer cor da paleta, nos
 * dois temas — e continua com o tom do artista.
 *
 * `fundoFixo`: superfície que não muda com o tema (ex.: a folha do PDF, sempre
 * branca) — mistura com esse tom em vez do texto do tema.
 */
export function corComoTexto(cor: string, fundoFixo?: "claro"): string {
  const base = fundoFixo === "claro" ? ESCURO : "var(--text-primary)";
  return `color-mix(in srgb, ${cor} 50%, ${base})`;
}
