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

const VENDAS = "#a855f7";

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
}: {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="min-h-screen bg-main text-primary lg:grid lg:grid-cols-2">
      {/* ===== Painel de marca (desktop) ===== */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-border p-10 xl:p-14">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px circle at 25% 15%, rgba(168,85,247,0.20), transparent 60%), radial-gradient(520px circle at 80% 70%, rgba(20,184,166,0.14), transparent 60%)",
          }}
        />
        <Link href="/" className="relative inline-flex items-center gap-2 w-fit">
          <span
            className="rounded-md flex items-center justify-center font-bold text-white h-8 w-8 text-base"
            style={{ backgroundColor: VENDAS }}
          >
            G
          </span>
          <span className="font-display font-bold tracking-tight text-base">
            GIGS<span className="text-muted"> CONTROL</span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl xl:text-4xl font-extrabold leading-[1.1]">
            {t("A operação da sua")}{" "}
            <span className="bg-gradient-to-r from-[var(--module-vendas)] to-[var(--module-contratos)] bg-clip-text text-transparent">
              {t("agência musical")}
            </span>{" "}
            {t("em um só lugar")}
          </h2>
          <ul className="mt-8 flex flex-col gap-3.5">
            {PONTOS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${VENDAS}22`, color: VENDAS }}
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

      {/* ===== Lado do formulário ===== */}
      <main className="relative flex flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-50 pointer-events-none lg:hidden"
          style={{
            background:
              "radial-gradient(500px circle at 50% 0%, rgba(168,85,247,0.15), transparent 60%)",
          }}
        />

        {/* Topo: logo (mobile) + seletor de idioma + voltar ao site */}
        <div className="relative flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: VENDAS }}
            >
              G
            </span>
            <span className="font-display font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
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

        {/* Conteúdo (form) */}
        <div className="relative flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
              {subtitulo && (
                <p className="mt-1.5 text-sm text-secondary">{subtitulo}</p>
              )}
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
