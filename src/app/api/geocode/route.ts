import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { geocodarCidadeBR, geocodarPais } from "@/lib/geocode-osm";

/**
 * GET /api/geocode?nome=Chapecó&uf=SC   → cidade BR { latitude, longitude }
 * GET /api/geocode?pais=Portugal&iso=PT → país { latitude, longitude, bbox }
 *
 * Geocoda no OpenStreetMap e devolve as coordenadas. NÃO persiste nada —
 * é só pra referência/enquadramento da busca por raio (Mapa de Dobras).
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const url = new URL(request.url);

  // País (enquadrar o mapa ao trocar o seletor)
  const pais = (url.searchParams.get("pais") ?? "").trim();
  if (pais) {
    const iso = (url.searchParams.get("iso") ?? "").trim() || null;
    const coords = await geocodarPais(pais, iso);
    if (!coords) {
      return NextResponse.json({ erro: "País não localizado." }, { status: 404 });
    }
    return NextResponse.json(coords);
  }

  // Cidade brasileira (referência do raio)
  const nome = (url.searchParams.get("nome") ?? "").trim();
  const uf = (url.searchParams.get("uf") ?? "").trim();
  if (!nome || !uf) {
    return NextResponse.json({ erro: "Informe nome e uf." }, { status: 400 });
  }

  const coords = await geocodarCidadeBR(nome, uf);
  if (!coords) {
    return NextResponse.json({ erro: "Cidade não localizada." }, { status: 404 });
  }
  return NextResponse.json(coords);
}
