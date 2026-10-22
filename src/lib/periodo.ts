import type { AgendaDateRange } from "@/types";

/** Meses abreviados — são os valores do seletor "Personalizado". */
export const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Período do seletor de datas: `mes` é 0-based; `tudo` = "Visão geral". */
export type PeriodoMes = { ano: number; mes: number; tudo: boolean };

/**
 * Resolve {ano, mes(0-based), tudo} a partir do seletor de datas das telas.
 * `tudo` = "Visão geral" (all-time, sem recorte de data). Nesse caso ano/mes
 * apontam pro mês corrente — fallback pros widgets que precisam de um mês
 * concreto (ocupação, datas).
 */
export function resolverMes(
  range: AgendaDateRange,
  customMonth: string | null,
  customYear: number | null,
  agora: Date = new Date()
): PeriodoMes {
  const h = agora;
  if (range === "Visão geral") return { ano: h.getFullYear(), mes: h.getMonth(), tudo: true };
  if (range === "Mês anterior") {
    const d = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Próximo mês") {
    const d = new Date(h.getFullYear(), h.getMonth() + 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Personalizado" && customMonth && customYear !== null) {
    return { ano: customYear, mes: Math.max(0, MESES_CURTO.indexOf(customMonth)), tudo: false };
  }
  return { ano: h.getFullYear(), mes: h.getMonth(), tudo: false };
}

/**
 * A data cai no período? `tudo` = sempre. Aceita "YYYY-MM-DD" (ancorada ao
 * meio-dia local) ou timestamp. Sem data: fica de fora — ou entra, com
 * `semDataEntra` (cadastros antigos sem data de criação, em Contatos).
 * (Antes eram 6 cópias locais, uma com a regra trocada.)
 */
export function dataNoMes(
  dataISO: string | undefined | null,
  p: PeriodoMes,
  opcoes: { semDataEntra?: boolean } = {}
): boolean {
  if (p.tudo) return true;
  if (!dataISO) return !!opcoes.semDataEntra;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  return d.getFullYear() === p.ano && d.getMonth() === p.mes;
}
