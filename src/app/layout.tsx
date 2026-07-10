import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LanguageProvider, type Lang } from "@/lib/i18n";
import { regiaoDe, resolverPais } from "@/lib/regiao";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gigscontrol.com";
// Título da aba do navegador — só a marca, limpo. (A descrição rica abaixo
// segue cobrindo SEO/social.)
const TITULO = "Gigs Control";
const DESCRICAO =
  "CRM e gestão completa para DJs, cantores, MCs e agências musicais. Agenda, orçamentos, vendas e financeiro em um só lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO,
  description: DESCRICAO,
  applicationName: "GIGS CONTROL",
  keywords: [
    "CRM para DJ",
    "gestão de agência de música",
    "agenda de shows",
    "orçamento de show",
    "contrato de show",
    "cachê",
    "booking",
    "DJ management",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "GIGS CONTROL",
    title: TITULO,
    description: DESCRICAO,
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
  },
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
