/**
 * Nome e cor de CADA status do sistema, num lugar só. Tela que mostra status
 * usa daqui — o mesmo status com nome/cor diferentes em duas telas ("Sem
 * contrato" numa, "Pendente" na outra) é o que este arquivo existe pra evitar.
 *
 * `badge` = classe do sistema de badges (globals.css): badge-success,
 * badge-warning, badge-danger, badge-info, badge-neutral.
 */
import type { ContratoStatus } from "@/lib/mappers/contrato";
import type { ShowStatus } from "@/types";

export { LABELS_STATUS_ORCAMENTO as STATUS_ORCAMENTO, LABELS_STATUS_PARCELA as STATUS_PARCELA } from "@/types";

export type RotuloStatus = {
  label: string;
  badge: string;
  /** Cor de destaque (barras, números) — par do `badge`. */
  cor: string;
};

/**
 * Status do SHOW na agenda. Na prática só "confirmado" e "cancelado" são
 * gravados hoje; "pendente"/"logistica" são legados e mantêm nome neutro.
 * "Sem contrato" NÃO é status de show — vem do contrato da venda
 * (lib/contratoDoShow.ts).
 */
export const STATUS_SHOW: Record<ShowStatus, RotuloStatus> = {
  confirmado: { label: "Confirmado", badge: "badge-success", cor: "var(--success)" },
  pendente: { label: "Pendente", badge: "badge-warning", cor: "var(--warning)" },
  logistica: { label: "Logística", badge: "badge-warning", cor: "var(--warning)" },
  cancelado: { label: "Cancelado", badge: "badge-danger", cor: "var(--danger)" },
};

/** Status do CONTRATO (o documento). */
export const STATUS_CONTRATO: Record<ContratoStatus, RotuloStatus> = {
  rascunho: { label: "Rascunho", badge: "badge-neutral", cor: "var(--text-muted)" },
  enviado: { label: "Enviado", badge: "badge-info", cor: "var(--info)" },
  assinado: { label: "Assinado", badge: "badge-success", cor: "var(--success)" },
  cancelado: { label: "Cancelado", badge: "badge-danger", cor: "var(--danger)" },
};
