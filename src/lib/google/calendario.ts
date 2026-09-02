import type { SupabaseClient } from "@supabase/supabase-js";
import type { VendaCreateInput } from "@/lib/validators/vendas.schema";
import type { LogisticaSelecao } from "@/types";
import { accessTokenValido } from "./conexao";
import { formatarMoeda } from "@/lib/formatters";
import { formatarQuantidade } from "@/lib/contratos/extenso";

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

function listaItens(itens?: ItemQtd[]): string {
  if (!itens?.length) return "";
  return itens
    .filter((i) => i && i.nome && i.qtd > 0)
    .map((i) => `${formatarQuantidade(i.qtd)} ${i.nome}`)
    .join(", ");
}

function montarLogistica(l?: LogisticaSelecao): string {
  if (!l) return "";
  const partes: string[] = [];
  // v2: soma ida+volta; compat: aereaQtd (ida+volta combinada) dos antigos.
  const aereo = (l.aereaIdaQtd ?? 0) + (l.aereaVoltaQtd ?? 0) || (l.aereaQtd ?? 0);
  if (aereo > 0) partes.push(`Aéreo x${aereo}`);
  if (l.transladoTerrestre) partes.push("Translado terrestre");
  return partes.join(" · ");
}

/** Monta a descrição do evento na ordem definida pelo cliente. */
function montarDescricao(input: VendaCreateInput, artistaNome: string | null): string {
  const linhas: string[] = [];

  if (artistaNome) linhas.push(`🎧 Artista: ${artistaNome}`);

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

  if (input.cache != null)
    linhas.push(`💰 Cachê: ${formatarMoeda(input.cache, input.moeda ?? "BRL")}`);

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

/**
 * Corpo do evento (sem a cor). Compartilhado pela criação e pela atualização —
 * assim o evento editado fica IDÊNTICO ao que a criação teria gerado.
 */
function corpoDoEvento(
  input: VendaCreateInput,
  artistaNome: string | null,
  dataShow: string
): Record<string, unknown> {
  const titulo = `🎧 ${input.nome_evento || input.nome_local || "Show"}`;
  const local = [input.nome_local, input.endereco_local].filter(Boolean).join(", ");
  const evento: Record<string, unknown> = {
    summary: titulo,
    description: montarDescricao(input, artistaNome),
    // SEMPRE dia inteiro na data agendada (end.date é exclusivo no Google).
    start: { date: dataShow },
    end: { date: addDias(dataShow, 1) },
    reminders: SEM_ALARME, // sem alarme
  };
  if (local) evento.location = local;
  return evento;
}

/** Nome do artista (pra descrição do evento). */
async function nomeDoArtista(
  supabase: SupabaseClient,
  artistId: string
): Promise<string | null> {
  const { data: artista } = await supabase
    .from("artists")
    .select("nome")
    .eq("id", artistId)
    .maybeSingle();
  return (artista as { nome?: string } | null)?.nome ?? null;
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

  const artistaNome = await nomeDoArtista(supabase, artistId);
  const evento = {
    ...corpoDoEvento(input, artistaNome, input.data_show),
    colorId: COR_UVA, // show agendado = roxo/uva
  };

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
 * Reflete a EDIÇÃO da venda no evento já existente do Google (PATCH).
 *
 * Por que não reusar `sincronizarShowNoGoogle`: aquela função faz POST, ou seja
 * a cada edição criaria um evento NOVO e o `google_event_id` antigo viraria
 * órfão no calendário do artista (evento duplicado). Aqui:
 *   - show sem evento (ou artista que conectou o Google depois) → cria;
 *   - evento existente → PATCH dos campos; se o Google diz que sumiu
 *     (404/410 — apagado na mão, ou é evento do artista ANTERIOR quando a venda
 *     trocou de artista), cria um novo no calendário atual.
 *
 * NÃO manda `colorId`: a cor carrega o estado de cancelado (vermelho) — re-carimbar
 * uva aqui "descancelaria" o evento visualmente.
 *
 * LIMITAÇÃO ACEITA: se a venda muda de artista, o evento antigo continua no
 * calendário do artista anterior (não temos o token dele nesse fluxo pra apagar,
 * e a regra do produto é NUNCA apagar evento do usuário).
 *
 * BEST-EFFORT: pensado pra ser chamado dentro de try/catch.
 */
export async function atualizarShowNoGoogle(
  supabase: SupabaseClient,
  params: { artistId: string; showId: string; input: VendaCreateInput }
): Promise<{ eventId: string } | null> {
  const { artistId, showId, input } = params;
  if (!input.data_show) return null;

  const { data } = await supabase
    .from("shows")
    .select("google_event_id")
    .eq("id", showId)
    .maybeSingle();
  const eventoAtual = (data as { google_event_id?: string | null } | null)?.google_event_id;
  if (!eventoAtual) {
    return sincronizarShowNoGoogle(supabase, params);
  }

  const conexao = await accessTokenValido(supabase, artistId);
  if (!conexao) return null; // artista sem Google conectado — ignora

  const artistaNome = await nomeDoArtista(supabase, artistId);
  const evento = corpoDoEvento(input, artistaNome, input.data_show);

  const res = await fetch(
    `${CAL_API}/${encodeURIComponent(conexao.calendarId)}/events/${encodeURIComponent(
      eventoAtual
    )}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${conexao.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(evento),
    }
  );

  if (res.status === 404 || res.status === 410) {
    // Evento sumiu do calendário atual → recria e re-vincula.
    return sincronizarShowNoGoogle(supabase, params);
  }
  if (!res.ok) {
    throw new Error(`Calendar API (editar) ${res.status}: ${await res.text()}`);
  }

  console.log(
    `[google-calendar] evento atualizado ${eventoAtual} (show ${showId}, calendar ${conexao.calendarId})`
  );
  return { eventId: eventoAtual };
}

/**
 * Muda a COR do evento do show no Google Calendar (PATCH). NUNCA apaga — quem
 * apaga é o usuário. Best-effort (pensado pra try/catch). Não faz nada se o
 * show não tem evento sincronizado ou se o artista não está conectado.
 */
async function patchCorEvento(
  supabase: SupabaseClient,
  showId: string,
  colorId: string,
  rotulo: string
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
      body: JSON.stringify({ colorId }),
    }
  );
  if (!res.ok) {
    throw new Error(`Calendar API (${rotulo}) ${res.status}: ${await res.text()}`);
  }
  console.log(
    `[google-calendar] evento ${rotulo} ${row.google_event_id} (show ${showId})`
  );
  return true;
}

/** Show CANCELADO → evento fica VERMELHO. Nunca apaga. */
export function marcarEventoCancelado(
  supabase: SupabaseClient,
  showId: string
): Promise<boolean> {
  return patchCorEvento(supabase, showId, COR_VERMELHO, "CANCELADO");
}

/** Show REATIVADO (volta a confirmado) → evento volta pra UVA. */
export function marcarEventoReativado(
  supabase: SupabaseClient,
  showId: string
): Promise<boolean> {
  return patchCorEvento(supabase, showId, COR_UVA, "reativado");
}
