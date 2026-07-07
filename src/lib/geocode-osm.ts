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
  "GIGS-CONTROL/1.0 (gigscontrol.com; suporte@gigscontrol.com.br)";

export type Coords = { latitude: number; longitude: number };

/** Coords + caixa [sul, oeste, norte, leste] pra enquadrar no mapa. */
export type CoordsComBBox = Coords & { bbox?: [number, number, number, number] };

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

/**
 * Geocoda um PAÍS no Nominatim — usado pelo mapa da busca por raio pra
 * enquadrar o país quando o usuário troca o seletor (antes de ter cidade).
 * Devolve o centro + bounding box. Cache longo (país não muda de lugar).
 */
export async function geocodarPais(
  nome: string,
  iso2?: string | null
): Promise<CoordsComBBox | null> {
  if (!nome) return null;
  const params = new URLSearchParams({
    q: nome,
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  if (iso2 && /^[a-zA-Z]{2}$/.test(iso2)) {
    params.set("countrycodes", iso2.toLowerCase());
  }
  try {
    const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      boundingbox?: string[];
    }>;
    if (raw.length === 0) return null;
    const lat = parseFloat(raw[0].lat ?? "");
    const lon = parseFloat(raw[0].lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const out: CoordsComBBox = { latitude: lat, longitude: lon };
    const bb = raw[0].boundingbox;
    if (bb && bb.length === 4) {
      const [s, n, w, e] = bb.map(parseFloat);
      if ([s, n, w, e].every(Number.isFinite)) out.bbox = [s, w, n, e];
    }
    return out;
  } catch (e) {
    console.warn("[geocode-osm] exceção (país):", (e as Error).message);
    return null;
  }
}

/**
 * Geocoda um ENDEREÇO de contato (contratante/casa) no Nominatim.
 *
 * Busca livre "endereço, cidade, estado" restrita ao país (countrycodes) —
 * mais tolerante a endereços informais que a busca estruturada. Usado no
 * CADASTRO/edição (nunca ao abrir o mapa); resultado cacheado no banco via
 * geocoded_at. Falha graciosamente com null → chamador cai pro centroide
 * da cidade (geo_precision:'city').
 */
export async function geocodarEndereco(
  endereco: string,
  cidadeNome?: string | null,
  estado?: string | null,
  paisIso2?: string | null
): Promise<Coords | null> {
  const partes = [endereco, cidadeNome, estado].filter(
    (p): p is string => !!p && p.trim() !== ""
  );
  if (partes.length === 0) return null;

  const params = new URLSearchParams({
    q: partes.join(", "),
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  if (paisIso2 && /^[a-zA-Z]{2}$/.test(paisIso2)) {
    params.set("countrycodes", paisIso2.toLowerCase());
  }
  const url = `${NOMINATIM}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) {
      console.warn(`[geocode-osm] HTTP ${res.status} pra endereço`, partes.join(", "));
      return null;
    }
    const raw = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (raw.length === 0) return null;
    const lat = parseFloat(raw[0].lat ?? "");
    const lon = parseFloat(raw[0].lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { latitude: lat, longitude: lon };
  } catch (e) {
    console.warn("[geocode-osm] exceção (endereço):", (e as Error).message);
    return null;
  }
}
