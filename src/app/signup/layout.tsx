import type { Metadata } from "next";

// Cobre também as rotas filhas (/signup/completar, /signup/verifique-email).
export const metadata: Metadata = {
  title: "Criar conta",
  description:
    "Crie sua conta e organize sua agência em minutos: agenda de shows, orçamentos, contratos com assinatura digital e financeiro. Teste o Gigs Control.",
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
