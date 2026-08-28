"use client";

import type { ReactNode } from "react";
import Avatar from "../Avatar";
import type { ItemQuantidade } from "@/types";

/**
 * Linguagem visual da "ficha" — extraída do ShowDetalheModal (o popup do show
 * na agenda), que era a única tela de detalhe bonita do app. O redesign de
 * 28/08/2026 levou OrcamentoDetalhe e VendaDetalhe pra esta mesma linguagem:
 * cabeçalho com a cor do artista, blocos com ícone + título, linhas com ícone
 * e itens com divisores finos. Um lugar só — popup e páginas nunca divergem.
 */

/** Cabeçalho da ficha: gradiente na cor do artista + avatar + badges. */
export function FichaHero({
  artistaNome,
  artistaCor,
  linhaSuperior,
  titulo,
  badges,
  acoes,
}: {
  artistaNome?: string;
  artistaCor?: string;
  /** Texto pequeno sob o nome (ex.: a data legível do show). */
  linhaSuperior?: ReactNode;
  /** Título do evento/documento (ex.: nome do evento, "Orçamento ORC-0093"). */
  titulo?: ReactNode;
  badges?: ReactNode;
  /** Ações à direita do cabeçalho (ex.: botão de WhatsApp). */
  acoes?: ReactNode;
}) {
  return (
    <div
      className="-mx-5 -mt-5 mb-5 px-5 pt-5 pb-4 border-b border-border rounded-t-lg"
      style={{
        background: artistaCor
          ? `linear-gradient(135deg, ${artistaCor}26 0%, transparent 75%)`
          : "transparent",
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar nome={artistaNome} cor={artistaCor} size="lg" anel />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-primary truncate">
              {artistaNome ?? "—"}
            </div>
            {linhaSuperior && (
              <div className="text-xs text-secondary capitalize">{linhaSuperior}</div>
            )}
          </div>
        </div>
        {acoes && <div className="flex-shrink-0">{acoes}</div>}
      </div>

      {titulo && <div className="mt-3 text-sm font-semibold text-primary">{titulo}</div>}

      {badges && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">{badges}</div>
      )}
    </div>
  );
}

/**
 * Herói de PÁGINA da ficha — a versão larga do FichaHero para as telas de
 * detalhe (orçamento/venda), que ocupam o grid de 1400px como as demais
 * páginas. Mesmo DNA (gradiente na cor do artista, avatar, badges), mas em
 * card próprio, tipografia maior e uma linha inferior para status + ações.
 */
export function FichaHeroPagina({
  artistaNome,
  artistaCor,
  linhaSuperior,
  titulo,
  badges,
  acoes,
  rodape,
}: {
  artistaNome?: string;
  artistaCor?: string;
  /** Texto sob o nome do artista (ex.: a data legível do show). */
  linhaSuperior?: ReactNode;
  /** Título do documento (ex.: nome do evento + número). */
  titulo?: ReactNode;
  badges?: ReactNode;
  /** Ações principais à direita (ex.: WhatsApp, Editar venda). */
  acoes?: ReactNode;
  /** Linha inferior opcional (ex.: "Show na agenda" + cancelar). */
  rodape?: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-border overflow-hidden mb-4"
      style={{
        background: artistaCor
          ? `linear-gradient(120deg, ${artistaCor}2e 0%, ${artistaCor}10 35%, var(--surface) 78%)`
          : "var(--surface)",
      }}
    >
      <div className="px-5 py-5 lg:px-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar nome={artistaNome} cor={artistaCor} size="lg" anel />
            <div className="min-w-0">
              <div className="text-lg font-bold text-primary truncate leading-tight">
                {artistaNome ?? "—"}
              </div>
              {linhaSuperior && (
                <div className="text-xs text-secondary capitalize mt-0.5">{linhaSuperior}</div>
              )}
              {titulo && (
                <div className="mt-2 text-base font-semibold text-primary">{titulo}</div>
              )}
              {badges && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">{badges}</div>
              )}
            </div>
          </div>
          {acoes && (
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">{acoes}</div>
          )}
        </div>
      </div>
      {rodape && (
        <div className="px-5 lg:px-6 py-2.5 border-t border-border/60 bg-surface/60">
          {rodape}
        </div>
      )}
    </div>
  );
}

/** Bloco de seção: ícone na cor da marca + título em negrito. */
export function Bloco({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
        <span style={{ color: "var(--brand)" }}>{icon}</span>
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/** Linha de informação com ícone opcional. */
export function Linha({
  icon,
  bold,
  subtle,
  children,
}: {
  icon?: ReactNode;
  bold?: boolean;
  subtle?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-2 text-sm ${
        bold ? "text-primary font-semibold" : subtle ? "text-muted" : "text-secondary"
      }`}
    >
      {icon && <span className="mt-0.5 text-muted flex-shrink-0">{icon}</span>}
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Itens quantidade — "Nome …………… 2×" com divisores finos. */
export function ItensGrid({ items }: { items: ItemQuantidade[] }) {
  return (
    <div className="flex flex-col">
      {items.map((i) => (
        <div
          key={i.nome}
          className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-border/50 last:border-0"
        >
          <span className="text-secondary truncate">{i.nome}</span>
          <span className="font-semibold tabular-nums text-primary flex-shrink-0">
            {i.qtd}×
          </span>
        </div>
      ))}
    </div>
  );
}
