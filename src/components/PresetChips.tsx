"use client";

import { Wand2, PencilLine } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ItemQuantidade } from "@/types";
import { aplicarPreset, presetAtivo, type PresetRider } from "@/lib/presetsRider";

/**
 * Chips de PRESET acima de uma lista de itens (Camarim/Efeitos/Técnico) no
 * Novo Orçamento / Concretizar Venda.
 *
 * - Clicar num preset APLICA as quantidades dele na lista (via onChange).
 * - O chip ativo é DERIVADO por comparação (presetAtivo): qualquer edição
 *   manual da lista faz a seleção cair pra "Personalizado" sozinha — e
 *   desfazer a edição reacende o preset, sem estado extra pra dessincronizar.
 * - "Personalizado" é um estado, não um botão: indica que a combinação atual
 *   foi feita à mão (ou partiu de um preset e foi ajustada).
 * - Sem presets definidos pro artista, não renderiza nada (zero ruído).
 */
export default function PresetChips({
  presets,
  items,
  onChange,
}: {
  presets: PresetRider[];
  items: ItemQuantidade[];
  onChange: (next: ItemQuantidade[]) => void;
}) {
  const t = useT();
  if (presets.length === 0) return null;

  const ativo = presetAtivo(items, presets);
  const temAlgumaQtd = items.some((i) => i.qtd > 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
      <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted mr-0.5">
        <Wand2 size={11} />
        {t("Preset")}
      </span>
      {presets.map((p, i) => {
        const isAtivo = ativo === i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(aplicarPreset(items, p))}
            title={p.itens.map((it) => `${it.qtd}× ${it.nome}`).join("\n")}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              isAtivo
                ? "border-transparent text-white"
                : "bg-elevated text-secondary border-border hover:border-border-strong hover:text-primary"
            }`}
            style={isAtivo ? { backgroundColor: "var(--brand)" } : undefined}
          >
            {p.nome}
          </button>
        );
      })}
      {/* "Personalizado" acende quando há SELEÇÃO que não bate com preset
          nenhum. Lista toda zerada não é personalizada — é só vazia. */}
      {ativo === null && temAlgumaQtd && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-border-strong text-primary">
          <PencilLine size={11} />
          {t("Personalizado")}
        </span>
      )}
    </div>
  );
}
