"use client";

/**
 * Moldura compartilhada das páginas de autenticação (login, signup, etc.).
 *
 * Em telas grandes, split em 2 colunas: um painel de marca (gradiente +
 * apresentação) à esquerda e o formulário à direita. No mobile, só o
 * formulário, com a logo no topo. Reusa a linguagem visual da landing.
 */

import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LogoGC from "@/components/LogoGC";

const PONTOS = [
  "Agenda de shows de todos os artistas",
  "Orçamento e proposta direto no WhatsApp",
  "Contrato com assinatura e verificação",
  "Financeiro: parcelas e quem está atrasado",
];

export default function AuthShell({
  titulo,
  subtitulo,
  children,
  painelEsquerdo,
  comNavExterna = false,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  /**
   * Conteúdo customizado do painel de marca (desktop). Quando presente,
   * substitui o painel padrão (gradiente + bullets) — usado pelo login
   * (tela 07: mini-dashboard vivo). Signup e demais telas seguem no padrão.
   */
  painelEsquerdo?: React.ReactNode;
  /**
   * Quando a página já tem a nav de topo (LandingNav, ex.: /login): encolhe
   * a altura pra caber abaixo dela (sem scroll) e esconde a topbar interna
   * (idioma + "voltar"), que a nav externa já provê.
   */
  comNavExterna?: boolean;
}) {
  const t = useT();
  // Altura: página inteira, ou "menos a nav de topo" (72px) quando embutida.
  const altura = comNavExterna ? "lg:min-h-[calc(100dvh-72px)]" : "min-h-screen";
  if (painelEsquerdo) {
    return (
      <div className={`${altura} bg-main text-primary lg:grid lg:grid-cols-[1.15fr_1fr]`}>
        <aside className="relative hidden lg:flex flex-col overflow-hidden border-r border-border">
          {painelEsquerdo}
        </aside>
        <LadoFormulario
          titulo={titulo}
          subtitulo={subtitulo}
          semTopbar={comNavExterna}
        >
          {children}
        </LadoFormulario>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-main text-primary lg:grid lg:grid-cols-2">
      {/* ===== Painel de marca (desktop) ===== */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-border p-10 xl:p-14">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px circle at 25% 15%, var(--glow-hero), var(--glow-fade) 60%), radial-gradient(520px circle at 80% 70%, var(--glow-accent), var(--glow-fade) 60%)",
          }}
        />
        <Link href="/" className="relative w-fit">
          <LogoGC size={30} variant="gradient" withWordmark />
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl xl:text-4xl font-extrabold leading-[1.1]">
            {t("A operação da sua")}{" "}
            <span className="bg-grad-signal bg-clip-text text-transparent">
              {t("agência musical")}
            </span>{" "}
            {t("em um só lugar")}
          </h2>
          <ul className="mt-8 flex flex-col gap-3.5">
            {PONTOS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--brand-weak)", color: "var(--brand)" }}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="text-sm text-secondary">{t(p)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted">
          © {new Date().getFullYear()} GIGS CONTROL — {t("Gestão para a música.")}
        </p>
      </aside>

      <LadoFormulario titulo={titulo} subtitulo={subtitulo}>
        {children}
      </LadoFormulario>
    </div>
  );
}

/** Lado do formulário — comum ao painel padrão e ao customizado. */
function LadoFormulario({
  titulo,
  subtitulo,
  children,
  semTopbar = false,
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  /** Esconde a topbar interna quando a página já tem nav de topo própria. */
  semTopbar?: boolean;
}) {
  const t = useT();
  return (
    <main className="relative flex flex-col">
      <div
        aria-hidden
        className="absolute inset-0 opacity-50 pointer-events-none lg:hidden"
        style={{
          background:
            "radial-gradient(500px circle at 50% 0%, var(--glow-hero), var(--glow-fade) 60%)",
        }}
      />

      {/* Topo: logo (mobile) + seletor de idioma + voltar ao site.
          Escondido quando a nav externa já cobre isso (login com LandingNav). */}
      {!semTopbar && (
        <div className="relative flex items-center justify-between px-6 h-16">
          <Link href="/" className="lg:hidden">
            <LogoGC size={26} variant="gradient" withWordmark />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
            >
              <ArrowLeft size={13} />
              {t("Voltar ao site")}
            </Link>
          </div>
        </div>
      )}

      {/* Conteúdo (form) */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            {/* h2: o h1 (SEO, keyword-rich) é injetado pela página que usa o
                AuthShell — hoje /login e /signup, ambas com <h1 sr-only>. Manter
                como h2 garante exatamente um h1 por página. */}
            <h2 className="text-2xl font-bold tracking-tight">{titulo}</h2>
            {subtitulo && (
              <p className="mt-1.5 text-sm text-secondary">{subtitulo}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
