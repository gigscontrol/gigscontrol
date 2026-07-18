import type { Moeda as MoedaPlano } from "./planos";
import type { Moeda } from "@/types";

/**
 * Resolve idioma e moeda padrão a partir do país (código ISO 3166-1 alpha-2,
 * ex. "BR", "US"). Regra: Brasil → português + BRL; qualquer outro → inglês +
 * USD. País desconhecido (dev local, sem header de geo) cai em BR.
 *
 * Isto é do CHECKOUT do próprio SaaS (moeda minúscula brl/usd). A moeda da
 * AGÊNCIA (vendas/contratos, BRL/USD/EUR) sai de `moedaAgenciaDe`.
 *
 * O país vem do header `x-vercel-ip-country` (Vercel Edge) ou, pra testes,
 * de um cookie `gc-pais`.
 */
export function regiaoDe(country: string | null | undefined): {
  br: boolean;
  langPadrao: "pt" | "en";
  moeda: MoedaPlano;
} {
  const br = (country ?? "BR").toUpperCase() === "BR";
  return { br, langPadrao: br ? "pt" : "en", moeda: br ? "brl" : "usd" };
}

// América (menos o BR, que é BRL). Norte + Central + Caribe + Sul.
const AMERICAS = new Set([
  "US", "CA", "MX", "GT", "BZ", "SV", "HN", "NI", "CR", "PA",
  "CU", "DO", "HT", "JM", "TT", "BS", "BB", "AG", "DM", "GD",
  "KN", "LC", "VC", "PR", "AR", "CL", "CO", "PE", "UY", "PY",
  "EC", "BO", "VE", "GY", "SR", "GF",
]);

// Europa (continente inteiro — o dono definiu "na europa euro", mesmo onde a
// moeda local não é o €; é só o DEFAULT do cadastro, o admin troca depois).
const EUROPA = new Set([
  "AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ",
  "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU",
  "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MD", "ME",
  "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE",
  "SI", "SK", "SM", "UA", "VA", "XK", "GI", "FO", "IM", "JE", "GG",
]);

/**
 * Moeda PADRÃO da agência a partir do país do IP, definida no signup SEM o
 * usuário ver (o admin pode trocar depois em Preferências):
 *   Brasil → BRL · demais Américas → USD · Europa → EUR · resto → USD.
 * (USD no "resto do mundo" é a moeda default do circuito internacional de
 * shows.) País ausente (dev, sem header) → BRL, como o resto do app.
 */
export function moedaAgenciaDe(country: string | null | undefined): Moeda {
  const p = (country ?? "BR").toUpperCase();
  if (p === "BR") return "BRL";
  if (EUROPA.has(p)) return "EUR";
  if (AMERICAS.has(p)) return "USD";
  return "USD";
}

/**
 * País efetivo da requisição: o header `x-vercel-ip-country` (Vercel Edge).
 * Em DEV, um cookie `gc-pais` pode sobrescrever (pra testar US/BR localmente);
 * em produção o cookie é IGNORADO — vale só o IP real (evita forjar região
 * pra pagar na moeda mais barata).
 */
export function resolverPais(
  headerPais: string | null | undefined,
  cookiePais: string | null | undefined
): string | null {
  if (process.env.NODE_ENV !== "production" && cookiePais) return cookiePais;
  return headerPais ?? null;
}
