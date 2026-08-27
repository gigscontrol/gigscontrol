import { NextResponse } from "next/server";

/**
 * Rate limit em memória por (bucket, chave) — janela deslizante simples.
 *
 * HONESTIDADE SOBRE O ALCANCE (auditoria 27/08/2026): em serverless cada
 * instância warm tem a própria memória, então o teto real é
 * `limite × nº de instâncias` e um cold start zera a conta. Ainda assim
 * corta o grosso: brute-force/enumeração barata bate milhares de vezes na
 * MESMA instância warm em sequência — e é exatamente isso que este freio
 * barra. Quando houver Redis/Upstash no projeto, trocar a implementação
 * mantendo esta assinatura.
 *
 * Uso nas rotas:
 *   const limitado = rateLimit("login", ipDe(request), 10, 60_000);
 *   if (limitado) return limitado; // NextResponse 429 pronto
 */

type Janela = { inicio: number; usos: number };

const buckets = new Map<string, Janela>();

/** Limpeza preguiçosa: remove janelas velhas quando o mapa cresce. */
function limparVencidas(agora: number, janelaMs: number) {
  if (buckets.size < 5_000) return;
  for (const [k, j] of buckets) {
    if (agora - j.inicio > janelaMs) buckets.delete(k);
  }
}

/**
 * Registra 1 uso e devolve um NextResponse 429 quando o limite da janela
 * estourou (ou null quando a request pode seguir).
 */
export function rateLimit(
  bucket: string,
  chave: string,
  limite: number,
  janelaMs: number
): NextResponse | null {
  const agora = Date.now();
  limparVencidas(agora, janelaMs);

  const k = `${bucket}:${chave}`;
  const j = buckets.get(k);
  if (!j || agora - j.inicio > janelaMs) {
    buckets.set(k, { inicio: agora, usos: 1 });
    return null;
  }
  j.usos += 1;
  if (j.usos <= limite) return null;

  const retryS = Math.max(1, Math.ceil((j.inicio + janelaMs - agora) / 1000));
  return NextResponse.json(
    { erro: "Muitas tentativas. Aguarde um instante e tente de novo." },
    { status: 429, headers: { "Retry-After": String(retryS) } }
  );
}

/** IP do cliente atrás do proxy da Vercel (x-forwarded-for: primeiro hop). */
export function ipDe(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "sem-ip";
}
