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

/** Busca do endereço no Google Maps (abre o app de mapas no celular). */
export function linkMapa(endereco: string, cidade?: string): string {
  const consulta = [endereco, cidade].map((s) => s?.trim()).filter(Boolean).join(", ");
  return consulta ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}` : "";
}
