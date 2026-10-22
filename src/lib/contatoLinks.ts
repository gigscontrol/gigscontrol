/**
 * Endereços tocáveis pra contato e local — o artista no celular toca e liga,
 * abre o WhatsApp ou o mapa, em vez de copiar texto.
 *
 * O telefone guardado já vem com o código do país (as fichas exibem
 * "+{dígitos}"), então aqui NÃO se acrescenta 55: número de fora do Brasil
 * continua certo. Módulo PURO — coberto por contatoLinks.test.ts.
 */

function digitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

/** "tel:+5541999990000" — ou "" se não há número. */
export function linkTelefone(telefone: string): string {
  const d = digitos(telefone);
  return d ? `tel:+${d}` : "";
}

/** "https://wa.me/5541999990000" — ou "" se não há número. */
export function linkWhatsApp(telefone: string): string {
  const d = digitos(telefone);
  return d ? `https://wa.me/${d}` : "";
}

/**
 * Perfil do Instagram ("@casa", "casa", "instagram.com/casa" ou o link)
 * → link do perfil. "" se não dá pra montar (texto com espaço, link de
 * outro site): aí a ficha mostra só o texto.
 */
export function linkInstagram(perfil: string): string {
  const s = perfil.trim();
  if (!s) return "";
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (!m && /^https?:\/\//i.test(s)) return "";
  const usuario = m ? m[1] : s.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(usuario) ? `https://www.instagram.com/${usuario}/` : "";
}

/** Busca do endereço no Google Maps (abre o app de mapas no celular). */
export function linkMapa(endereco: string, cidade?: string): string {
  const consulta = [endereco, cidade].map((s) => s?.trim()).filter(Boolean).join(", ");
  return consulta ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}` : "";
}
