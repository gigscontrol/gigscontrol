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
