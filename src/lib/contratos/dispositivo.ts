/**
 * Resume um User-Agent CRU em algo legível tipo "Chrome · Windows".
 * Regex simples (sem lib): navegador + sistema operacional. Usado no relatório
 * de assinaturas (folha A4 e PDF carimbado) pra não mostrar o UA inteiro.
 * Se não reconhecer nada, devolve o começo do UA (truncado).
 */
export function resumirDispositivo(ua: string | null | undefined): string {
  if (!ua) return "";
  let navegador = "";
  if (/edg/i.test(ua)) navegador = "Edge";
  else if (/opr|opera/i.test(ua)) navegador = "Opera";
  else if (/chrome|crios/i.test(ua)) navegador = "Chrome";
  else if (/firefox|fxios/i.test(ua)) navegador = "Firefox";
  else if (/safari/i.test(ua)) navegador = "Safari";

  let so = "";
  if (/windows/i.test(ua)) so = "Windows";
  else if (/iphone|ipad|ipod/i.test(ua)) so = "iOS";
  else if (/android/i.test(ua)) so = "Android";
  else if (/mac os|macintosh/i.test(ua)) so = "macOS";
  else if (/linux/i.test(ua)) so = "Linux";

  const partes = [navegador, so].filter(Boolean);
  if (partes.length === 0) return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
  return partes.join(" · ");
}
