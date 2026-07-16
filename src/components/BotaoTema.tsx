"use client";

import { Moon, Sun } from "lucide-react";
import { useTema } from "@/lib/useTema";
import { useT } from "@/lib/i18n";

/**
 * Botão de tema (sol/lua) na Topbar (app) e na LandingNav (site). No escuro
 * mostra o Sol (ação = ir pro claro); no claro mostra a Lua. Estado e
 * persistência vêm do useTema; padrão é ESCURO.
 *
 * `variante`: "app" (borda simples, sem fundo — igual ao LanguageSwitcher) ou
 * "landing" (fundo de superfície + raio 9px — igual aos vizinhos da nav).
 */
export default function BotaoTema({
  variante = "app",
}: {
  variante?: "app" | "landing";
}) {
  const { tema, alternar } = useTema();
  const t = useT();
  const rotulo = t(
    tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"
  );

  const classe =
    variante === "landing"
      ? "inline-flex h-9 w-9 items-center justify-center rounded-control border border-border bg-surface text-secondary transition-colors hover:text-primary"
      : "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-secondary transition-colors hover:text-primary hover:border-border-strong";

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className={classe}
    >
      {tema === "dark" ? (
        <Sun size={16} strokeWidth={1.8} />
      ) : (
        <Moon size={16} strokeWidth={1.8} />
      )}
    </button>
  );
}
