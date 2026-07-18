"use client";

import type { ReactNode } from "react";
import Modal from "../Modal";

// ============================================================================
// AlertaDetalheModal — o popup por trás de cada card da faixa de Alertas da
// Agência (J5). Lista os ITENS que compõem o número e dá AÇÕES por linha
// (Ver / Resolver / Ignorar).
//
// Por que não o ResumoModal de DashboardResumo.tsx:
//   - ResumoModal fixa maxWidth={560} e ResumoLista aceita UM só callback por
//     item (`onItemClick`) e corta em `maxItens`. Aqui cada linha tem até 3
//     ações e a lista precisa ser inteira (19 vendas sem contrato).
//   Então este arquivo envolve o MESMO <Modal> que o ResumoModal envolve e
//   repete a barrinha de acento — é o mesmo padrão visual, só mais largo.
//   Os StatCards do topo (J6), que têm 1 ação por item, seguem usando
//   ClickableStat/ResumoModal/ResumoLista normalmente.
// ============================================================================

/** Uma ação de linha (Ver / Resolver / Ignorar / Desfazer). */
export type AcaoLinha = {
  label: string;
  onClick: () => void;
  /** "acao" = botão primário; "neutro" = secundário; "perigo" = destrutivo. */
  tone?: "acao" | "neutro" | "perigo";
  disabled?: boolean;
  /** Tooltip — usado pra explicar por que uma ação está indisponível. */
  title?: string;
};

/** Uma linha do popup: o item por trás do número. */
export type LinhaAlerta = {
  id: string;
  titulo: string;
  subtitulo?: string;
  /** 3ª linha (vencimento, tempo parado, quem dispensou...). */
  detalhe?: string;
  /** Valor já formatado na moeda do item (nunca somamos moedas). */
  valor?: string;
  /** Etiqueta curta à direita do título (ex.: "Dispensada"). */
  badge?: { label: string; className: string };
  /** Linha em tom apagado (item dispensado, fora da contagem). */
  esmaecida?: boolean;
  acoes: AcaoLinha[];
};

export default function AlertaDetalheModal({
  isOpen,
  onClose,
  title,
  subtitle,
  accentColor,
  numeroLabel,
  numeroValor,
  linhas,
  vazioLabel,
  erro,
  topo,
  rodape,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accentColor?: string;
  numeroLabel: string;
  numeroValor: string | number;
  linhas: LinhaAlerta[];
  vazioLabel: string;
  /** Mensagem de erro da última ação (ex.: PATCH do Ignorar falhou). */
  erro?: string | null;
  /** Controles acima da lista (ex.: toggle "mostrar dispensados"). */
  topo?: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidth={760}
    >
      {accentColor && (
        <div
          className="h-1 w-12 rounded-full mb-4"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
      )}

      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-elevated p-3">
          <div className="stat-label">{numeroLabel}</div>
          <div
            className={`text-2xl font-bold tabular-nums ${accentColor ? "" : "text-primary"}`}
            style={accentColor ? { color: accentColor } : undefined}
          >
            {numeroValor}
          </div>
        </div>

        {topo}

        {erro && (
          <div
            className="rounded-md border p-2.5 text-sm"
            style={{
              borderColor: "var(--danger)",
              color: "var(--danger)",
              backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
            }}
            role="alert"
          >
            {erro}
          </div>
        )}

        {linhas.length === 0 ? (
          <div className="text-sm text-muted text-center py-8">{vazioLabel}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linhas.map((l) => (
              <LinhaDoAlerta key={l.id} linha={l} />
            ))}
          </div>
        )}

        {rodape}
      </div>
    </Modal>
  );
}

/** Uma linha: dados à esquerda, valor à direita, ações embaixo. */
function LinhaDoAlerta({ linha }: { linha: LinhaAlerta }) {
  return (
    <div
      className="flex flex-col gap-2 p-2.5 rounded-md border border-border bg-elevated sm:flex-row sm:items-center sm:justify-between"
      style={linha.esmaecida ? { opacity: 0.6 } : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-medium text-primary truncate"
            title={linha.titulo}
          >
            {linha.titulo}
          </span>
          {linha.badge && (
            <span className={`badge ${linha.badge.className} flex-shrink-0`}>
              {linha.badge.label}
            </span>
          )}
        </div>
        {linha.subtitulo && (
          <div className="text-xs text-muted truncate" title={linha.subtitulo}>
            {linha.subtitulo}
          </div>
        )}
        {linha.detalhe && (
          <div className="text-xs text-muted truncate">{linha.detalhe}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {linha.valor && (
          <span className="text-sm font-semibold tabular-nums text-primary mr-1">
            {linha.valor}
          </span>
        )}
        {linha.acoes.map((a) => {
          const botao = (
            <button
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.title}
              className={`btn ${
                a.tone === "acao" ? "btn-primary" : "btn-secondary"
              } text-xs px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
              style={a.tone === "perigo" ? { color: "var(--danger)" } : undefined}
            >
              {a.label}
            </button>
          );
          // Botão DESABILITADO não recebe eventos de mouse no Chrome/Safari —
          // o `title` nele nunca apareceria. O wrapper habilitado recebe o
          // hover e mostra a explicação. (A razão também vai no texto da linha,
          // pra quem não usa mouse.)
          return a.disabled && a.title ? (
            <span key={a.label} title={a.title} className="inline-flex">
              {botao}
            </span>
          ) : (
            <span key={a.label} className="inline-flex">
              {botao}
            </span>
          );
        })}
      </div>
    </div>
  );
}
