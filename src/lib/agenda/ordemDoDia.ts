import type { Show } from "@/types";

/**
 * Shows de UM dia na ordem de leitura: horário crescente ("00:30" vem antes
 * de "23:00" — é a madrugada daquela data), "a definir" depois, cancelados
 * por último (saíram da operação, mas continuam visíveis).
 */
export function ordenarShowsDoDia<T extends Pick<Show, "status" | "time">>(shows: T[]): T[] {
  const peso = (s: T) => (s.status === "cancelado" ? 2 : s.time ? 0 : 1);
  return [...shows].sort((a, b) => {
    const p = peso(a) - peso(b);
    if (p !== 0) return p;
    return (a.time ?? "").localeCompare(b.time ?? "");
  });
}

/** Até quantos itens o dia mostra em cartão completo. */
export const MAX_CARTOES_CHEIOS = 2;
/** Até quantos itens o dia mostra em linhas compactas sem esconder nada. */
export const MAX_LINHAS_COMPACTAS = 5;

export type LayoutDoDia = { modo: "cheio" | "compacto"; visiveis: number; ocultos: number };

/**
 * Como um dia da grade do calendário mostra `total` itens (shows + itens da
 * agenda) sem esticar a semana inteira: até 2 em cartão completo; de 3 a 5 em
 * linhas compactas; acima disso 4 linhas + "+N mais" (abre o dia completo).
 */
export function layoutDoDia(total: number): LayoutDoDia {
  if (total <= MAX_CARTOES_CHEIOS) return { modo: "cheio", visiveis: total, ocultos: 0 };
  if (total <= MAX_LINHAS_COMPACTAS) return { modo: "compacto", visiveis: total, ocultos: 0 };
  const visiveis = MAX_LINHAS_COMPACTAS - 1;
  return { modo: "compacto", visiveis, ocultos: total - visiveis };
}
