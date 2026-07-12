"use client";

// ============================================================================
// DashboardResumo — componente compartilhado do padrão card -> modal -> detalhe
// dos Dashboards (Vendas / Contratos / Contatos). Extraído das implementações
// locais duplicadas para eliminar a repetição. NÃO altera StatCard nem Modal.
//
// Mapa export -> origem (arquivo:linha de onde foi extraído):
//   ClickableStat  -> src/components/VendasDashboard.tsx:538
//                     src/components/contratos/DashboardContratos.tsx:433
//                     src/components/ContatosDashboard.tsx:273
//   ResumoNumero   -> src/components/VendasDashboard.tsx:556
//                     src/components/contratos/DashboardContratos.tsx:451
//   ResumoLinha    -> src/components/VendasDashboard.tsx:579  (variante left/right/rightColor)
//                     src/components/contratos/DashboardContratos.tsx:474 (variante clicável com onClick)
//   ResumoFooter   -> src/components/VendasDashboard.tsx:602
//                     src/components/contratos/DashboardContratos.tsx:510
//   ResumoLista    -> generalização da lista de "recentes" de
//                     src/components/contratos/DashboardContratos.tsx:287 (LinhaContrato)
//   ResumoModal    -> wrapper fino sobre src/components/Modal.tsx (padrão de abertura
//                     dos 3 dashboards via useState local).
//
// Divergências vs. spec (registradas em desvios[] do WI_RESULT):
//   - Props em PT (valor/label/accentColor/destaque) conforme spec do padrão. As
//     implementações locais usavam value/color/right — os WI-4/5/6 adaptam na migração.
//   - ResumoLinha ganhou `onClick?` (variante clicável com ChevronRight) porque
//     o DashboardContratos já usava isso; sem onClick vira a linha estática padrão.
// ============================================================================

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Modal from "./Modal";

// ---------------------------------------------------------------------------
// (1) ClickableStat — <button> com leve elevação no hover envolvendo um StatCard.
//     Não altera o StatCard; apenas o torna clicável (abre o ResumoModal local).
// ---------------------------------------------------------------------------
export function ClickableStat({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="text-left transition-transform hover:-translate-y-0.5 active:translate-y-0"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// (2) ResumoModal — wrapper fino sobre Modal.tsx. Adiciona `accentColor` como
//     fina barra de destaque no topo do conteúdo; delega tudo ao Modal existente.
// ---------------------------------------------------------------------------
export function ResumoModal({
  isOpen,
  onClose,
  title,
  subtitle,
  accentColor,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accentColor?: string;
  children: ReactNode;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} maxWidth={560}>
      {accentColor && (
        <div
          className="h-1 w-12 rounded-full mb-4"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// (3) ResumoNumero — número grande no topo do resumo (label + valor).
// ---------------------------------------------------------------------------
export function ResumoNumero({
  valor,
  label,
  accentColor,
}: {
  valor: string | number;
  label: string;
  accentColor?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-elevated p-3">
      <div className="stat-label">{label}</div>
      <div
        className={`text-2xl font-bold tabular-nums ${accentColor ? "" : "text-primary"}`}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {valor}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// (4) ResumoLinha — linha label -> valor. `destaque` deixa o valor em azul de
//     ação; `onClick` a torna clicável (com ChevronRight), como no DashboardContratos.
// ---------------------------------------------------------------------------
export function ResumoLinha({
  label,
  valor,
  destaque,
  onClick,
}: {
  label: ReactNode;
  valor: ReactNode;
  destaque?: boolean;
  onClick?: () => void;
}) {
  const base =
    "flex items-center justify-between gap-3 p-2.5 rounded-md border border-border bg-elevated";
  const valorClass = `text-sm font-semibold tabular-nums flex-shrink-0 ${
    destaque ? "text-info" : "text-primary"
  }`;

  if (!onClick) {
    return (
      <div className={base}>
        <div className="text-sm text-secondary min-w-0">{label}</div>
        <div className={valorClass}>{valor}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} w-full text-left hover:border-border-strong transition-colors`}
    >
      <div className="text-sm text-secondary min-w-0">{label}</div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={valorClass}>{valor}</span>
        <ChevronRight size={14} className="text-muted" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// (5) ResumoLista — até `maxItens` recentes clicáveis. Generaliza a lista de
//     "Contratos recentes" (LinhaContrato) para qualquer item {id,titulo,...}.
// ---------------------------------------------------------------------------
export type ResumoListaItem = {
  id: string;
  titulo: string;
  subtitulo?: string;
  valor?: ReactNode;
};

export function ResumoLista({
  itens,
  onItemClick,
  maxItens = 5,
}: {
  itens: ResumoListaItem[];
  onItemClick?: (id: string) => void;
  maxItens?: number;
}) {
  const visiveis = itens.slice(0, maxItens);

  return (
    <div className="flex flex-col gap-1.5">
      {visiveis.map((item) => {
        const conteudo = (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-primary truncate" title={item.titulo}>
                {item.titulo}
              </div>
              {item.subtitulo && (
                <div className="text-xs text-muted truncate">{item.subtitulo}</div>
              )}
            </div>
            {item.valor != null && (
              <div className="text-sm font-semibold tabular-nums text-primary flex-shrink-0">
                {item.valor}
              </div>
            )}
            {onItemClick && (
              <ChevronRight size={14} className="text-muted flex-shrink-0" />
            )}
          </>
        );

        const base =
          "flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated text-left w-full";

        return onItemClick ? (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick(item.id)}
            className={`${base} hover:border-border-strong transition-colors`}
          >
            {conteudo}
          </button>
        ) : (
          <div key={item.id} className={base}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// (6) ResumoFooter — botão de rodapé "Ver mais detalhes" (rótulo variável).
// ---------------------------------------------------------------------------
export function ResumoFooter({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full inline-flex items-center justify-center gap-1.5 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-sm font-medium text-primary mt-1"
    >
      {label}
      <ChevronRight size={14} />
    </button>
  );
}
