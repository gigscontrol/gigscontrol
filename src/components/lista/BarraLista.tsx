"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Barra padrão das listas (Vendas, Orçamentos, Pagamentos, Contratos,
 * Contatos): busca à esquerda, filtros à direita, 16 px até a tabela.
 * Antes eram 5 desenhos — buscas de 38 e 42 px, filtros em pílula, em chip
 * com borda ou em cartão, "Todos" ora primeiro, ora por último.
 */
export function BarraLista({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}

export function BuscaLista({
  valor,
  onMudar,
  placeholder,
  rotulo,
}: {
  valor: string;
  onMudar: (v: string) => void;
  placeholder: string;
  /** Nome do campo pro leitor de tela ("Buscar vendas"). */
  rotulo: string;
}) {
  const t = useT();
  return (
    <div className="flex h-[38px] min-w-[240px] max-w-md flex-1 items-center gap-2 rounded-control border border-border bg-surface px-3 transition-colors foco-campo-dentro">
      <Search size={15} className="flex-shrink-0 text-muted" />
      <input
        aria-label={rotulo}
        type="text"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
      {valor && (
        <button type="button" onClick={() => onMudar("")} className="text-xs text-muted hover:text-primary">
          {t("Limpar")}
        </button>
      )}
    </div>
  );
}

export type OpcaoFiltro<V extends string> = { valor: V; rotulo: string; n?: number };

/** Filtro de status em pílulas, com a contagem de cada uma. No celular rola na
 *  horizontal em vez de quebrar linha. */
export function FiltroPilulas<V extends string>({
  opcoes,
  valor,
  onMudar,
}: {
  opcoes: OpcaoFiltro<V>[];
  valor: V;
  onMudar: (v: V) => void;
}) {
  return (
    <div className="pill-group max-w-full overflow-x-auto [scrollbar-width:thin]">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          className={`pill ${valor === o.valor ? "active" : ""}`}
          onClick={() => onMudar(o.valor)}
        >
          {o.rotulo}
          {o.n !== undefined && <span className="pill-contagem">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}
