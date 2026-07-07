import type { Contrato } from "@/lib/mappers/contrato";
import type { AssinanteResumo } from "@/lib/contratos-context";
import type { Traduzir } from "@/lib/i18n";

/**
 * Status contratual de um show (Agenda — Fase 3). Derivado da VENDA vinculada:
 * o show não tem contrato próprio, mas `show.vendaId` casa com `contrato.vendaId`.
 */
export type EstadoContratoShow =
  | "sem-contrato"
  | "rascunho"
  | "enviado"
  | "parcial"
  | "assinado"
  | "cancelado";

export type ResumoContratoShow = {
  estado: EstadoContratoShow;
  contrato: Contrato | null;
  /** Assinaturas coletadas / total de signatários. */
  assinados: number;
  total: number;
};

// Prioridade quando a venda tem mais de um contrato (raro): pega o mais avançado.
const RANK: Record<string, number> = { assinado: 4, enviado: 3, rascunho: 2, cancelado: 1 };

/**
 * Resolve o status contratual do show a partir da venda vinculada.
 * Escolhe o contrato "mais avançado" da venda (empate → mais recente) e conta
 * as assinaturas pra "Assinado X/Y".
 */
export function resumoContratoDoShow(
  vendaId: string | undefined | null,
  contratos: Contrato[],
  assinantesPorContrato: Record<string, AssinanteResumo[]>
): ResumoContratoShow {
  const vazio: ResumoContratoShow = {
    estado: "sem-contrato",
    contrato: null,
    assinados: 0,
    total: 0,
  };
  if (!vendaId) return vazio;
  const doVenda = contratos.filter((c) => c.vendaId === vendaId);
  if (doVenda.length === 0) return vazio;

  const contrato = [...doVenda].sort(
    (a, b) =>
      (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0) ||
      b.criadoEm.localeCompare(a.criadoEm)
  )[0];

  const ass = assinantesPorContrato[contrato.id] ?? [];
  const total = ass.length;
  const assinados = ass.filter((a) => a.status === "assinado").length;

  let estado: EstadoContratoShow;
  if (contrato.status === "cancelado") estado = "cancelado";
  else if (contrato.status === "assinado") estado = "assinado";
  else if (contrato.status === "rascunho") estado = "rascunho";
  else estado = assinados > 0 ? "parcial" : "enviado";

  return { estado, contrato, assinados, total };
}

/** Rótulo + classe de badge pro status contratual (usa o sistema de badges do app). */
export function rotuloContratoShow(
  r: ResumoContratoShow,
  t: Traduzir
): { texto: string; badgeClass: string } {
  switch (r.estado) {
    case "rascunho":
      return { texto: t("Contrato em rascunho"), badgeClass: "badge-neutral" };
    case "enviado":
      return { texto: t("Contrato enviado"), badgeClass: "badge-warning" };
    case "parcial":
      return {
        texto: t("Assinado {a}/{b}", { a: r.assinados, b: r.total }),
        badgeClass: "badge-warning",
      };
    case "assinado":
      return {
        texto: r.total > 0 ? t("Assinado {a}/{b}", { a: r.total, b: r.total }) : t("Assinado"),
        badgeClass: "badge-success",
      };
    case "cancelado":
      return { texto: t("Contrato cancelado"), badgeClass: "badge-danger" };
    case "sem-contrato":
    default:
      return { texto: t("Sem contrato"), badgeClass: "badge-neutral" };
  }
}
