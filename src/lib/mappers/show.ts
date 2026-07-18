import type {
  Show,
  ShowStatus,
  CancelamentoInfo,
  BookingShow,
  ContratoDispensadoInfo,
} from "@/types";

/**
 * Linha bruta da tabela `shows` no Supabase, já com os joins úteis
 * para o front (nome do artista, nome da casa, nome+UF da cidade).
 */
export type ShowRow = {
  id: string;
  workspace_id: string;
  artist_id: string | null;
  contratante_id: string | null;
  casa_id: string | null;
  cidade_id: string | null;
  data: string | null;
  horario: string | null;
  status: string | null;
  valor: number | null;
  orcamento_id: string | null;
  venda_id: string | null;
  criado_em: string | null;
  criado_por: string | null;
  meta?: Record<string, unknown> | null;
  // joins (selecionados pelo repository)
  artist?: { id: string; nome: string; deletado_em: string | null } | null;
  casa?: { id: string; nome: string } | null;
  cidade?: { id: string; nome: string; estado: string | null } | null;
};

function statusValido(s: string | null | undefined): ShowStatus {
  if (
    s === "confirmado" ||
    s === "pendente" ||
    s === "logistica" ||
    s === "cancelado"
  )
    return s;
  return "confirmado";
}

/** Dia do mês (1-31) a partir de "YYYY-MM-DD". 0 quando data ausente. */
function diaDoMes(data: string | null): number {
  if (!data || data.length < 10) return 0;
  const d = parseInt(data.slice(8, 10), 10);
  return Number.isFinite(d) ? d : 0;
}

/** Valida um objeto cru de cancelamento vindo do jsonb `meta`. */
function cancelamentoValido(raw: unknown): CancelamentoInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (typeof c.motivo !== "string") return undefined;
  return {
    por: typeof c.por === "string" ? c.por : "",
    porNome: typeof c.porNome === "string" ? c.porNome : "—",
    em: typeof c.em === "string" ? c.em : "",
    motivo: c.motivo,
  };
}

/** Valida o objeto de booking/hospedagem vindo do jsonb `meta`. */
function bookingValido(raw: unknown): BookingShow | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const b = raw as Record<string, unknown>;
  if (b.status !== "solicitado" && b.status !== "informado") return undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    status: b.status,
    hotelNome: str(b.hotelNome),
    endereco: str(b.endereco),
    quarto: str(b.quarto),
    telefone: str(b.telefone),
    localizacao: str(b.localizacao),
    checkin: str(b.checkin),
    checkout: str(b.checkout),
    quartos: num(b.quartos),
    ocupacao: str(b.ocupacao),
    pago: typeof b.pago === "boolean" ? b.pago : undefined,
    voucherPath: str(b.voucherPath),
    observacoes: str(b.observacoes),
    solicitadoEm: str(b.solicitadoEm),
    informadoEm: str(b.informadoEm),
    atualizadoPor: str(b.atualizadoPor),
    atualizadoEm: str(b.atualizadoEm),
  };
}

/** Valida o carimbo de "dispensado de contrato" vindo do jsonb `meta`.
 *  Desfazer grava `null` na chave → cai no primeiro return e vira undefined. */
function contratoDispensadoValido(raw: unknown): ContratoDispensadoInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  if (typeof d.em !== "string" || !d.em) return undefined;
  return {
    em: d.em,
    por: typeof d.por === "string" ? d.por : "",
    porNome: typeof d.porNome === "string" ? d.porNome : undefined,
  };
}

/**
 * Converte uma row do banco no objeto `Show` que a UI usa.
 * Os campos denormalizados (`artistaNome`, `location`, `venue`) são preenchidos
 * a partir dos joins quando disponíveis.
 */
export function rowParaShow(row: ShowRow): Show {
  const cidadeNome = row.cidade?.nome ?? "";
  const cidadeUF = row.cidade?.estado ?? "";
  const location = cidadeNome
    ? cidadeUF
      ? `${cidadeNome}, ${cidadeUF}`
      : cidadeNome
    : "";

  const meta = (row.meta && typeof row.meta === "object" ? row.meta : {}) as Record<string, unknown>;
  const cancelamento = cancelamentoValido(meta.cancelamento);
  const histRaw = Array.isArray(meta.cancelamentoHistorico) ? meta.cancelamentoHistorico : [];
  const cancelamentoHistorico = histRaw
    .map(cancelamentoValido)
    .filter((c): c is CancelamentoInfo => !!c);
  const booking = bookingValido(meta.booking);
  const contratoDispensado = contratoDispensadoValido(meta.contratoDispensado);

  return {
    id: row.id,
    dayId: diaDoMes(row.data),
    data: row.data ?? undefined,
    artistaId: row.artist_id ?? "",
    artistaNome: row.artist?.nome ?? "",
    location,
    venue: row.casa?.nome ?? "",
    time: row.horario ?? "",
    status: statusValido(row.status),
    contratanteId: row.contratante_id ?? undefined,
    casaId: row.casa_id ?? undefined,
    cidadeId: row.cidade_id ?? undefined,
    valor: row.valor ?? undefined,
    orcamentoId: row.orcamento_id ?? undefined,
    vendaId: row.venda_id ?? undefined,
    cancelamento,
    cancelamentoHistorico: cancelamentoHistorico.length ? cancelamentoHistorico : undefined,
    booking,
    contratoDispensado,
    // Dono do show — alimenta o escopo "próprios" no grey-out do cliente
    // (gatesShow.ts). `criado_por` já vinha no SELECT do repo; só não era
    // exposto pro cliente.
    criadoPor: row.criado_por ?? undefined,
  };
}

/**
 * Campos aceitos no INSERT/UPDATE.
 * `artistaNome`, `location`, `venue`, `dayId` são derivados — não persistem.
 */
export type ShowEscrita = {
  workspace_id?: string;
  artist_id?: string | null;
  contratante_id?: string | null;
  casa_id?: string | null;
  cidade_id?: string | null;
  data?: string | null;
  horario?: string | null;
  status?: ShowStatus;
  valor?: number | null;
  orcamento_id?: string | null;
  venda_id?: string | null;
  criado_por?: string | null;
  /** jsonb — cancelamento/histórico e (futuro) booking. Escrito só pelo servidor. */
  meta?: Record<string, unknown>;
};
