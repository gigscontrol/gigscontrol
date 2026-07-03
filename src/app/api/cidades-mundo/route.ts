import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";

/**
 * GET /api/cidades-mundo?country=<ISO2>&q=<texto>
 *
 * Autocomplete de cidades do mundo via GeoNames (secure.geonames.org).
 * Espelha o padrão do /api/cidades-br (IBGE), mas pra qualquer país.
 *
 * Precisa de GEONAMES_USERNAME no ambiente (conta grátis do GeoNames com
 * os "free web services" habilitados). Sem a chave → { indisponivel: true }.
 *
 * Resposta: { cidades: [{ nome, estado, latitude, longitude, geonameId }] }
 * — top 8 por população, só lugares povoados (featureClass=P).
 */

const GEONAMES = "https://secure.geonames.org/searchJSON";

type CidadeMundo = {
  nome: string;
  estado: string;
  latitude: number;
  longitude: number;
  geonameId: string;
};

// Cache em memória por country+q (vive enquanto o container do Next viver).
const cache = new Map<string, { dados: CidadeMundo[]; em: number }>();
const TTL_MS = 60 * 60 * 1000; // 1h

type GeoNameRaw = {
  name?: string;
  adminName1?: string;
  lat?: string;
  lng?: string;
  geonameId?: number;
};

export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const url = new URL(request.url);
  const country = (url.searchParams.get("country") ?? "").trim().toUpperCase();
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!country || q.length < 2) {
    return NextResponse.json({ cidades: [] });
  }

  const user = process.env.GEONAMES_USERNAME;
  if (!user) {
    // Sem conta GeoNames → autocomplete mundial indisponível (não fatal).
    return NextResponse.json({ indisponivel: true });
  }

  const chave = `${country}:${q.toLowerCase()}`;
  const hit = cache.get(chave);
  if (hit && Date.now() - hit.em < TTL_MS) {
    return NextResponse.json({ cidades: hit.dados });
  }

  const params = new URLSearchParams({
    name_startsWith: q,
    country,
    featureClass: "P",
    orderby: "population",
    maxRows: "8",
    username: user,
  });

  try {
    const res = await fetch(`${GEONAMES}?${params.toString()}`);
    const body = (await res.json()) as {
      status?: { message?: string; value?: number };
      geonames?: GeoNameRaw[];
    };
    if (body.status) {
      return NextResponse.json(
        { cidades: [], erro: body.status.message ?? "GeoNames indisponível." },
        { status: 502 }
      );
    }
    const cidades: CidadeMundo[] = (body.geonames ?? [])
      .map((g) => ({
        nome: g.name ?? "",
        estado: g.adminName1 ?? "",
        latitude: parseFloat(g.lat ?? ""),
        longitude: parseFloat(g.lng ?? ""),
        geonameId: String(g.geonameId ?? ""),
      }))
      .filter(
        (c) => c.nome && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
      );
    // Cap simples pra não crescer sem limite num host persistente (cada
    // país+prefixo digitado vira uma entrada). Ao estourar, zera e recomeça.
    if (cache.size > 500) cache.clear();
    cache.set(chave, { dados: cidades, em: Date.now() });
    return NextResponse.json({ cidades });
  } catch (e) {
    return NextResponse.json(
      { cidades: [], erro: (e as Error).message ?? "Falha no GeoNames." },
      { status: 502 }
    );
  }
}
