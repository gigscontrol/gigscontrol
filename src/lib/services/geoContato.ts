import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodarEndereco } from "@/lib/geocode-osm";

/**
 * Resolve as coordenadas de um contato (contratante/casa) NO CADASTRO —
 * nunca ao abrir o mapa (tokens.md §7).
 *
 * Ordem:
 *   1. endereço preenchido → Nominatim (geo_precision:'address');
 *   2. falhou ou sem endereço → centroide da cidade (geo_precision:'city');
 *   3. cidade sem coords → limpa (evita coordenada velha de outra cidade).
 *
 * Cache: o chamador só invoca quando endereço/cidade MUDARAM (compara com a
 * linha existente); `geocoded_at` registra quando foi resolvido.
 */

export type CamposGeo = {
  lat: number | null;
  lng: number | null;
  geo_precision: "address" | "city" | null;
  geocoded_at: string;
};

export async function resolverGeoDoContato(
  supabase: SupabaseClient,
  params: {
    endereco?: string | null;
    cidadeId?: string | null;
    paisIso2?: string | null;
  }
): Promise<CamposGeo> {
  const agora = new Date().toISOString();
  const { endereco, cidadeId, paisIso2 } = params;

  // Centroide + contexto (nome/UF ajudam o Nominatim a acertar o endereço).
  type CidadeGeo = {
    nome: string;
    estado: string | null;
    pais: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
  };
  let cidade: CidadeGeo | null = null;

  if (cidadeId) {
    const { data } = await supabase
      .from("cidades")
      .select("nome, estado, pais, latitude, longitude")
      .eq("id", cidadeId)
      .maybeSingle();
    cidade = (data as CidadeGeo | null) ?? null;
  }

  // 1) Endereço completo → ponto exato.
  if (endereco && endereco.trim() !== "") {
    const exato = await geocodarEndereco(
      endereco,
      cidade?.nome ?? null,
      cidade?.estado ?? null,
      paisIso2 ?? cidade?.pais ?? null
    );
    if (exato) {
      return {
        lat: exato.latitude,
        lng: exato.longitude,
        geo_precision: "address",
        geocoded_at: agora,
      };
    }
  }

  // 2) Centroide da cidade.
  const latCidade =
    cidade?.latitude !== null && cidade?.latitude !== undefined
      ? Number(cidade.latitude)
      : null;
  const lngCidade =
    cidade?.longitude !== null && cidade?.longitude !== undefined
      ? Number(cidade.longitude)
      : null;
  if (
    latCidade !== null &&
    lngCidade !== null &&
    Number.isFinite(latCidade) &&
    Number.isFinite(lngCidade)
  ) {
    return { lat: latCidade, lng: lngCidade, geo_precision: "city", geocoded_at: agora };
  }

  // 3) Nada resolvível — limpa pra não sobrar coordenada de cidade antiga.
  return { lat: null, lng: null, geo_precision: null, geocoded_at: agora };
}
