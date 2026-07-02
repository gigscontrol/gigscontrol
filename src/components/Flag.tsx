"use client";

import { useState } from "react";

type Props = {
  /** ISO 3166-1 alpha-2 ex "BR" */
  code: string;
  /** Tamanho em pixels (default 20) */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Bandeiras SVG simples (retângulos/listras) desenhadas inline para os 6
 * idiomas suportados (BR, US, ES, FR, DE, IT) — não dependem de emoji (que
 * o Windows renderiza mal) nem de CDN externo. Cada uma usa um viewBox 3:2.
 *
 * Para os demais ~200 países (seletores de país/DDI) caímos no flagcdn.com,
 * que já funciona bem e não precisamos redesenhar um a um.
 */
const SVG_FLAGS: Record<string, React.ReactNode> = {
  // Brasil — campo verde, losango amarelo, círculo azul
  br: (
    <>
      <rect width="30" height="20" fill="#009c3b" />
      <polygon points="15,2 27.5,10 15,18 2.5,10" fill="#ffdf00" />
      <circle cx="15" cy="10" r="4.2" fill="#002776" />
    </>
  ),
  // Estados Unidos — 13 listras (7 vermelhas) + cantão azul (simplificado)
  us: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="12" height={20 * (7 / 13)} fill="#3c3b6e" />
    </>
  ),
  // Espanha — listras horizontais vermelho/amarelo/vermelho (1:2:1)
  es: (
    <>
      <rect width="30" height="20" fill="#c60b1e" />
      <rect y="5" width="30" height="10" fill="#ffc400" />
    </>
  ),
  // França — 3 listras verticais azul/branco/vermelho
  fr: (
    <>
      <rect width="10" height="20" fill="#0055a4" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ef4135" />
    </>
  ),
  // Alemanha — 3 listras horizontais preto/vermelho/dourado
  de: (
    <>
      <rect width="30" height="20" fill="#000" />
      <rect y="6.66" width="30" height="6.66" fill="#dd0000" />
      <rect y="13.33" width="30" height="6.67" fill="#ffce00" />
    </>
  ),
  // Itália — 3 listras verticais verde/branco/vermelho
  it: (
    <>
      <rect width="10" height="20" fill="#009246" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#ce2b37" />
    </>
  ),
};

/**
 * Mostra a bandeira de um país. Para os 6 idiomas do app (BR/US/ES/FR/DE/IT)
 * usa SVG desenhado inline; para os demais países cai no flagcdn.com.
 *
 * Se a imagem do CDN falhar, exibe o código ISO em um pill neutro.
 */
export default function Flag({ code, size = 20, className = "", style }: Props) {
  const [erro, setErro] = useState(false);
  const codigo = code.toLowerCase();
  // height proporcional padrão 3:2 (mantém razão do viewBox)
  const heightAprox = Math.round(size * (2 / 3));

  const svg = SVG_FLAGS[codigo];
  if (svg) {
    return (
      <svg
        viewBox="0 0 30 20"
        width={size}
        height={heightAprox}
        role="img"
        aria-label={code}
        className={`inline-block rounded-[2px] ${className}`}
        style={{ width: size, height: heightAprox, flexShrink: 0, ...style }}
      >
        {svg}
      </svg>
    );
  }

  if (erro) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-elevated border border-border text-[9px] font-bold uppercase tracking-wide tabular-nums ${className}`}
        style={{
          width: size,
          height: heightAprox,
          color: "var(--text-secondary)",
          ...style,
        }}
      >
        {code}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${codigo}.png`}
      srcSet={`https://flagcdn.com/w80/${codigo}.png 2x`}
      alt={code}
      width={size}
      height={heightAprox}
      loading="lazy"
      onError={() => setErro(true)}
      className={`inline-block rounded-[2px] object-cover ${className}`}
      style={{
        width: size,
        height: heightAprox,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
