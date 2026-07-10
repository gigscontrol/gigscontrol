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
import { resolverPais } from "@/lib/regiao";

export default function Home() {
  const pais =
    resolverPais(
      headers().get("x-vercel-ip-country"),
      cookies().get("gc-pais")?.value
    ) ?? "BR";

  return <LandingRedesign agoraISO={new Date().toISOString()} pais={pais} />;
}
