import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LanguageProvider, type Lang } from "@/lib/i18n";
import { regiaoDe, resolverPais } from "@/lib/regiao";

export const metadata: Metadata = {
  title: "GIGS CONTROL — Gestão para a música",
  description:
    "CRM e gestão completa para DJs, cantores, MCs e agências musicais. Agenda, orçamentos, vendas e financeiro em um só lugar.",
};

const LANGS: Lang[] = ["pt", "en", "es", "fr", "de", "it"];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // País por IP (header da Vercel) ou cookie gc-pais (teste). Define o
  // idioma/moeda iniciais já no servidor — sem flash de PT→EN.
  const c = cookies();
  const pais = resolverPais(
    headers().get("x-vercel-ip-country"),
    c.get("gc-pais")?.value
  );
  const { langPadrao, moeda } = regiaoDe(pais);
  const escolhido = c.get("gc-lang")?.value;
  const initialLang: Lang =
    escolhido && LANGS.includes(escolhido as Lang)
      ? (escolhido as Lang)
      : langPadrao;

  return (
    <html lang={initialLang}>
      <body>
        <LanguageProvider initialLang={initialLang} initialMoeda={moeda}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
