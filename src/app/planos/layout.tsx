import type { Metadata } from "next";
import { PLANOS } from "@/lib/planos";

// Menor mensalidade REAL em BRL (fonte única: src/lib/planos.ts) — não hardcode.
const MENOR_MENSAL_BRL = Math.min(...PLANOS.map((p) => p.precoMensal));

export const metadata: Metadata = {
  title: "Planos e preços",
  description: `Planos do Gigs Control a partir de R$ ${MENOR_MENSAL_BRL}/mês. Sistema de gestão para agências de artistas e DJs: agenda, contratos com assinatura digital, financeiro e CRM. Sem fidelidade.`,
  alternates: { canonical: "/planos" },
};

export default function PlanosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
