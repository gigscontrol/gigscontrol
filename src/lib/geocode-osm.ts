/**
 * Geocoder simples usando o Nominatim do OpenStreetMap.
 *
 * Por que OSM? É gratuito, sem chave de API, e cobre o Brasil inteiro
 * (bem mais que as 10 cidades que tínhamos antes). Limites de uso:
 *   - Rate limit: 1 req/segundo por IP (regra de uso)
 *   - User-Agent obrigatório identificando a aplicação
 *
 * Como usamos: quando uma cidade IBGE é cadastrada pela primeira vez
 * no workspace, fazemos UMA chamada pra OSM pra obter lat/lng e salvar
 * em `cidades.latitude/longitude`. Daí em diante, lookups por ibge_id
 * usam o cache do banco — não bate mais no OSM.
 *
 * Falha graciosamente: se o OSM tá fora ou rate-limited, devolvemos
 * `null` e a cidade fica sem coords. O Mapa de Dobras filtra cidades
 * sem coords no front.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "GIGS-CONTROL/1.0 (gigscontrol.vercel.app; suporte@gigscontrol.com.br)";

export type Coords = { latitude: number; longitude: number };

/**
 * Geocoda uma cidade brasileira no OpenStreetMap.
 *
 * @param nome ex.: "Piracicaba"
 * @param uf   ex.: "SP"
 * @returns {latitude, longitude} ou null se não achou / OSM falhou
 */
export async function geocodarCidadeBR(
  nome: string,
  uf: string
): Promise<Coords | null> {
  if (!nome || !uf) return null;
  const params = new URLSearchParams({
    city: nome,
    state: uf,
    country: "Brasil",
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  const url = `${NOMINATIM}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      // OSM cache pode mudar — 7 dias é razoável (o município raramente
      // muda de lugar). Reaproveitamos cache do Next.
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) {
      console.warn(
        `[geocode-osm] HTTP ${res.status} pra ${nome}/${uf}`,
        await res.text().catch(() => "")
      );
      return null;
    }
    const raw = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (raw.length === 0) return null;
    const lat = parseFloat(raw[0].lat ?? "");
    const lon = parseFloat(raw[0].lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch (e) {
    console.warn("[geocode-osm] exceção:", (e as Error).message);
    return null;
  }
}
