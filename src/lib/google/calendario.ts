import type { SupabaseClient } from "@supabase/supabase-js";
import type { VendaCreateInput } from "@/lib/validators/vendas.schema";
import { accessTokenValido } from "./conexao";

/**
 * Criação do evento do show no Google Calendar do artista conectado.
 *
 * Regra do negócio (definida pelo cliente): o evento é SEMPRE de DIA INTEIRO
 * na data agendada (data_show). Motivo: shows costumam acontecer na madrugada
 * do dia seguinte (ex.: agendado p/ dia 14, toca dia 15 às 01h), mas o dia que
 * "conta" na agenda é o dia agendado. O horário real de apresentação vai na
 * DESCRIÇÃO, não no horário do evento.
 */

const CAL_API = "https://www.googleapis.com/calendar/v3/calendars";

// Cores do evento (colorId do Google Calendar):
const COR_UVA = "3"; // Uva (Grape) — show agendado
const COR_VERMELHO = "11"; // Tomate (Tomato) — show cancelado

// Sem alarme/lembrete (o cliente não quer notificação).
const SEM_ALARME = { useDefault: false, overrides: [] as unknown[] };

type ItemQtd = { nome: string; qtd: number };

function addDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function moeda(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function listaItens(itens?: ItemQtd[]): string {
  if (!itens?.length) return "";
  return itens
    .filter((i) => i && i.nome && i.qtd > 0)
    .map((i) => `${i.nome} x${i.qtd}`)
    .join(", ");
}

function montarLogistica(l?: { aereaQtd: number; transladoTerrestre: boolean }): string {
  if (!l) return "";
  const partes: string[] = [];
  if (l.aereaQtd > 0) partes.push(`Aéreo x${l.aereaQtd}`);
  if (l.transladoTerrestre) partes.push("Translado terrestre");
  return partes.join(" · ");
}

/** Monta a descrição do evento na ordem definida pelo cliente. */
function montarDescricao(input: VendaCreateInput, djNome: string | null): string {
  const linhas: string[] = [];

  if (djNome) linhas.push(`🎧 Artista: ${djNome}`);

  const contratante = [input.contratante_nome, input.contratante_telefone]
    .filter(Boolean)
    .join(" · ");
  if (contratante) linhas.push(`👤 Contratante: ${contratante}`);

  const local = [input.nome_local, input.endereco_local].filter(Boolean).join(" — ");
  if (local) linhas.push(`📍 Local: ${local}`);

  if (input.capacidade_publico) {
    linhas.push(`🎟️ Público: ${input.capacidade_publico.toLocaleString("pt-BR")}`);
  }

  if (input.horario) {
    const hora = input.horario_fim
      ? `${input.horario} às ${input.horario_fim}`
      : input.horario;
    linhas.push(`🕐 Horário de apresentação: ${hora}`);
  }

  if (input.cache != null) linhas.push(`💰 Cachê: ${moeda(input.cache)}`);

  const camarim = listaItens(input.camarim);
  if (camarim) linhas.push(`🥂 Rider de camarim: ${camarim}`);

  const efeitos = listaItens(input.efeitos);
  if (efeitos) linhas.push(`🎆 Rider de efeitos: ${efeitos}`);

  const hotel = listaItens(input.hotel);
  if (hotel) linhas.push(`🏨 Hotel: ${hotel}`);

  const logistica = montarLogistica(input.logistica);
  if (logistica) linhas.push(`✈️ Logística: ${logistica}`);

  return linhas.join("\n");
}

/** POST de baixo nível na API do Calendar. Devolve o id do evento criado. */
export async function criarEvento(
  accessToken: string,
  calendarId: string,
  evento: Record<string, unknown>
): Promise<string> {
  const res = await fetch(
    `${CAL_API}/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(evento),
    }
  );
  if (!res.ok) {
    throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
  }
  const d = (await res.json()) as { id?: string };
  if (!d.id) throw new Error("Calendar API não devolveu o id do evento.");
  return d.id;
}

/**
 * Sincroniza um show recém-criado com o Google Calendar do artista.
 *
 * BEST-EFFORT: pensado pra ser chamado dentro de um try/catch — qualquer
 * falha (sem conexão, token revogado, API fora) NÃO deve quebrar a venda.
 * Se o artista não tem conta conectada, simplesmente não faz nada.
 *
 * Guarda o id do evento em shows.google_event_id (pra editar/remover na
 * Fase 3).
 */
export async function sincronizarShowNoGoogle(
  supabase: SupabaseClient,
  params: { artistId: string; showId: string; input: VendaCreateInput }
): Promise<{ eventId: string } | null> {
  const { artistId, showId, input } = params;
  if (!input.data_show) return null;

  const conexao = await accessTokenValido(supabase, artistId);
  if (!conexao) return null; // artista sem Google conectado — ignora

  // Nome do DJ (pra descrição).
  const { data: artista } = await supabase
    .from("artists")
    .select("nome")
    .eq("id", artistId)
    .maybeSingle();
  const djNome = (artista as { nome?: string } | null)?.nome ?? null;

  const titulo = `🎧 ${input.nome_evento || input.nome_local || "Show"}`;
  const local = [input.nome_local, input.endereco_local].filter(Boolean).join(", ");

  const evento: Record<string, unknown> = {
    summary: titulo,
    description: montarDescricao(input, djNome),
    // SEMPRE dia inteiro na data agendada (end.date é exclusivo no Google).
    start: { date: input.data_show },
    end: { date: addDias(input.data_show, 1) },
    colorId: COR_UVA, // show agendado = roxo/uva
    reminders: SEM_ALARME, // sem alarme
  };
  if (local) evento.location = local;

  const eventId = await criarEvento(conexao.accessToken, conexao.calendarId, evento);

  await supabase
    .from("shows")
    .update({ google_event_id: eventId })
    .eq("id", showId);

  console.log(
    `[google-calendar] evento criado ${eventId} (show ${showId}, calendar ${conexao.calendarId})`
  );
  return { eventId };
}

/**
 * Marca o evento do show como CANCELADO: muda a cor pra VERMELHO no Google
 * Calendar. NUNCA apaga o evento — quem apaga é o usuário. Best-effort
 * (pensado pra try/catch). Não faz nada se o show não tem evento sincronizado
 * ou se o artista não está conectado.
 */
export async function marcarEventoCancelado(
  supabase: SupabaseClient,
  showId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("shows")
    .select("google_event_id, artist_id")
    .eq("id", showId)
    .maybeSingle();
  const row = data as
    | { google_event_id?: string | null; artist_id?: string | null }
    | null;
  if (!row?.google_event_id || !row.artist_id) return false;

  const conexao = await accessTokenValido(supabase, row.artist_id);
  if (!conexao) return false;

  const res = await fetch(
    `${CAL_API}/${encodeURIComponent(conexao.calendarId)}/events/${encodeURIComponent(
      row.google_event_id
    )}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${conexao.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ colorId: COR_VERMELHO }),
    }
  );
  if (!res.ok) {
    throw new Error(`Calendar API (cancelar) ${res.status}: ${await res.text()}`);
  }
  console.log(
    `[google-calendar] evento marcado como CANCELADO ${row.google_event_id} (show ${showId})`
  );
  return true;
}
