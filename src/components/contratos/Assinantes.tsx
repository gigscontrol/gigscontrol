"use client";

import { useT } from "@/lib/i18n";
import type { AssinanteResumo } from "@/lib/contratos-context";

/**
 * Bolinhas de status dos assinantes de um contrato:
 *  - verde  = assinou
 *  - laranja = abriu o link mas não assinou (tooltip: quantas vezes)
 *  - cinza  = nunca abriu
 */
export default function Assinantes({
  assinantes,
}: {
  assinantes: AssinanteResumo[];
}) {
  const t = useT();
  if (!assinantes || assinantes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
      {assinantes.map((a, i) => {
        const cor =
          a.status === "assinado"
            ? "var(--success)"
            : a.aberturas > 0
              ? "#f59e0b"
              : "var(--text-muted)";
        const titulo =
          a.status === "assinado"
            ? t("Assinou")
            : a.aberturas > 0
              ? t("Abriu {n}x sem assinar", { n: a.aberturas })
              : t("Não abriu");
        return (
          <span
            key={`${a.nome}-${i}`}
            className="inline-flex items-center gap-1.5 text-xs text-secondary"
            title={titulo}
          >
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: cor }}
            />
            <span className="truncate max-w-[160px]">{a.nome}</span>
          </span>
        );
      })}
    </div>
  );
}
