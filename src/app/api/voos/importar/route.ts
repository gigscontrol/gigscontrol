import { NextResponse } from "next/server";
import { autenticarComWorkspace } from "@/lib/api/session";

/**
 * POST /api/voos/importar  { pdf: base64, nome?: string }
 * Manda o PDF do voucher pro Claude (Anthropic) extrair TODOS os trechos de
 * voo em JSON. A chave (ANTHROPIC_API_KEY) fica só no servidor. O PDF NÃO é
 * guardado — é lido e descartado. Sem chave → { indisponivel: true }.
 */

const MODELO = "claude-haiku-4-5-20251001"; // barato p/ extração estruturada
const MAX_PDF_BYTES = 8 * 1024 * 1024; // ~8MB de PDF (base64 infla ~33%)

const PROMPT = `Você recebe um voucher/confirmação de reserva de voos. Extraia TODOS os trechos de voo do documento.
Responda SOMENTE com um array JSON (nada de texto antes ou depois), no formato:
[{"numeroVoo":"LA3477","companhia":"LATAM","data":"2026-07-10","origem":"GRU","destino":"SCL","partida":"14:30","chegada":"18:00","duracao":"3h55","bagagem":"1x 23kg","localizador":"ABC123","passageiros":["Arthur Alves Dreher"]}]
Regras:
- data em YYYY-MM-DD (a data de PARTIDA do trecho).
- origem/destino em código IATA de 3 letras (ex: GRU, SCL). Se só tiver a cidade, deduza o IATA do aeroporto principal.
- partida/chegada em HH:mm 24h (horário local).
- duracao = duração do trecho no formato "3h55" (calcule por partida→chegada se não vier explícito; "" se não der).
- bagagem = bagagem DESPACHADA/extra além da de mão. Se o voucher indicar só bagagem de mão (sem mala despachada), use "Não". Se houver despachada, descreva conciso: "1x 23kg", "2x 32kg". "" se o voucher não mencionar bagagem.
- localizador = código da reserva (PNR), o mesmo para todos os trechos se houver um só.
- passageiros = nomes na ORDEM NATURAL (nome próprio primeiro, sobrenomes depois): "Arthur Alves Dreher". NUNCA inverta nem use barra — NÃO escreva "Alves Dreher/Arthur". Array de strings; [] se não houver.
- se um campo não aparecer, use "" (string vazia).
- um trecho por voo (ida e volta = 2 itens; conexões = 1 item por perna).
Se não houver nenhum voo, responda [].`;

type VooExtraido = {
  numeroVoo?: string;
  companhia?: string;
  data?: string;
  origem?: string;
  destino?: string;
  partida?: string;
  chegada?: string;
  duracao?: string;
  bagagem?: string;
  localizador?: string;
  passageiros?: string[];
};

/** Extrai o array JSON da resposta do modelo (defensivo). */
function extrairJson(texto: string): VooExtraido[] | null {
  const ini = texto.indexOf("[");
  const fim = texto.lastIndexOf("]");
  if (ini === -1 || fim === -1 || fim < ini) return null;
  try {
    const arr = JSON.parse(texto.slice(ini, fim + 1));
    return Array.isArray(arr) ? (arr as VooExtraido[]) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const r = await autenticarComWorkspace({ exigirAcesso: true });
  if ("response" in r) return r.response;

  let body: { pdf?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const pdf = (body.pdf ?? "").replace(/^data:application\/pdf;base64,/, "");
  if (!pdf) {
    return NextResponse.json({ erro: "Envie o PDF do voucher." }, { status: 400 });
  }
  if (pdf.length > MAX_PDF_BYTES * 1.4) {
    return NextResponse.json({ erro: "PDF muito grande (máx. ~8MB)." }, { status: 413 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Sem chave → import por IA indisponível (não é erro fatal).
    return NextResponse.json({ indisponivel: true });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdf },
              },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    const data = (await res.json()) as {
      error?: { message?: string };
      content?: Array<{ type: string; text?: string }>;
    };
    if (data?.error) {
      return NextResponse.json(
        { erro: data.error.message ?? "Falha na leitura do voucher." },
        { status: 502 }
      );
    }
    const texto = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    const voos = extrairJson(texto);
    if (!voos) {
      return NextResponse.json(
        { erro: "Não consegui ler os voos desse voucher. Tente outro PDF ou preencha manual." },
        { status: 422 }
      );
    }
    return NextResponse.json({ voos });
  } catch (e) {
    return NextResponse.json(
      { erro: (e as Error).message ?? "Falha ao importar voucher." },
      { status: 502 }
    );
  }
}
