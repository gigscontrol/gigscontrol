"use client";

;
import { Plus, ArrowLeft } from "lucide-react";
import { Field } from "./Field";
import SearchableSelect from "./SearchableSelect";

type Option = { id: string; label: string; sublabel?: string };

type Props = {
  label: string;
  required?: boolean;
  options: Option[];
  selectedId: string | null;
  onSelectExisting: (id: string) => void;
  onSwitchToNew: () => void;
  mode: "existente" | "novo";
  newLabel: string;
  newFormChildren: React.ReactNode;
  onSwitchToExisting: () => void;
};

/**
 * Bloco "selecionar existente ou criar novo".
 * Mostra dropdown OU formulário inline conforme o modo.
 */
export default function ExistenteOuNovo({
  label,
  required,
  options,
  selectedId,
  onSelectExisting,
  onSwitchToNew,
  mode,
  newLabel,
  newFormChildren,
  onSwitchToExisting,
}: Props) {
  if (mode === "novo") {
    return (
      <div className="rounded-md border border-border bg-elevated/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-primary">{newLabel}</span>
          <button
            type="button"
            onClick={onSwitchToExisting}
            className="btn-ghost text-xs inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={12} /> Usar existente
          </button>
        </div>
        <div className="flex flex-col gap-3">{newFormChildren}</div>
      </div>
    );
  }

  return (
    <Field label={label} required={required}>
      <div className="flex gap-2">
        <SearchableSelect
          options={options}
          value={selectedId}
          onChange={onSelectExisting}
          placeholder={`Buscar ${label.toLowerCase()}…`}
          className="flex-1"
        />
        <button
          type="button"
          onClick={onSwitchToNew}
          className="btn btn-secondary flex-shrink-0"
          title={`Cadastrar ${label.toLowerCase()} novo`}
        >
          <Plus size={14} />
          Novo
        </button>
      </div>
    </Field>
  );
}
