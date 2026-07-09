"use client";

/**
 * Peças compartilhadas das seções 01/02/03 da landing (tela 13 do guia):
 * badge "ao vivo", título com trecho em degradê Signal, par de CTAs e a
 * linha de checks. Mantém as três seções pixel-consistentes.
 */

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Badge da seção: pontinho verde pulsando + rótulo ("01 · Tudo num só painel"). */
export function BadgeSecao({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 self-start rounded-lg border border-[rgba(255,255,255,.1)] bg-surface px-3.5 py-[7px] text-xs text-secondary">
      <span
        className="gcanim h-[7px] w-[7px] rounded-full bg-[#3CE08C]"
        style={{ animation: "gcPulse 2.2s ease-in-out infinite" }}
      />
      {children}
    </div>
  );
}

/** Trecho do título em degradê Signal. */
export function Grad({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-grad-signal bg-clip-text text-transparent">
      {children}
    </span>
  );
}

/** Par de CTAs padrão das seções: "Ver planos" (azul) + "Já tenho conta". */
export function CtasSecao() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/planos"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-[10px] px-6 py-[13px] text-sm font-bold text-white"
        style={{ backgroundColor: "var(--brand)" }}
      >
        {t("Ver planos")}
        <ArrowRight size={15} strokeWidth={2.2} />
      </Link>
      <Link
        href="/login"
        className="whitespace-nowrap rounded-[10px] border border-[rgba(255,255,255,.12)] bg-surface px-6 py-[13px] text-sm font-semibold text-primary"
      >
        {t("Já tenho conta")}
      </Link>
    </div>
  );
}

/** Linha de três checks azuis embaixo dos CTAs. */
export function ChecksSecao({ itens }: { itens: string[] }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-xs text-secondary">
      {itens.map((item) => (
        <span key={item} className="flex items-center gap-1.5">
          <Check size={13} strokeWidth={2.2} style={{ color: "#5B93FF" }} />
          {t(item)}
        </span>
      ))}
    </div>
  );
}
