import type { Metadata } from "next";

// Metadata da rota /recursos. A page é "use client", então o SEO fica neste
// layout server (children passa direto, sem envelope visual).
export const metadata: Metadata = {
  title: "Recursos — agenda de shows, contratos e financeiro",
  description:
    "Os 6 módulos do Gigs Control: agenda de shows, orçamentos, contratos com assinatura digital, financeiro, CRM de contratantes e gestão de equipe da agência.",
  alternates: { canonical: "/recursos" },
};

export default function RecursosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
