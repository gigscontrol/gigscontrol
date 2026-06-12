"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Music, Calendar } from "lucide-react";
import DateRangeSelector from "./DateRangeSelector";
import PageHeader from "./PageHeader";
import { useShows } from "@/lib/shows-context";
import { useWorkspace, useArtistas } from "@/lib/workspace-context";
import { setFeriados, ehFeriado, ehVesperaDeFeriado } from "@/lib/feriados";
import { MODULE_THEMES } from "@/types";
import type { AgendaDateRange, Show, ShowStatus, DJ } from "@/types";
import ShowDetalheModal from "./ShowDetalheModal";

const ALL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DATE_RANGES = ["Mês anterior", "Mês atual", "Próximo mês", "Personalizado"] as const satisfies readonly AgendaDateRange[];

type DayCell = {
  uniqueKey: string;
  id: number | string;
  name: string;
  date: string;
  /** Dia "quente": Sex/Sáb OU feriado OU véspera de feriado (ganha 🔥). */
  isQuente: boolean;
  isOtherMonth: boolean;
  isToday?: boolean;
};

const STATUS_STYLES: Record<ShowStatus, { bg: string; color: string; label: string }> = {
  confirmado: { bg: "rgba(34, 197, 94, 0.12)", color: "var(--success)", label: "Confirmado" },
  pendente: { bg: "rgba(239, 68, 68, 0.12)", color: "var(--danger)", label: "Sem contrato" },
  logistica: { bg: "rgba(245, 158, 11, 0.12)", color: "var(--warning)", label: "Logística" },
};

function StatusBadge({ status }: { status: ShowStatus }) {
  const st = STATUS_STYLES[status];
  return (
    <span
      className="text-[0.6rem] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
      style={{ backgroundColor: st.bg, color: st.color }}
    >
      {st.label}
    </span>
  );
}

function EventCard({ show, dj, onClick }: { show: Show; dj?: DJ; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-surface-2 border border-border rounded-md p-2.5 mb-2 transition-all hover:border-border-strong hover:bg-elevated cursor-pointer"
      style={{ borderLeft: dj ? `3px solid ${dj.color}` : undefined }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-bold text-primary truncate">{show.dj}</span>
        <StatusBadge status={show.status} />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[0.7rem] text-secondary">
          <Music size={11} className="flex-shrink-0 text-muted" />
          <span className="truncate font-medium text-primary">{show.venue}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[0.7rem] text-muted">
          <MapPin size={11} className="flex-shrink-0" />
          <span className="truncate">{show.location}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[0.7rem] text-muted">
          <Clock size={11} className="flex-shrink-0" />
          <span className="font-semibold text-primary tabular-nums">{show.time}</span>
        </div>
      </div>
    </button>
  );
}

type Props = {
  selectedDJs: string[];
  onAbrirOrcamento?: (id: string) => void;
  onAbrirVenda?: (id: string) => void;
};

export default function AgendaEscala({ selectedDJs, onAbrirOrcamento, onAbrirVenda }: Props) {
  const { shows } = useShows();
  const { workspaceCriadoEm } = useWorkspace();
  const artistas = useArtistas();
  const [showSelecionado, setShowSelecionado] = useState<string | null>(null);
  const [activeDateRange, setActiveDateRange] = useState<AgendaDateRange>("Mês atual");
  // Personalizado: seleção única de mês e ano. Defaults pro mês/ano
  // atuais (respeitando o mínimo de mai/2026 — data de criação do GIGS).
  const currentSysYear = new Date().getFullYear();
  const currentSysMonthIdx = new Date().getMonth();
  const [selectedCustomMonth, setSelectedCustomMonth] = useState<string | null>(
    ALL_MONTHS[Math.max(currentSysMonthIdx, currentSysYear === 2026 ? 4 : 0)]
  );
  const [selectedCustomYear, setSelectedCustomYear] = useState<number | null>(
    Math.max(currentSysYear, 2026)
  );

  const accent = MODULE_THEMES.agenda.color;

  const monthWeeks = useMemo<DayCell[][]>(() => {
    let targetMonths: number[] = [];
    let targetYears: number[] = [];
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    const currentYear = now.getFullYear();

    if (activeDateRange === "Mês atual") {
      targetMonths = [currentMonthIdx];
      targetYears = [currentYear];
    } else if (activeDateRange === "Mês anterior") {
      let pM = currentMonthIdx - 1;
      let pY = currentYear;
      if (pM < 0) { pM = 11; pY--; }
      targetMonths = [pM];
      targetYears = [pY];
    } else if (activeDateRange === "Próximo mês") {
      let nM = currentMonthIdx + 1;
      let nY = currentYear;
      if (nM > 11) { nM = 0; nY++; }
      targetMonths = [nM];
      targetYears = [nY];
    } else if (activeDateRange === "Personalizado") {
      const mesIdx = selectedCustomMonth ? ALL_MONTHS.indexOf(selectedCustomMonth) : -1;
      targetMonths = mesIdx >= 0 ? [mesIdx] : [currentMonthIdx];
      targetYears = selectedCustomYear !== null ? [selectedCustomYear] : [currentYear];
    }

    // Feriados nacionais dos anos exibidos (± 1 pra véspera na virada do ano).
    const anosSet = new Set<number>();
    targetYears.forEach((y) => {
      anosSet.add(y - 1);
      anosSet.add(y);
      anosSet.add(y + 1);
    });
    const feriados = setFeriados(Array.from(anosSet));

    const month: DayCell[][] = [];
    let currentWeek: DayCell[] = [];

    targetYears.forEach((year) => {
      targetMonths.forEach((monthIdx) => {
        const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, monthIdx, day);
          const jsDay = date.getDay();

          if (currentWeek.length === 0 && day === 1) {
            // Calendário DOM-first (igual ao header DAY_NAMES_SHORT): o
            // dia 1 vai pra coluna = seu weekday (Dom=0 ... Sáb=6). O
            // padding preenche as colunas anteriores com o fim do mês
            // passado. (Antes era Mon-first, o que desalinhava 1 coluna.)
            const paddingCount = jsDay;
            const prevMonthDays = new Date(year, monthIdx, 0).getDate();
            for (let i = 0; i < paddingCount; i++) {
              const paddingJsDay = i; // coluna i = weekday i (Dom-first)
              currentWeek.push({
                uniqueKey: `prev-${year}-${monthIdx}-${i}`,
                id: `prev-${prevMonthDays - paddingCount + 1 + i}`,
                name: DAY_NAMES[paddingJsDay],
                date: `${prevMonthDays - paddingCount + 1 + i} ${ALL_MONTHS[monthIdx === 0 ? 11 : monthIdx - 1]}`,
                isQuente: false,
                isOtherMonth: true,
              });
            }
          }

          const isWeekend = jsDay === 5 || jsDay === 6;
          const dISO = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isQuente =
            isWeekend ||
            ehFeriado(dISO, feriados) ||
            ehVesperaDeFeriado(dISO, feriados);
          const isToday =
            day === now.getDate() &&
            monthIdx === now.getMonth() &&
            year === now.getFullYear();

          currentWeek.push({
            uniqueKey: `month-${year}-${monthIdx}-${day}`,
            id: day,
            name: DAY_NAMES[jsDay],
            date: `${day} ${ALL_MONTHS[monthIdx]}`,
            isQuente,
            isOtherMonth: false,
            isToday,
          });

          if (currentWeek.length === 7) {
            month.push(currentWeek);
            currentWeek = [];
          }
        }
      });
    });

    if (currentWeek.length > 0) {
      let paddingNextDay = 1;
      const lastMonthIdx = targetMonths[targetMonths.length - 1];
      const nextMonthName = ALL_MONTHS[lastMonthIdx === 11 ? 0 : lastMonthIdx + 1];
      while (currentWeek.length < 7) {
        const paddingJsDay = currentWeek.length; // coluna = weekday (Dom-first)
        currentWeek.push({
          uniqueKey: `next-${lastMonthIdx}-${paddingNextDay}`,
          id: `next-${paddingNextDay}`,
          name: DAY_NAMES[paddingJsDay],
          date: `${paddingNextDay++} ${nextMonthName}`,
          isQuente: false,
          isOtherMonth: true,
        });
      }
      month.push(currentWeek);
    }
    return month;
  }, [activeDateRange, selectedCustomMonth, selectedCustomYear]);

  // Scroll automático para o card de hoje quando o usuário troca entre
  // os 3 atalhos pré-definidos (Mês atual / anterior / próximo).
  // No "Personalizado" NÃO rola — o usuário pode estar só abrindo o
  // popover pra escolher outro período; teleportar a tela atrapalha.
  useEffect(() => {
    if (activeDateRange === "Personalizado") return;
    const timer = setTimeout(() => {
      const todayCard = document.getElementById("day-card-today");
      if (todayCard) {
        todayCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [activeDateRange]);

  const filteredShows = shows.filter((show) => selectedDJs.includes(show.djId));

  // Dias planos para listagem mobile
  const allDays = monthWeeks.flat();

  return (
    <div className="max-w-[1600px] mx-auto w-full p-4 lg:p-8">
      <PageHeader
        title="Agenda de Shows"
        subtitle={`Visão dinâmica — ${activeDateRange}`}
        accentColor={accent}
        actions={
          <DateRangeSelector
            options={DATE_RANGES}
            value={activeDateRange}
            onChange={setActiveDateRange}
            selectedCustomMonth={selectedCustomMonth}
            setSelectedCustomMonth={setSelectedCustomMonth}
            selectedCustomYear={selectedCustomYear}
            setSelectedCustomYear={setSelectedCustomYear}
            accountCreatedAt={workspaceCriadoEm}
          />
        }
      />

      {/* Header dos dias da semana (desktop) */}
      <div className="hidden md:grid grid-cols-7 gap-2 mb-2 sticky top-0 bg-main py-2 z-10">
        {DAY_NAMES_SHORT.map((d) => (
          <div
            key={d}
            className="text-[0.7rem] uppercase tracking-wider font-bold text-muted text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendário desktop (grid 7 colunas) */}
      <div className="hidden md:flex flex-col gap-2">
        {monthWeeks.map((week, wIdx) => (
          <div key={`week-${wIdx}`} className="grid grid-cols-7 gap-2">
            {week.map((day) => (
              <DayCellComponent
                key={day.uniqueKey}
                day={day}
                shows={filteredShows.filter((s) => s.dayId === day.id)}
                artistas={artistas}
                accent={accent}
                onShowClick={setShowSelecionado}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Lista mobile (dias com shows OU dia atual) */}
      <div className="md:hidden flex flex-col gap-3">
        {allDays
          .filter((d) => !d.isOtherMonth)
          .map((day) => {
            const shows = filteredShows.filter((s) => s.dayId === day.id);
            if (shows.length === 0 && !day.isToday) return null;
            return (
              <MobileDayCard
                key={day.uniqueKey}
                day={day}
                shows={shows}
                artistas={artistas}
                accent={accent}
                onShowClick={setShowSelecionado}
              />
            );
          })}
        {allDays.filter((d) => !d.isOtherMonth && filteredShows.some((s) => s.dayId === d.id)).length === 0 && (
          <EmptyState />
        )}
      </div>

      {/* Modal de detalhes ao clicar em um show */}
      <ShowDetalheModal
        showId={showSelecionado}
        onClose={() => setShowSelecionado(null)}
        onAbrirOrcamento={onAbrirOrcamento}
        onAbrirVenda={onAbrirVenda}
      />
    </div>
  );
}

// ---------- Subcomponentes ----------

function DayCellComponent({
  day,
  shows,
  artistas,
  accent,
  onShowClick,
}: {
  day: DayCell;
  shows: Show[];
  artistas: DJ[];
  accent: string;
  onShowClick: (id: string) => void;
}) {
  return (
    <div
      id={day.isToday ? "day-card-today" : undefined}
      className={`
        relative bg-surface border rounded-md p-2.5 flex flex-col overflow-hidden
        min-h-[280px] lg:min-h-[340px] transition-all
        ${day.isOtherMonth ? "opacity-30" : ""}
      `}
      style={{
        borderColor: day.isToday ? accent : day.isQuente ? "var(--border-strong)" : "var(--border-color)",
        boxShadow: day.isToday ? `0 0 0 1px ${accent}, 0 0 30px ${accent}25` : undefined,
        backgroundColor: day.isQuente && !day.isOtherMonth ? "var(--bg-surface-2)" : undefined,
      }}
    >
      <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-border">
        <div className="text-[0.7rem] uppercase font-bold tracking-wider text-muted flex items-center gap-1">
          {day.name.slice(0, 3)}
          {day.isQuente && !day.isOtherMonth && (
            <span
              className="text-sm leading-none animate-flame select-none"
              aria-label="Dia de pico"
              title="Dia de pico"
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

      <div className="flex-1 overflow-y-auto -mr-1 pr-1">
        {shows.length > 0 ? (
          shows.map((show) => (
            <EventCard
              key={show.id}
              show={show}
              dj={artistas.find((d) => d.id === show.djId)}
              onClick={() => onShowClick(show.id)}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-20 border border-dashed border-border rounded-md text-[0.7rem] text-muted">
            Sem shows
          </div>
        )}
      </div>
    </div>
  );
}

function MobileDayCard({
  day,
  shows,
  artistas,
  accent,
  onShowClick,
}: {
  day: DayCell;
  shows: Show[];
  artistas: DJ[];
  accent: string;
  onShowClick: (id: string) => void;
}) {
  return (
    <div
      className="card"
      style={{
        borderColor: day.isToday ? accent : undefined,
        boxShadow: day.isToday ? `0 0 0 1px ${accent}` : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-muted font-bold">
            {day.name}
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
            aria-label="Dia de pico"
            title="Dia de pico"
          >
            🔥
          </span>
        )}
      </div>
      {shows.length > 0 ? (
        shows.map((show) => (
          <EventCard
            key={show.id}
            show={show}
            dj={artistas.find((d) => d.id === show.djId)}
            onClick={() => onShowClick(show.id)}
          />
        ))
      ) : (
        <div className="flex items-center justify-center h-16 border border-dashed border-border rounded-md text-xs text-muted">
          Sem shows agendados
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
        <Calendar size={20} className="text-muted" />
      </div>
      <div className="section-title mb-1">Nenhum show no período</div>
      <div className="section-subtitle">Ajuste os filtros ou cadastre novos eventos</div>
    </div>
  );
}
