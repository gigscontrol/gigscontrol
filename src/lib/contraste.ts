/**
 * Cor do texto EM CIMA de uma cor de identidade (artista, equipe, papel).
 *
 * As iniciais dos avatares eram sempre brancas — em cor clara (verde, ciano,
 * laranja, amarelo) davam de 1,9 a 3,9:1. Aqui escolhe branco ou quase-preto,
 * o que tiver MAIS contraste com a cor de fundo (WCAG 2.x).
 *
 * Só entende hexadecimal (#RGB / #RRGGBB); qualquer outra coisa (var(...),
 * nome de cor) cai no branco — o comportamento antigo.
 *
 * Módulo puro — coberto por contraste.test.ts.
 */

const BRANCO = "#FFFFFF";
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

export function corTextoSobre(fundo: string | null | undefined): string {
  if (!fundo) return BRANCO;
  const comBranco = razaoContraste(BRANCO, fundo);
  const comEscuro = razaoContraste(ESCURO, fundo);
  if (comBranco === null || comEscuro === null) return BRANCO;
  return comBranco >= comEscuro ? BRANCO : ESCURO;
}
