import type { Parcela } from "@/types";

/**
 * A parcela carrega histórico financeiro que o delete→insert da edição de venda
 * DESTRUIRIA (D5)?
 *
 * `statusBase` só assume "pendente" | "pago": todo o resto do histórico mora em
 * `meta` (migração 56) e é gravado por /api/parcelas/[id] SEM tocar em
 * `status_base` — uma parcela cancelada, fixada ou já cobrada continua
 * "pendente". Olhar só o "pago" deixaria passar o cancelamento (motivo + quem
 * autorizou), o log de cobranças e o 📌, que a reinserção não recria (o payload
 * de escrita não tem `meta`).
 */
export function parcelaTemHistorico(p: Parcela): boolean {
  return (
    p.statusBase === "pago" ||
    !!p.meta?.pagamento ||
    p.meta?.cancelamento?.cancelado === true ||
    p.meta?.fixada === true ||
    (p.meta?.cobrancas?.length ?? 0) > 0
  );
}

/** Alguma parcela da venda tem histórico → o recálculo inteiro fica travado. */
export function algumaParcelaTemHistorico(parcelas: Parcela[]): boolean {
  return parcelas.some(parcelaTemHistorico);
}
