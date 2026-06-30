"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Music, Calendar, Plus, Plane, Car } from "lucide-react";
import DateRangeSelector from "./DateRangeSelector";
import PageHeader from "./PageHeader";
import { useShows } from "@/lib/shows-context";
import { useWorkspace, useArtistas } from "@/lib/workspace-context";
import { setFeriados, ehFeriado, ehVesperaDeFeriado } from "@/lib/feriados";
import { MODULE_THEMES } from "@/types";
import type { AgendaDateRange, Show, ShowStatus, DJ } from "@/types";
import ShowDetalheModal from "./ShowDetalheModal";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

const ALL_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DATE_RANGES = ["Mês anterior", "Mês atual", "Próximo mês", "Personalizado"] as const satisfies readonly AgendaDateRange[];

type DayCell = {
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
function isoDia(ano: number, mes1a12: number, dia: number): string {
  return `${ano}-${String(mes1a12).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Um show pertence a esta célula do calendário?
 *
 * Casa pela DATA ISO completa (fonte da verdade). Isso conserta o bug em
 * que um show de 03/jun aparecia também no dia 3 de nov, dez etc. — o
 * match antigo era só por dia-do-mês (`dayId`), ignorando mês/ano.
 *
 * Shows legados sem `data` caem no match por dia-do-mês, válido apenas
 * dentro do mês exibido (nunca no padding de outro mês).
 */
function showNoDia(s: Show, day: DayCell): boolean {
  // Células de padding (dias de outro mês) nunca exibem shows: cada show
  // aparece em exatamente um mês, evitando "duplicar" um show de borda ao
  // virar o mês.
  if (day.isOtherMonth) return false;
  if (s.data && day.dataISO) return s.data === day.dataISO;
  return s.dayId === day.id;
}

const STATUS_STYLES: Record<ShowStatus, { bg: string; color: string; label: string }> = {
  confirmado: { bg: "rgba(34, 197, 94, 0.12)", color: "var(--success)", label: "Confirmado" },
  pendente: { bg: "rgba(239, 68, 68, 0.12)", color: "var(--danger)", label: "Sem contrato" },
  logistica: { bg: "rgba(245, 158, 11, 0.12)", color: "var(--warning)", label: "Logística" },
  cancelado: { bg: "rgba(239, 68, 68, 0.18)", color: "var(--danger)", label: "Cancelado" },
};

function StatusBadge({ status }: { status: ShowStatus }) {
  const t = useT();
  const st = STATUS_STYLES[status];
  return (
    <span
      className="text-[0.6rem] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
      style={{ backgroundColor: st.bg, color: st.color }}
    >
      {t(st.label)}
    </span>
  );
}

function EventCard({ show, dj, onClick }: { show: Show; dj?: DJ; onClick?: () => void }) {
  const cancelado = show.status === "cancelado";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-surface-2 border border-border rounded-md p-2.5 mb-2 transition-all hover:border-border-strong hover:bg-elevated cursor-pointer ${
        cancelado ? "opacity-60" : ""
      }`}
      style={{
        borderLeft: `3px solid ${cancelado ? "var(--danger)" : dj ? dj.color : "transparent"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={`text-xs font-bold text-primary truncate ${
            cancelado ? "line-through" : ""
          }`}
        >
          {show.dj}
        </span>
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
  /** "Novo Show" no "+" de um dia → abre Nova Venda Direta com a data. */
  onNovaVendaNoDia?: (dataISO: string) => void;
};

export default function AgendaEscala({ selectedDJs, onAbrirOrcamento, onAbrirVenda, onNovaVendaNoDia }: Props) {
  const t = useT();
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
              const prevDia = prevMonthDays - paddingCount + 1 + i;
              const prevMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
              const prevYear = monthIdx === 0 ? year - 1 : year;
              currentWeek.push({
                uniqueKey: `prev-${year}-${monthIdx}-${i}`,
                id: `prev-${prevDia}`,
                name: DAY_NAMES[paddingJsDay],
                date: `${prevDia} ${ALL_MONTHS[prevMonthIdx]}`,
                dataISO: isoDia(prevYear, prevMonthIdx + 1, prevDia),
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
            dataISO: dISO,
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
      const lastYear = targetYears[targetYears.length - 1];
      const nextMonthIdx = lastMonthIdx === 11 ? 0 : lastMonthIdx + 1;
      const nextYear = lastMonthIdx === 11 ? lastYear + 1 : lastYear;
      const nextMonthName = ALL_MONTHS[nextMonthIdx];
      while (currentWeek.length < 7) {
        const paddingJsDay = currentWeek.length; // coluna = weekday (Dom-first)
        const nextDia = paddingNextDay;
        currentWeek.push({
          uniqueKey: `next-${lastMonthIdx}-${nextDia}`,
          id: `next-${nextDia}`,
          name: DAY_NAMES[paddingJsDay],
          date: `${nextDia} ${nextMonthName}`,
          dataISO: isoDia(nextYear, nextMonthIdx + 1, nextDia),
          isQuente: false,
          isOtherMonth: true,
        });
        paddingNextDay++;
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
  const [novoItemDia, setNovoItemDia] = useState<DayCell | null>(null);

  // Dias planos para listagem mobile
  const allDays = monthWeeks.flat();

  // Rótulo do período exibido (ex: "Junho 2026"). Derivado da 1ª célula
  // real do grid — assim acompanha os atalhos e o "Personalizado" sem
  // duplicar a lógica do resolver, e cobre a virada de ano sozinho.
  const periodoLabel = useMemo(() => {
    const real = allDays.find((d) => !d.isOtherMonth && d.dataISO);
    if (!real) return "";
    const [ano, mes] = real.dataISO.split("-").map(Number);
    return `${MESES_LONGOS[mes - 1]} ${ano}`;
  }, [allDays]);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Agenda de Shows"
        subtitle={`${t("Visão dinâmica")} — ${t(activeDateRange)}`}
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

      {/* Mês/ano em visualização — título do período */}
      {periodoLabel && (
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-primary capitalize whitespace-nowrap">
            {periodoLabel}
          </h2>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Header dos dias da semana (desktop) — rola junto (cada card já mostra o dia) */}
      <div className="hidden md:grid grid-cols-7 gap-2 mb-2 py-2">
        {DAY_NAMES_SHORT.map((d) => (
          <div
            key={d}
            className="text-[0.7rem] uppercase tracking-wider font-bold text-muted text-center"
          >
            {t(d)}
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
                shows={filteredShows.filter((s) => showNoDia(s, day))}
                artistas={artistas}
                accent={accent}
                onShowClick={setShowSelecionado}
                onNovoItem={setNovoItemDia}
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
            const shows = filteredShows.filter((s) => showNoDia(s, day));
            if (shows.length === 0 && !day.isToday) return null;
            return (
              <MobileDayCard
                key={day.uniqueKey}
                day={day}
                shows={shows}
                artistas={artistas}
                accent={accent}
                onShowClick={setShowSelecionado}
                onNovoItem={setNovoItemDia}
              />
            );
          })}
        {allDays.filter((d) => !d.isOtherMonth && filteredShows.some((s) => showNoDia(s, d))).length === 0 && (
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

      {/* Menu "+" — adicionar item a um dia */}
      {novoItemDia && (
        <NovoItemModal
          day={novoItemDia}
          onClose={() => setNovoItemDia(null)}
          onNovoShow={() => {
            const d = novoItemDia.dataISO;
            setNovoItemDia(null);
            onNovaVendaNoDia?.(d);
          }}
        />
      )}
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
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  artistas: DJ[];
  accent: string;
  onShowClick: (id: string) => void;
  onNovoItem: (day: DayCell) => void;
}) {
  const t = useT();
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
          <DayCellEmptySlot />
        )}
        {!day.isOtherMonth && <NovoItemSlot onClick={() => onNovoItem(day)} />}
      </div>
    </div>
  );
}

function DayCellEmptySlot() {
  const t = useT();
  return (
    <div className="flex items-center justify-center h-20 border border-dashed border-border rounded-md text-[0.7rem] text-muted">
      {t("Sem shows")}
    </div>
  );
}

/** Retângulo pontilhado com "+" — sempre o último item da coluna do dia. */
function NovoItemSlot({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Adicionar ao dia")}
      title={t("Adicionar ao dia")}
      className="mt-2 w-full flex items-center justify-center h-9 border border-dashed border-border rounded-md text-muted hover:text-secondary hover:border-border-strong transition-colors"
    >
      <Plus size={15} />
    </button>
  );
}

const ACOES_NOVO_ITEM: {
  key: string;
  label: string;
  desc: string;
  icon: typeof Music;
  cor: string;
  emBreve?: boolean;
}[] = [
  { key: "show", label: "Novo Show", desc: "Venda direta neste dia", icon: Music, cor: "var(--module-vendas)" },
  { key: "voo", label: "Novo Voo", desc: "Em breve", icon: Plane, cor: "var(--module-agenda)", emBreve: true },
  {
    key: "transporte",
    label: "Novo Transporte Terrestre",
    desc: "Em breve",
    icon: Car,
    cor: "var(--module-financeiro)",
    emBreve: true,
  },
  {
    key: "evento",
    label: "Novo Evento Personalizado",
    desc: "Em breve",
    icon: Calendar,
    cor: "var(--module-contratos)",
    emBreve: true,
  },
];

/** Action-sheet do "+": escolhe o tipo de item a adicionar no dia.
 *  Usa o Modal do app (portal pra document.body) → sempre centralizado na
 *  viewport, sem o bug de `fixed` ancorando no <main> com transform. */
function NovoItemModal({
  day,
  onClose,
  onNovoShow,
}: {
  day: DayCell;
  onClose: () => void;
  onNovoShow: () => void;
}) {
  const t = useT();
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("Adicionar ao dia")}
      subtitle={`${t(day.name)} · ${day.date}`}
      maxWidth={400}
    >
      <div className="flex flex-col gap-1">
        {ACOES_NOVO_ITEM.map((a) => {
          const Icone = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              disabled={a.emBreve}
              onClick={a.key === "show" ? onNovoShow : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors enabled:hover:bg-elevated disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <span
                className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${a.cor} 16%, transparent)`,
                  color: a.cor,
                }}
              >
                <Icone size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-primary">{t(a.label)}</span>
                <span className="block text-xs text-muted">{t(a.desc)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function MobileDayCard({
  day,
  shows,
  artistas,
  accent,
  onShowClick,
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  artistas: DJ[];
  accent: string;
  onShowClick: (id: string) => void;
  onNovoItem: (day: DayCell) => void;
}) {
  const t = useT();
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
        <MobileDayEmptySlot />
      )}
      <NovoItemSlot onClick={() => onNovoItem(day)} />
    </div>
  );
}

function MobileDayEmptySlot() {
  const t = useT();
  return (
    <div className="flex items-center justify-center h-16 border border-dashed border-border rounded-md text-xs text-muted">
      {t("Sem shows agendados")}
    </div>
  );
}

function EmptyState() {
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
