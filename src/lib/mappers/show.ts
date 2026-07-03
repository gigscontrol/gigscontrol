import type { Show, ShowStatus } from "@/types";

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

/**
 * Converte uma row do banco no objeto `Show` que a UI usa.
 * Os campos denormalizados (`dj`, `location`, `venue`) são preenchidos
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

  return {
    id: row.id,
    dayId: diaDoMes(row.data),
    data: row.data ?? undefined,
    djId: row.artist_id ?? "",
    dj: row.artist?.nome ?? "",
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
  };
}

/**
 * Campos aceitos no INSERT/UPDATE.
 * `dj`, `location`, `venue`, `dayId` são derivados — não persistem.
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
};
