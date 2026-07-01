import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";

/**
 * GET /api/voos/lookup?flight=LA3477
 * Busca dados de um voo por número (IATA) na AviationStack. A chave fica só no
 * servidor (AVIATIONSTACK_API_KEY). Autofill é OPCIONAL: sem chave, responde
 * { indisponivel: true } e a UI segue 100% no preenchimento manual.
 *
 * Cache em memória (best-effort) pra poupar a cota grátis (100/mês).
 */

type VooResumo = {
  numeroVoo: string;
  companhia: string;
  origem: string; // IATA
  origemAeroporto: string;
  destino: string; // IATA
  destinoAeroporto: string;
  partida: string; // "HH:mm" (local do aeroporto)
  chegada: string; // "HH:mm"
};

const cache = new Map<string, { at: number; data: VooResumo }>();
const TTL = 1000 * 60 * 60 * 6; // 6h

/** Extrai "HH:mm" de um ISO "2026-07-10T14:30:00+00:00". */
function hhmm(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : "";
}

export async function GET(request: Request) {
  const r = await autenticarComWorkspace();
  if ("response" in r) return r.response;

  const flight = (new URL(request.url).searchParams.get("flight") ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!flight) {
    return NextResponse.json({ erro: "Informe o número do voo." }, { status: 400 });
  }

  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) {
    // Sem chave → autofill indisponível (não é erro: a UI continua manual).
    return NextResponse.json({ indisponivel: true });
  }

  const cached = cache.get(flight);
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json({ voo: cached.data });
  }

  try {
    const api =
      `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(key)}` +
      `&flight_iata=${encodeURIComponent(flight)}&limit=1`;
    const res = await fetch(api, { cache: "no-store" });
    const body = (await res.json()) as {
      error?: { message?: string };
      data?: Array<{
        airline?: { name?: string };
        flight?: { iata?: string };
        departure?: { airport?: string; iata?: string; scheduled?: string };
        arrival?: { airport?: string; iata?: string; scheduled?: string };
      }>;
    };

    if (body?.error) {
      return NextResponse.json(
        { erro: body.error.message ?? "Falha na API de voos." },
        { status: 502 }
      );
    }
    const f = Array.isArray(body?.data) ? body.data[0] : null;
    if (!f) {
      return NextResponse.json({ naoEncontrado: true });
    }

    const voo: VooResumo = {
      numeroVoo: f.flight?.iata ?? flight,
      companhia: f.airline?.name ?? "",
      origem: f.departure?.iata ?? "",
      origemAeroporto: f.departure?.airport ?? "",
      destino: f.arrival?.iata ?? "",
      destinoAeroporto: f.arrival?.airport ?? "",
      partida: hhmm(f.departure?.scheduled),
      chegada: hhmm(f.arrival?.scheduled),
    };
    cache.set(flight, { at: Date.now(), data: voo });
    return NextResponse.json({ voo });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao buscar voo." },
      { status: 502 }
    );
  }
}
