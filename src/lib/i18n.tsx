"use client";

/**
 * i18n leve, sem lib pesada. A chave do dicionário é o próprio texto em
 * português (fonte da verdade) — `t("Vendas")` devolve o inglês quando o
 * idioma é EN, senão o próprio PT (fallback seguro: nenhuma string some se
 * ainda não foi traduzida). Suporta interpolação simples: `t("{n} itens", {n})`.
 *
 * A preferência é salva no localStorage (`gc-lang`). Pra evitar mismatch de
 * hidratação, começa em "pt" no server/1º render e só lê o localStorage no
 * efeito (client), depois do mount.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { EN } from "./i18n-en";

export type Lang = "pt" | "en";

const DICTS: Record<Lang, Record<string, string>> = { pt: {}, en: EN };

type TParams = Record<string, string | number>;
export type Traduzir = (pt: string, params?: TParams) => string;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Traduzir };

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gc-lang");
      if (saved === "en" || saved === "pt") setLangState(saved);
    } catch {
      /* localStorage indisponível — segue em pt */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("gc-lang", l);
    } catch {
      /* ignora */
    }
  }, []);

  const t = useCallback<Traduzir>(
    (pt, params) => {
      let s = lang === "pt" ? pt : DICTS.en[pt] ?? pt;
      if (params) {
        for (const k of Object.keys(params)) {
          s = s.replace(`{${k}}`, String(params[k]));
        }
      }
      return s;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Fallback quando usado fora do provider (ex: páginas públicas login/landing,
 * que ficam fora do app). Mantém tudo em PT e não quebra — `t` é identidade
 * (com interpolação). Assim os componentes compartilhados (Field, inputs)
 * podem chamar `useT()` em qualquer lugar sem crashar.
 */
const FALLBACK: Ctx = {
  lang: "pt",
  setLang: () => {},
  t: (pt, params) => {
    let s = pt;
    if (params) {
      for (const k of Object.keys(params)) s = s.replace(`{${k}}`, String(params[k]));
    }
    return s;
  },
};

export function useLang(): Ctx {
  return useContext(LanguageContext) ?? FALLBACK;
}

/** Atalho pra só pegar a função de tradução. */
export function useT(): Traduzir {
  return useLang().t;
}
