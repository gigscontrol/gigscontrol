"use client";

import { Plus, Search } from "lucide-react";
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
  /** Abre uma busca avançada (modal). Opcional — só renderiza o botão se vier. */
  onPesquisaAvancada?: () => void;
};

/**
 * Bloco "selecionar existente ou criar novo". Os dois modos compartilham a
 * MESMA moldura (card interno + título no topo) pra os boxes terem a mesma
 * altura ao alternar. Novo: formulário inline. Existente: seletor com busca.
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
  onPesquisaAvancada,
}: Props) {
  const titulo =
    mode === "novo" ? newLabel : `${label} cadastrado`;

  return (
    <div className="rounded-md border border-border bg-elevated/40 p-4">
      <div className="mb-3">
        <span className="text-sm font-semibold text-primary">
          {titulo}
          {required && <span className="text-danger"> *</span>}
        </span>
      </div>

      {mode === "novo" ? (
        <div className="flex flex-col gap-3">{newFormChildren}</div>
      ) : (
        <div className="flex flex-col gap-3">
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
          {onPesquisaAvancada && (
            <button
              type="button"
              onClick={onPesquisaAvancada}
              className="btn btn-secondary w-full justify-center text-sm"
            >
              <Search size={15} />
              Pesquisa avançada nos contatos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
