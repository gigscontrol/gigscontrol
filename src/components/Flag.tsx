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
 * Mostra a bandeira de um país via flagcdn.com (CDN gratuito de bandeiras SVG).
 * Funciona em qualquer sistema operacional, incluindo Windows que historicamente
 * tem problemas para renderizar emojis de bandeira.
 *
 * Se a imagem falhar ao carregar, exibe o código ISO em um pill colorido.
 */
export default function Flag({ code, size = 20, className = "", style }: Props) {
  const [erro, setErro] = useState(false);
  const codigo = code.toLowerCase();
  // height proporcional padrão 3:4 (mas usamos h:auto pra manter razão)
  const heightAprox = Math.round(size * 0.75);

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
