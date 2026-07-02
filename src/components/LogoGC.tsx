"use client";

import { useId } from "react";

type Variant = "gradient" | "white" | "solid" | "ink";

type Props = {
  /** Altura do símbolo em px (largura é proporcional). */
  size?: number;
  variant?: Variant;
  /** Mostra o wordmark "gigs control" (Bricolage 700, minúsculo) ao lado. */
  withWordmark?: boolean;
  className?: string;
};

/**
 * Monograma GC (Gigs Control) — símbolo entrelaçado, inclinado, com degradê
 * Signal. Recolorir via `variant`. Nunca distorcer proporção nem separar o G
 * do C (regras do design system).
 */
export default function LogoGC({
  size = 28,
  variant = "gradient",
  withWordmark = false,
  className = "",
}: Props) {
  const gid = useId();
  const stroke =
    variant === "white"
      ? "#fff"
      : variant === "solid"
      ? "#3D7BFF"
      : variant === "ink"
      ? "#0B0D12"
      : `url(#${gid})`;
  const width = (168 / 104) * size;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        height={size}
        width={width}
        viewBox="0 0 168 104"
        fill="none"
        role="img"
        aria-label="Gigs Control"
      >
        {variant === "gradient" && (
          <defs>
            <linearGradient
              id={gid}
              gradientUnits="userSpaceOnUse"
              x1="24"
              y1="14"
              x2="128"
              y2="94"
            >
              <stop offset="0" stopColor="#4AC4FF" />
              <stop offset="0.5" stopColor="#3D7BFF" />
              <stop offset="1" stopColor="#2847D7" />
            </linearGradient>
          </defs>
        )}
        <g
          transform="translate(14,0) skewX(-8)"
          stroke={stroke}
          strokeWidth="16"
          strokeLinecap="round"
        >
          <path d="M72.5 31.4 A32 32 0 1 0 72.5 72.6" />
          <path d="M80 52 H58" />
          <path d="M119.6 36.4 A22 22 0 1 0 119.6 67.6" />
        </g>
      </svg>
      {withWordmark && (
        <span
          className="font-display font-bold lowercase leading-none"
          style={{ fontSize: size * 0.6, letterSpacing: "-0.02em" }}
        >
          gigs control
        </span>
      )}
    </span>
  );
}
