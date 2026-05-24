import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GIGS CONTROL — Gestão para a música",
  description:
    "CRM e gestão completa para DJs, cantores, MCs e agências musicais. Agenda, orçamentos, vendas e financeiro em um só lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
