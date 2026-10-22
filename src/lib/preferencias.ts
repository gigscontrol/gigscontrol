/**
 * Preferências da agência (workspace) aplicadas globalmente via singletons
 * de módulo — setadas UMA vez quando o workspace carrega (ver
 * PreferenciasApply). Componentes de baixo nível leem daqui sem prop-drilling.
 *
 *  - paisPadrao  → default dos seletores de país (cidade, DDI, origem).
 *  - formatoData → ordem das datas ('dmy' = DD/MM/AAAA, 'mdy' = MM/DD/AAAA).
 *
 * O idioma padrão é aplicado direto no LanguageProvider (cookie), não aqui.
 */

import { COUNTRIES, BRASIL, type Country } from "./data/countries";

export type FormatoData = "dmy" | "mdy";

let paisPadraoCode = "BR";
let formatoData: FormatoData = "dmy";

export function setPreferencias(p: {
  pais?: string | null;
  formatoData?: string | null;
}): void {
  if (p.pais) paisPadraoCode = p.pais.toUpperCase();
  if (p.formatoData === "mdy" || p.formatoData === "dmy") {
    formatoData = p.formatoData;
  }
}

export function getPaisPadraoCode(): string {
  return paisPadraoCode;
}

export function getPaisPadrao(): Country {
  return COUNTRIES.find((c) => c.code === paisPadraoCode) ?? BRASIL;
}

export function getFormatoData(): FormatoData {
  return formatoData;
}

/** Locale do Intl pro idioma da interface (datas por extenso, horas, números). */
const LOCALE_DO_IDIOMA: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
};
let localeIntl = "pt-BR";

/** Chamado pelo LanguageProvider sempre que o idioma muda. */
export function setIdiomaFormatos(lang: string): void {
  localeIntl = LOCALE_DO_IDIOMA[lang] ?? "pt-BR";
}

export function getLocaleIntl(): string {
  return localeIntl;
}
