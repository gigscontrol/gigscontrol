"use client";

/**
 * Nav da landing (tela 13 do guia): logo à esquerda, links centrados em
 * texto puro (ativo em branco), e à direita o seletor de idioma (globo+PT),
 * "Entrar" (cinza com borda) e "Começar" (azul) do MESMO tamanho.
 *
 * O link ativo acompanha a seção visível (IntersectionObserver).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoGC from "@/components/LogoGC";
import { useT } from "@/lib/i18n";
import { SeletorIdioma } from "./SeletorIdioma";

const LINKS = [
  // "Início " (com espaço final) é chave homônima: "Início" já significa
  // horário-de-início na Agenda ("Start" em EN). O espaço some no HTML.
  { rotulo: "Início ", alvo: "inicio" },
  { rotulo: "Soluções", alvo: "solucoes" },
  { rotulo: "Planos", alvo: "planos" },
  { rotulo: "Recursos", alvo: "recursos" },
  { rotulo: "Demo", alvo: "demo" },
];

export default function LandingNav() {
  const t = useT();
  const [ativo, setAtivo] = useState("inicio");

  // marca o link da seção visível (Demo é âncora dentro do hero)
  useEffect(() => {
    const secoes = ["inicio", "recursos", "solucoes", "planos"]
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!secoes.length) return;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setAtivo(e.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    secoes.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <nav className="sticky top-0 z-30 border-b border-[rgba(255,255,255,.05)] bg-[rgba(11,13,18,.85)] backdrop-blur-xl">
      <div className="grid items-center gap-4 px-6 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        {/* logo */}
        <Link href="/" className="w-fit">
          <LogoGC size={21} variant="gradient" withWordmark />
        </Link>

        {/* links centrados (desktop) */}
        <div className="hidden items-center gap-[26px] lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.alvo}
              href={`#${l.alvo}`}
              onClick={() => setAtivo(l.alvo)}
              className="gcflink whitespace-nowrap text-[13px] transition-colors"
              style={
                ativo === l.alvo
                  ? { color: "#F1F3F7", fontWeight: 600 }
                  : { color: "#9AA2B4", fontWeight: 500 }
              }
            >
              {t(l.rotulo)}
            </a>
          ))}
        </div>

        {/* ações à direita */}
        <div className="flex items-center justify-end gap-2">
          <SeletorIdioma />
          <Link
            href="/login"
            className="whitespace-nowrap rounded-[9px] border border-[rgba(255,255,255,.12)] bg-surface px-[18px] py-[9px] text-[13px] font-semibold text-primary"
          >
            {t("Entrar")}
          </Link>
          <Link
            href="/planos"
            className="whitespace-nowrap rounded-[9px] border border-[var(--brand)] px-[18px] py-[9px] text-[13px] font-bold text-white"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {t("Começar")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
