/**
 * Landing page (/) — tela 13 do guia de redesign.
 *
 * Server component de propósito: o CALENDÁRIO VIVO usa o relógio do
 * SERVIDOR (mês/ano/grade) e o RADAR usa o país por IP (Brasil → São Paulo;
 * fora → Londres). O resto da página (animações, carrossel, i18n) é client,
 * em <LandingRedesign/>.
 */

import { cookies, headers } from "next/headers";
import LandingRedesign from "@/components/landing/LandingRedesign";
import JsonLd from "@/components/seo/JsonLd";
import { resolverPais } from "@/lib/regiao";
import { PLANOS } from "@/lib/planos";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://gigscontrol.com";
// Menor mensalidade REAL em BRL (fonte única: src/lib/planos.ts).
const MENOR_MENSAL_BRL = Math.min(...PLANOS.map((p) => p.precoMensal));

// Dados estruturados (schema.org) do HOME — ajudam o Google a entender a marca
// e o produto. Organization + SoftwareApplication com faixa de preço real.
const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Gigs Control",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
};

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gigs Control",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Sistema de gestão para agências de artistas e DJs: agenda de shows, orçamentos, contratos com assinatura digital, financeiro e CRM de contratantes.",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: MENOR_MENSAL_BRL,
    priceCurrency: "BRL",
    url: `${SITE_URL}/planos`,
  },
};

export default function Home() {
  const pais =
    resolverPais(
      headers().get("x-vercel-ip-country"),
      cookies().get("gc-pais")?.value
    ) ?? "BR";

  return (
    <>
      <JsonLd data={ORGANIZATION_LD} />
      <JsonLd data={SOFTWARE_LD} />
      <LandingRedesign agoraISO={new Date().toISOString()} pais={pais} />
    </>
  );
}
