import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LanguageProvider, type Lang } from "@/lib/i18n";
import { regiaoDe, resolverPais } from "@/lib/regiao";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gigscontrol.com";
// Título "de vitrine": marca + categoria-mestre. O `template` acrescenta
// " · Gigs Control" às páginas internas que definem só o próprio título.
const TITULO_PADRAO =
  "Gigs Control — Sistema de gestão para agências de artistas e DJs";
const DESCRICAO =
  "Agenda de shows, orçamentos, contratos com assinatura digital, financeiro e CRM de contratantes num só painel. Para artistas, agências e produtoras.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITULO_PADRAO,
    template: "%s · Gigs Control",
  },
  description: DESCRICAO,
  applicationName: "Gigs Control",
  keywords: [
    "Gigs Control",
    "sistema de gestão para agência de artistas",
    "CRM para agência de shows",
    "software de agenciamento de artistas",
    "sistema para produtora de shows",
    "agenda de shows",
    "gerador de contrato de show",
    "contrato com assinatura digital",
    "orçamento de show",
    "controle de cachês",
    "gestão de contratantes",
    "booking agency software",
    "artist management software",
  ],
  alternates: { canonical: "/" },
  // og:image e twitter:image saem automaticamente das convenções de arquivo
  // opengraph-image.tsx / twitter-image.tsx — não repetir aqui.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Gigs Control",
    title: TITULO_PADRAO,
    description: DESCRICAO,
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO_PADRAO,
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
    <html lang={initialLang} suppressHydrationWarning>
      <body>
        {/* No-flash do tema: roda ANTES do primeiro paint (primeiro filho do
            body, inline síncrono). Padrão é escuro (atributo ausente); só quem
            escolheu claro ganha data-theme="light" antes de qualquer pintura. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{if(localStorage.getItem("gc-theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}})()',
          }}
        />
        <LanguageProvider initialLang={initialLang} initialMoeda={moeda}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
