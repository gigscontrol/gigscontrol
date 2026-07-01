"use client";

import { useEffect } from "react";
import { useLang, type Lang } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-context";

const LANGS: Lang[] = ["pt", "en", "es", "fr", "de", "it"];

/**
 * Aplica o IDIOMA padrão da agência quando o usuário ainda não escolheu um
 * idioma (sem cookie gc-lang). País e formato de data já são aplicados no
 * workspace-context (singletons de preferencias.ts). Não renderiza nada.
 */
export default function PreferenciasApply() {
  const { setLang } = useLang();
  const { preferencias } = useWorkspace();

  useEffect(() => {
    const idioma = preferencias.idiomaPadrao;
    if (!idioma || !LANGS.includes(idioma as Lang)) return;
    try {
      // Se o usuário já tem escolha própria (cookie), respeita.
      if (document.cookie.includes("gc-lang=")) return;
    } catch {
      return;
    }
    setLang(idioma as Lang);
  }, [preferencias.idiomaPadrao, setLang]);

  return null;
}
