import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider, type Lang } from "@/lib/i18n";
import { regiaoDe, resolverPais } from "@/lib/regiao";

// Fontes servidas pelo próprio Next (baixadas no build): antes vinham de um
// @import do Google Fonts no CSS — uma requisição encadeada que segurava a
// primeira pintura. As variáveis são usadas no globals.css e no Tailwind.
const fonteTitulo = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--fonte-titulo", display: "swap" });
// Itálico de verdade (as observações usam `italic`; sem ele o navegador inclinava
// o romano). Só baixa se alguma tela usar itálico.
const fonteTexto = Hanken_Grotesk({ subsets: ["latin"], style: ["normal", "italic"], variable: "--fonte-texto", display: "swap" });
const fonteMono = JetBrains_Mono({ subsets: ["latin"], variable: "--fonte-mono", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gigscontrol.com";
// Aba do navegador: só a marca (pedido do Bruno, 21/10/2026 — o "— Sistema
// de gestão…" pesava na aba). O `template` acrescenta " · Gigs Control" às
// páginas internas que definem só o próprio título. Quem procura pela
// categoria continua achando pela descrição e pelo título do compartilhamento.
const TITULO_PADRAO = "Gigs Control";
const TITULO_COMPARTILHAMENTO =
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
    title: TITULO_COMPARTILHAMENTO,
    description: DESCRICAO,
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO_COMPARTILHAMENTO,
    description: DESCRICAO,
  },
};

// Sem esta meta o mobile renderiza num viewport virtual (~980px) e o app abre
// "com zoom". NÃO setar maximumScale/userScalable: bloquear o pinch-zoom é
// problema de acessibilidade — queremos só o enquadramento inicial correto.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
    <html
      lang={initialLang}
      suppressHydrationWarning
      className={`${fonteTitulo.variable} ${fonteTexto.variable} ${fonteMono.variable}`}
    >
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
