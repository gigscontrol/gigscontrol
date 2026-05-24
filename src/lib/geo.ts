/**
 * Funções geográficas — distância entre coordenadas (lat/lng).
 *
 * Usadas pelo Mapa de Dobras (busca de contatos por raio em km a partir
 * de uma cidade de referência).
 */

const RAIO_TERRA_KM = 6371;

function toRad(graus: number): number {
  return (graus * Math.PI) / 180;
}

export type LatLng = { latitude?: number; longitude?: number };

/**
 * Distância em km entre dois pontos pela fórmula de Haversine.
 * Retorna `undefined` se algum dos pontos não tiver coordenadas.
 */
export function distanciaKm(a: LatLng, b: LatLng): number | undefined {
  if (
    a.latitude === undefined ||
    a.longitude === undefined ||
    b.latitude === undefined ||
    b.longitude === undefined
  ) {
    return undefined;
  }

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

/** Formata km como "123 km" (arredondado). Retorna "—" se indefinido. */
export function formatarKm(km: number | undefined): string {
  if (km === undefined) return "—";
  if (km < 1) return "<1 km";
  return `${Math.round(km)} km`;
}
