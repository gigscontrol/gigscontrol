"use client";

/**
 * Rodapé da landing (tela 13 do guia): marca + tagline + sociais à esquerda,
 * colunas Produto/Empresa/Legal, e a barra final com © + seletor de idioma
 * (nome por extenso).
 */

import Link from "next/link";
import LogoGC from "@/components/LogoGC";
import { useT } from "@/lib/i18n";
import { SeletorIdioma } from "./SeletorIdioma";

function IconeSocial({ children, rotulo }: { children: React.ReactNode; rotulo: string }) {
  return (
    <a
      href="https://instagram.com/gigscontrol"
      target="_blank"
      rel="noreferrer"
      aria-label={rotulo}
      className="gcflink flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[rgba(255,255,255,.1)] bg-surface"
    >
      {children}
    </a>
  );
}

export default function FooterLanding() {
  const t = useT();

  const colunas: {
    titulo: string;
    links: { rotulo: string; href: string }[];
  }[] = [
    {
      titulo: "PRODUTO",
      links: [
        { rotulo: "Recursos", href: "#recursos" },
        { rotulo: "Planos", href: "#planos" },
        { rotulo: "Entrar", href: "/login" },
        { rotulo: "Começar", href: "/planos" },
      ],
    },
    {
      titulo: "EMPRESA",
      links: [
        { rotulo: "Sobre", href: "#inicio" },
        { rotulo: "Suporte", href: "mailto:contato@gigscontrol.com.br" },
        { rotulo: "Contato", href: "mailto:contato@gigscontrol.com.br" },
      ],
    },
    {
      titulo: "LEGAL",
      links: [
        { rotulo: "Termos de uso", href: "/termos" },
        { rotulo: "Privacidade", href: "/privacidade" },
        { rotulo: "Cookies", href: "/privacidade" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[rgba(255,255,255,.08)] bg-[#080A0F] px-6 pt-[52px] sm:px-12">
      <div className="mx-auto max-w-[1044px]">
        <div className="gcrv grid grid-cols-1 gap-8 pb-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* marca */}
          <div className="flex flex-col gap-3.5">
            <Link href="/" className="w-fit">
              <LogoGC size={20} variant="gradient" withWordmark />
            </Link>
            <div className="max-w-[280px] text-[13px] leading-[1.6] text-[#8B93A5]">
              {t(
                "Gestão completa para agências e artistas da música — do primeiro contato ao cachê na conta."
              )}
            </div>
            <div className="flex gap-2">
              <IconeSocial rotulo="Instagram">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9AA2B4"
                  strokeWidth="1.8"
                  style={{ width: 16, height: 16 }}
                  aria-hidden
                >
                  <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
                  <circle cx="12" cy="12" r="3.8" />
                  <circle cx="17.2" cy="6.8" r="1.2" fill="#9AA2B4" stroke="none" />
                </svg>
              </IconeSocial>
              <IconeSocial rotulo="YouTube">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9AA2B4"
                  strokeWidth="1.8"
                  style={{ width: 16, height: 16 }}
                  aria-hidden
                >
                  <rect x="2.5" y="6" width="19" height="12.5" rx="3" />
                  <path d="M10.2 9.4l5 2.85-5 2.85z" fill="#9AA2B4" stroke="none" />
                </svg>
              </IconeSocial>
              <IconeSocial rotulo="X">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9AA2B4"
                  strokeWidth="1.8"
                  style={{ width: 16, height: 16 }}
                  aria-hidden
                >
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </IconeSocial>
            </div>
          </div>

          {/* colunas de links */}
          {colunas.map((col) => (
            <div key={col.titulo} className="flex flex-col gap-[11px]">
              <div className="mb-1 font-mono text-[9.5px] font-semibold tracking-[.2em] text-[#5E6674]">
                {t(col.titulo)}
              </div>
              {col.links.map((l) =>
                l.href.startsWith("/") ? (
                  <Link
                    key={l.rotulo}
                    href={l.href}
                    className="gcflink text-[13px] text-secondary"
                  >
                    {t(l.rotulo)}
                  </Link>
                ) : (
                  <a
                    key={l.rotulo}
                    href={l.href}
                    className="gcflink text-[13px] text-secondary"
                  >
                    {t(l.rotulo)}
                  </a>
                )
              )}
            </div>
          ))}
        </div>

        {/* barra final */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[rgba(255,255,255,.06)] pb-[22px] pt-[18px]">
          <span className="font-mono text-[11px] text-[#5E6674]">
            © {new Date().getFullYear()} GIGS CONTROL — {t("Gestão para a música.")}
          </span>
          <SeletorIdioma nomeCompleto />
        </div>
      </div>
    </footer>
  );
}
