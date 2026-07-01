import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";
import { geocodarCidadeBR } from "@/lib/geocode-osm";

/**
 * GET /api/geocode?nome=Chapecó&uf=SC
 *
 * Geocoda uma cidade brasileira (OpenStreetMap) e devolve
 * { latitude, longitude }. NÃO persiste nada — é só pra pegar o ponto
 * de referência da busca por raio (Mapa de Dobras), sem criar a cidade
 * na tabela `cidades` do workspace.
 */
export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const url = new URL(request.url);
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
