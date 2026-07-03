"use client";

/**
 * i18n leve, sem lib pesada. A chave do dicionário é o próprio texto em
 * português (fonte da verdade) — `t("Vendas")` devolve o inglês quando o
 * idioma é EN, senão o próprio PT (fallback seguro: nenhuma string some se
 * ainda não foi traduzida). Suporta interpolação simples: `t("{n} itens", {n})`.
 *
 * A preferência fica no cookie `gc-lang` (lido no servidor → sem flash). O
 * idioma/moeda iniciais vêm do layout (cookie da escolha do usuário ou, na
 * falta dele, o padrão da região por IP). `useMoeda()` devolve a moeda da
 * região (brl no Brasil, usd fora).
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
import { ES } from "./i18n-es";
import { FR } from "./i18n-fr";
import { DE } from "./i18n-de";
import { IT } from "./i18n-it";
import type { Moeda } from "./planos";

export type Lang = "pt" | "en" | "es" | "fr" | "de" | "it";

const DICTS: Record<Lang, Record<string, string>> = {
  pt: {},
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
  it: IT,
};

type TParams = Record<string, string | number>;
export type Traduzir = (pt: string, params?: TParams) => string;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Traduzir; moeda: Moeda };

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({
  children,
  initialLang = "pt",
  initialMoeda = "brl",
}: {
  children: ReactNode;
  initialLang?: Lang;
  initialMoeda?: Moeda;
}) {
  // Idioma inicial vem do servidor (cookie gc-lang ou geo por IP) — sem flash.
  const [lang, setLangState] = useState<Lang>(initialLang);
  // Moeda é definida pela região (IP) no servidor; não muda no client.
  const moeda = initialMoeda;

  // Migração: usuários antigos guardavam a escolha no localStorage. Se ainda
  // não há cookie (fonte nova), adota o localStorage e grava o cookie 1×.
  useEffect(() => {
    try {
      if (document.cookie.includes("gc-lang=")) return;
      const ls = localStorage.getItem("gc-lang");
      if (ls && ls in DICTS && ls !== lang) {
        setLangState(ls as Lang);
        document.cookie = `gc-lang=${ls};path=/;max-age=31536000;samesite=lax`;
      }
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    // Mantém <html lang> em dia (SSR resolve 1x; sem isto, leitor de tela e
    // crawler leem o idioma antigo após a troca em sessão).
    if (typeof document !== "undefined") document.documentElement.lang = l;
    try {
      document.cookie = `gc-lang=${l};path=/;max-age=31536000;samesite=lax`;
      localStorage.setItem("gc-lang", l); // redundância p/ compat
    } catch {
      /* ignora */
    }
  }, []);

  const t = useCallback<Traduzir>(
    (pt, params) => {
      let s = lang === "pt" ? pt : DICTS[lang][pt] ?? pt;
      if (params) {
        for (const k of Object.keys(params)) {
          // split/join troca TODAS as ocorrências (idiomas pluralizam mais de
          // uma palavra com o mesmo {s}, ex FR "jour{s} restant{s}")
          s = s.split(`{${k}}`).join(String(params[k]));
        }
      }
      return s;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, moeda }}>
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
  moeda: "brl",
  setLang: () => {},
  t: (pt, params) => {
    let s = pt;
    if (params) {
      for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
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

/** Moeda da região (brl no Brasil, usd fora). */
export function useMoeda(): Moeda {
  return useLang().moeda;
}
