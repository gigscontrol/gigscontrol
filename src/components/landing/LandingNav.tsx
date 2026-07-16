"use client";

/**
 * Nav da landing (tela 13 do guia): logo à esquerda, links centrados em
 * texto puro (ativo em branco), e à direita o seletor de idioma (globo+PT),
 * "Entrar" (cinza com borda) e "Começar" (azul) do MESMO tamanho.
 *
 * Reutilizável fora da landing (ex.: /planos): quando NÃO está na home, os
 * links viram âncoras absolutas (`/#seção`) e o logo leva pra `/` — como se
 * a pessoa acabasse de entrar no site. O link ativo acompanha a seção
 * visível (IntersectionObserver) só na própria landing.
 *
 * "Recursos" agora é uma PÁGINA dedicada (`/recursos`), não mais âncora: usa
 * `href` no shape de LINKS e marca-se ativo por `pathname`.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoGC from "@/components/LogoGC";
import { useT } from "@/lib/i18n";
import { SeletorIdioma } from "./SeletorIdioma";
import BotaoTema from "@/components/BotaoTema";

const LINKS: { rotulo: string; alvo?: string; href?: string }[] = [
  // "Início " (com espaço final) é chave homônima: "Início" já significa
  // horário-de-início na Agenda ("Start" em EN). O espaço some no HTML.
  { rotulo: "Início ", alvo: "inicio" },
  { rotulo: "Soluções", alvo: "solucoes" },
  { rotulo: "Planos", alvo: "planos" },
  { rotulo: "Recursos", href: "/recursos" },
];

export default function LandingNav() {
  const t = useT();
  const pathname = usePathname();
  const naLanding = pathname === "/";
  const [ativo, setAtivo] = useState(naLanding ? "inicio" : "");

  // Prefixo das âncoras: na landing rola direto; fora dela navega pra home.
  const base = naLanding ? "" : "/";

  // marca o link da seção visível — só na landing (as seções só existem lá)
  useEffect(() => {
    if (!naLanding) return;
    const secoes = ["inicio", "solucoes", "planos"]
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
  }, [naLanding]);

  return (
    <nav className="sticky top-0 z-30 h-[72px] border-b border-[color:var(--hairline)] bg-[color:var(--nav-blur-bg)] backdrop-blur-xl">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:justify-normal lg:gap-4">
        {/* logo — mark só no mobile (cabe na barra); com wordmark no ≥sm.
            na landing volta pro topo; fora dela vai pra home */}
        {naLanding ? (
          <a
            href="#inicio"
            className="w-fit shrink-0"
            onClick={() => setAtivo("inicio")}
            aria-label="Gigs Control — início"
          >
            <span className="sm:hidden">
              <LogoGC size={28} variant="gradient" />
            </span>
            <span className="hidden sm:block">
              <LogoGC size={30} variant="gradient" withWordmark />
            </span>
          </a>
        ) : (
          <Link href="/" className="w-fit shrink-0" aria-label="Gigs Control — página inicial">
            <span className="sm:hidden">
              <LogoGC size={28} variant="gradient" />
            </span>
            <span className="hidden sm:block">
              <LogoGC size={30} variant="gradient" withWordmark />
            </span>
          </Link>
        )}

        {/* links centrados (desktop) */}
        <div className="hidden items-center gap-[26px] lg:flex">
          {LINKS.map((l) =>
            l.href ? (
              <Link
                key={l.href}
                href={l.href}
                className="gcflink whitespace-nowrap text-[13px] transition-colors"
                style={
                  pathname === l.href
                    ? { color: "var(--text-primary)", fontWeight: 600 }
                    : { color: "var(--text-secondary)", fontWeight: 500 }
                }
              >
                {t(l.rotulo)}
              </Link>
            ) : (
              <a
                key={l.alvo}
                href={`${base}#${l.alvo}`}
                onClick={() => naLanding && setAtivo(l.alvo!)}
                className="gcflink whitespace-nowrap text-[13px] transition-colors"
                style={
                  ativo === l.alvo
                    ? { color: "var(--text-primary)", fontWeight: 600 }
                    : { color: "var(--text-secondary)", fontWeight: 500 }
                }
              >
                {t(l.rotulo)}
              </a>
            )
          )}
        </div>

        {/* ações à direita — compactas no mobile (idioma some, botões menores) */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <BotaoTema variante="landing" />
          <span className="hidden sm:flex">
            <SeletorIdioma />
          </span>
          <Link
            href="/login"
            className="whitespace-nowrap rounded-control border border-[color:var(--border-strong)] bg-surface px-3 py-2 text-[12px] font-semibold text-primary sm:px-[18px] sm:py-[9px] sm:text-[13px]"
          >
            {t("Entrar")}
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-control border border-[var(--brand)] px-3 py-2 text-[12px] font-bold text-white sm:px-[18px] sm:py-[9px] sm:text-[13px]"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {t("Começar")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
