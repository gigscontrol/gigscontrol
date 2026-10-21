"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Plus, FileSignature } from "lucide-react";
import type { AgendaDateRange, Show, Artista, AgendaItem } from "@/types";
import { useT } from "@/lib/i18n";
import { useContratos } from "@/lib/contratos-context";
import { resumoContratoDoShow, rotuloContratoShow } from "@/lib/contratoDoShow";
import { STATUS_SHOW } from "@/lib/statusUI";
import { useVendas } from "@/lib/vendas-context";
import { ordenarShowsDoDia } from "@/lib/agenda/ordemDoDia";
import { AgendaItemCard, labelArtistas } from "./camposAgenda";

export const ALL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DATE_RANGES = ["Mês anterior", "Mês atual", "Próximo mês", "Personalizado"] as const satisfies readonly AgendaDateRange[];

export type DayCell = {
  uniqueKey: string;
  id: number | string;
  name: string;
  date: string;
  /** Data ISO completa "YYYY-MM-DD" desta célula — usada pra casar shows. */
  dataISO: string;
  /** Dia "quente": Sex/Sáb OU feriado OU véspera de feriado (ganha 🔥). */
  isQuente: boolean;
  isOtherMonth: boolean;
  isToday?: boolean;
};

/** "YYYY-MM-DD" a partir de ano, mês (1-12) e dia. */
export function isoDia(ano: number, mes1a12: number, dia: number): string {
  return `${ano}-${String(mes1a12).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** ISO "YYYY-MM-DD" de hoje (fuso local do browser). */
export function isoHoje(): string {
  const now = new Date();
  return isoDia(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * DayCell SINTÉTICO a partir de um ISO escolhido — reusa os mesmos helpers
 * do grid (DAY_NAMES/ALL_MONTHS) pro fluxo do "+" mobile poder criar item em
 * QUALQUER dia. `isQuente` fica false (cosmético; feriados só carregam pro
 * período em visualização). Retorna null se o ISO for inválido.
 */
export function cellDeISO(iso: string): DayCell | null {
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const date = new Date(ano, mes - 1, dia);
  const now = new Date();
  return {
    uniqueKey: `fab-${iso}`,
    id: dia,
    name: DAY_NAMES[date.getDay()],
    date: `${dia} ${ALL_MONTHS[mes - 1]}`,
    dataISO: iso,
    isQuente: false,
    isOtherMonth: false,
    isToday:
      dia === now.getDate() &&
      mes - 1 === now.getMonth() &&
      ano === now.getFullYear(),
  };
}

/** Casamento show↔célula: lógica pura em `@/lib/agenda/showNoDia` (com bateria). */

/**
 * Cartão do show no calendário — UM formato só, 3 linhas, em qualquer dia
 * (antes: cartão grande até 2 shows e linha compacta acima disso; misturar os
 * dois na mesma grade ficava estranho).
 *
 * Vendo vários artistas: artista + horário / local / cidade.
 * Vendo UM artista só (login de artista ou filtro com 1): o nome dele seria
 * repetido em todo cartão, então troca por local + horário / nome do evento /
 * cidade. O nome do evento só aparece quando é diferente do local (na maioria
 * das vendas é igual, e ficaria "Pedrão Bar" duas vezes).
 *
 * Contrato = ícone com a cor do status (texto no title). Cancelado: barra
 * vermelha e título riscado.
 */
export function CartaoShow({
  show,
  artista,
  umArtista,
  onClick,
}: {
  show: Show;
  artista?: Artista;
  umArtista: boolean;
  onClick?: () => void;
}) {
  const t = useT();
  const { contratos, assinantesPorContrato } = useContratos();
  const { vendas } = useVendas();
  const cancelado = show.status === "cancelado";
  const rcontrato = resumoContratoDoShow(show.vendaId, contratos, assinantesPorContrato);
  const rotContrato = rotuloContratoShow(rcontrato, t);
  const local = show.venue;
  const nomeEvento = show.vendaId ? vendas.find((v) => v.id === show.vendaId)?.nomeEvento?.trim() : "";
  const eventoDiferente =
    !!nomeEvento && nomeEvento.toLowerCase() !== (local ?? "").trim().toLowerCase();
  const titulo = umArtista ? local || nomeEvento || show.artistaNome : show.artistaNome;
  const segunda = umArtista ? (eventoDiferente ? nomeEvento : "") : local;
  return (
    <button
      type="button"
      onClick={onClick}
      title={[
        show.artistaNome,
        local,
        eventoDiferente ? nomeEvento : "",
        show.location,
        t(STATUS_SHOW[show.status]?.label ?? show.status),
      ]
        .filter(Boolean)
        .join(" — ")}
      className={`w-full text-left bg-surface-2 border border-border rounded-md px-2 py-1.5 mb-1.5 transition-all hover:border-border-strong hover:bg-elevated cursor-pointer ${
        cancelado ? "opacity-60" : ""
      }`}
      style={{
        borderLeft: `3px solid ${cancelado ? "var(--danger)" : artista ? artista.color : "transparent"}`,
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-xs font-bold text-primary truncate flex-1 ${cancelado ? "line-through" : ""}`}>
          {titulo}
        </span>
        {show.time ? (
          <span className="text-[0.7rem] font-semibold text-primary tabular-nums flex-shrink-0">{show.time}</span>
        ) : (
          <span className="text-[0.6875rem] font-medium text-warning flex-shrink-0">{t("A definir")}</span>
        )}
      </div>
      {segunda && <div className="text-[0.7rem] text-secondary truncate mt-0.5">{segunda}</div>}
      <div className="flex items-center gap-1 min-w-0 mt-0.5">
        <span className="text-[0.6875rem] text-muted truncate flex-1">{show.location}</span>
        {show.vendaId && (
          <span
            className={`badge ${rotContrato.badgeClass} flex-shrink-0 px-1 py-0`}
            title={rotContrato.texto}
            aria-label={rotContrato.texto}
          >
            <FileSignature size={9} />
          </span>
        )}
      </div>
    </button>
  );
}

// ---------- Subcomponentes ----------

export function DayCellComponent({
  day,
  shows,
  itens,
  artistas,
  umArtista,
  accent,
  podeAbrirNovoItem,
  onShowClick,
  onItemClick,
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  itens: AgendaItem[];
  artistas: Artista[];
  /** Calendário mostrando um artista só — o cartão troca o nome dele pelo local. */
  umArtista: boolean;
  accent: string;
  podeAbrirNovoItem: boolean;
  onShowClick: (id: string) => void;
  onItemClick: (item: AgendaItem) => void;
  onNovoItem: (day: DayCell) => void;
}) {
  const t = useT();
  // Dia de outro mês VAZIO continua bem apagado (é só moldura); com conteúdo
  // sobe pra 60% — no 30% o card do show ficava ilegível, e o objetivo aqui é
  // justamente conseguir LER o show da borda sem trocar de mês.
  const temConteudo = shows.length > 0 || itens.length > 0;
  return (
    <div
      data-hoje={day.isToday || undefined}
      className={`
        relative bg-surface border rounded-md p-2.5 flex flex-col overflow-hidden
        min-h-[280px] lg:min-h-[340px] transition-all
        ${day.isOtherMonth ? (temConteudo ? "opacity-60" : "opacity-30") : ""}
      `}
      style={{
        borderColor: day.isToday ? accent : day.isQuente ? "var(--border-strong)" : "var(--border-color)",
        boxShadow: day.isToday ? `0 0 0 1px ${accent}, 0 0 30px ${accent}25` : undefined,
        backgroundColor: day.isQuente && !day.isOtherMonth ? "var(--bg-surface-2)" : undefined,
      }}
    >
      <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-border">
        <div className="text-[0.7rem] uppercase font-bold tracking-wider text-muted flex items-center gap-1">
          {t(day.name).slice(0, 3)}
          {day.isQuente && !day.isOtherMonth && (
            <span
              className="text-sm leading-none animate-flame select-none"
              aria-label={t("Dia de pico")}
              title={t("Dia de pico")}
            >
              🔥
            </span>
          )}
        </div>
        <div
          className={`text-base font-bold tabular-nums ${day.isToday ? "" : "text-primary"}`}
          style={day.isToday ? { color: accent } : undefined}
        >
          {typeof day.id === "number" ? day.id : day.date.split(" ")[0]}
        </div>
      </div>

      {/* Todos os shows do dia expostos (nada escondido atrás de "+N"), em
          ordem de horário — o cartão de 3 linhas é que mantém a semana baixa. */}
      <div className="flex-1">
        {ordenarShowsDoDia(shows).map((show) => (
          <CartaoShow
            key={show.id}
            show={show}
            artista={artistas.find((d) => d.id === show.artistaId)}
            umArtista={umArtista}
            onClick={() => onShowClick(show.id)}
          />
        ))}
        {itens.map((item) => (
          <AgendaItemCard
            key={item.id}
            item={item}
            artistaLabel={labelArtistas(item.artistIds, artistas)}
            onClick={() => onItemClick(item)}
          />
        ))}
        {shows.length === 0 && itens.length === 0 && <DayCellEmptySlot />}
        {!day.isOtherMonth && (
          <NovoItemSlot onClick={() => onNovoItem(day)} podeCriar={podeAbrirNovoItem} />
        )}
      </div>
    </div>
  );
}

export function DayCellEmptySlot() {
  const t = useT();
  return (
    <div className="flex items-center justify-center h-20 border border-dashed border-border rounded-md text-[0.7rem] text-muted">
      {t("Sem shows")}
    </div>
  );
}

/** Retângulo pontilhado com "+" — sempre o último item da coluna do dia. */
export function NovoItemSlot({ onClick, podeCriar = true }: { onClick: () => void; podeCriar?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!podeCriar}
      aria-label={t("Adicionar ao dia")}
      title={!podeCriar ? t("Você não tem permissão para isso.") : t("Adicionar ao dia")}
      className="mt-2 w-full flex items-center justify-center h-9 border border-dashed border-border rounded-md text-muted hover:text-secondary hover:border-border-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus size={15} />
    </button>
  );
}

/**
 * Botão flutuante "+" (só mobile). A lista mobile só renderiza cards de dias
 * com conteúdo + hoje, então o "+" de cada card não alcança dias vazios — o
 * FAB abre o seletor de data e destrava a criação em qualquer dia.
 *
 * Portaled pro <body> porque o <main> mantém `transform: translateY(0)`
 * (animate-in, fill-mode both) e ancoraria o `fixed` nele em vez da viewport.
 */
export function FabNovoDia({ onClick, podeCriar }: { onClick: () => void; podeCriar: boolean }) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !podeCriar) return null;
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Novo item na agenda")}
      className="md:hidden fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-30 h-14 w-14 rounded-full flex items-center justify-center text-white transition-transform active:scale-95"
      style={{
        backgroundColor: "var(--brand)",
        boxShadow: "0 10px 30px var(--shadow-color)",
      }}
    >
      <Plus size={24} />
    </button>,
    document.body
  );
}

export function MobileDayCard({
  day,
  shows,
  itens,
  artistas,
  umArtista,
  accent,
  podeAbrirNovoItem,
  onShowClick,
  onItemClick,
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  itens: AgendaItem[];
  artistas: Artista[];
  umArtista: boolean;
  accent: string;
  podeAbrirNovoItem: boolean;
  onShowClick: (id: string) => void;
  onItemClick: (item: AgendaItem) => void;
  onNovoItem: (day: DayCell) => void;
}) {
  const t = useT();
  return (
    <div
      data-hoje={day.isToday || undefined}
      className="card scroll-mt-20"
      style={{
        borderColor: day.isToday ? accent : undefined,
        boxShadow: day.isToday ? `0 0 0 1px ${accent}` : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-muted font-bold">
            {t(day.name)}
          </div>
          <div
            className="text-lg font-bold tabular-nums"
            style={day.isToday ? { color: accent } : undefined}
          >
            {day.date}
          </div>
        </div>
        {day.isQuente && (
          <span
            className="text-lg leading-none animate-flame select-none"
            aria-label={t("Dia de pico")}
            title={t("Dia de pico")}
          >
            🔥
          </span>
        )}
      </div>
      {ordenarShowsDoDia(shows).map((show) => (
        <CartaoShow
          key={show.id}
          show={show}
          artista={artistas.find((d) => d.id === show.artistaId)}
          umArtista={umArtista}
          onClick={() => onShowClick(show.id)}
        />
      ))}
      {itens.map((item) => (
        <AgendaItemCard
          key={item.id}
          item={item}
          artistaLabel={labelArtistas(item.artistIds, artistas)}
          onClick={() => onItemClick(item)}
        />
      ))}
      {shows.length === 0 && itens.length === 0 && <MobileDayEmptySlot />}
      <NovoItemSlot onClick={() => onNovoItem(day)} podeCriar={podeAbrirNovoItem} />
    </div>
  );
}

export function MobileDayEmptySlot() {
  const t = useT();
  return (
    <div className="flex items-center justify-center h-16 border border-dashed border-border rounded-md text-xs text-muted">
      {t("Sem shows agendados")}
    </div>
  );
}

export function EmptyState() {
  const t = useT();
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
        <Calendar size={20} className="text-muted" />
      </div>
      <div className="section-title mb-1">{t("Nenhum show no período")}</div>
      <div className="section-subtitle">{t("Ajuste os filtros ou cadastre novos eventos")}</div>
    </div>
  );
}
