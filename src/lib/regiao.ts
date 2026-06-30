import type { Moeda } from "./planos";

/**
 * Resolve idioma e moeda padrão a partir do país (código ISO 3166-1 alpha-2,
 * ex. "BR", "US"). Regra: Brasil → português + BRL; qualquer outro → inglês +
 * USD. País desconhecido (dev local, sem header de geo) cai em BR.
 *
 * O país vem do header `x-vercel-ip-country` (Vercel Edge) ou, pra testes,
 * de um cookie `gc-pais`.
 */
export function regiaoDe(country: string | null | undefined): {
  br: boolean;
  langPadrao: "pt" | "en";
  moeda: Moeda;
} {
  const br = (country ?? "BR").toUpperCase() === "BR";
  return { br, langPadrao: br ? "pt" : "en", moeda: br ? "brl" : "usd" };
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
