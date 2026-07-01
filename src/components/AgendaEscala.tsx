"use client";

import { useEffect, useMemo, useState, type ReactNode, type ChangeEvent } from "react";
import { MapPin, Clock, Music, Calendar, Plus, Plane, Car, Trash2, Search, FileUp, Pencil } from "lucide-react";
import DateRangeSelector from "./DateRangeSelector";
import PageHeader from "./PageHeader";
import { useShows } from "@/lib/shows-context";
import { useAgendaItems, type NovoAgendaItem } from "@/lib/agenda-items-context";
import { useWorkspace, useArtistas } from "@/lib/workspace-context";
import { setFeriados, ehFeriado, ehVesperaDeFeriado } from "@/lib/feriados";
import { MODULE_THEMES } from "@/types";
import type { AgendaDateRange, Show, ShowStatus, DJ, AgendaItem } from "@/types";
import ShowDetalheModal from "./ShowDetalheModal";
import Modal from "./Modal";
import InputHora from "./inputs/InputHora";
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
  const { itens: agendaItens, criar: criarItem, remover: removerItem } = useAgendaItems();
  // Itens visíveis: gerais (sem artista) sempre; com artista, filtra pelo DJ.
  const filteredItens = agendaItens.filter(
    (i) => i.artistIds.length === 0 || i.artistIds.some((id) => selectedDJs.includes(id))
  );
  const [novoItemDia, setNovoItemDia] = useState<DayCell | null>(null);
  const [eventoFormDia, setEventoFormDia] = useState<DayCell | null>(null);
  const [vooFormDia, setVooFormDia] = useState<DayCell | null>(null);
  const [itemDetalhe, setItemDetalhe] = useState<AgendaItem | null>(null);

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
                itens={filteredItens.filter((i) => i.data === day.dataISO)}
                artistas={artistas}
                accent={accent}
                onShowClick={setShowSelecionado}
                onItemClick={setItemDetalhe}
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
            const itens = filteredItens.filter((i) => i.data === day.dataISO);
            if (shows.length === 0 && itens.length === 0 && !day.isToday) return null;
            return (
              <MobileDayCard
                key={day.uniqueKey}
                day={day}
                shows={shows}
                itens={itens}
                artistas={artistas}
                accent={accent}
                onShowClick={setShowSelecionado}
                onItemClick={setItemDetalhe}
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
          onNovoEvento={() => {
            const d = novoItemDia;
            setNovoItemDia(null);
            setEventoFormDia(d);
          }}
          onNovoVoo={() => {
            const d = novoItemDia;
            setNovoItemDia(null);
            setVooFormDia(d);
          }}
        />
      )}

      {/* Form de novo evento personalizado */}
      {eventoFormDia && (
        <EventoFormModal
          day={eventoFormDia}
          artistas={artistas}
          defaultArtistIds={selectedDJs.length === 1 ? selectedDJs : []}
          onClose={() => setEventoFormDia(null)}
          onCriar={async (input) => {
            await criarItem(input);
            setEventoFormDia(null);
          }}
        />
      )}

      {/* Form de novo voo */}
      {vooFormDia && (
        <VooFormModal
          day={vooFormDia}
          artistas={artistas}
          defaultArtistIds={selectedDJs.length === 1 ? selectedDJs : []}
          onClose={() => setVooFormDia(null)}
          onCriar={async (input) => {
            await criarItem(input);
            setVooFormDia(null);
          }}
        />
      )}

      {/* Detalhe + excluir item */}
      {itemDetalhe && (
        <ItemDetalheModal
          item={itemDetalhe}
          artistaLabel={labelArtistas(itemDetalhe.artistIds, artistas)}
          onClose={() => setItemDetalhe(null)}
          onExcluir={async () => {
            await removerItem(itemDetalhe.id);
            setItemDetalhe(null);
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
  itens,
  artistas,
  accent,
  onShowClick,
  onItemClick,
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  itens: AgendaItem[];
  artistas: DJ[];
  accent: string;
  onShowClick: (id: string) => void;
  onItemClick: (item: AgendaItem) => void;
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
        {shows.map((show) => (
          <EventCard
            key={show.id}
            show={show}
            dj={artistas.find((d) => d.id === show.djId)}
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
  { key: "voo", label: "Novo Voo", desc: "Voo com passageiros (busca por número)", icon: Plane, cor: "var(--module-agenda)" },
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
    desc: "Reserva o dia ou um horário",
    icon: Calendar,
    cor: "var(--module-contratos)",
  },
];

/** Action-sheet do "+": escolhe o tipo de item a adicionar no dia.
 *  Usa o Modal do app (portal pra document.body) → sempre centralizado na
 *  viewport, sem o bug de `fixed` ancorando no <main> com transform. */
function NovoItemModal({
  day,
  onClose,
  onNovoShow,
  onNovoEvento,
  onNovoVoo,
}: {
  day: DayCell;
  onClose: () => void;
  onNovoShow: () => void;
  onNovoEvento: () => void;
  onNovoVoo: () => void;
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
              onClick={
                a.key === "show"
                  ? onNovoShow
                  : a.key === "evento"
                    ? onNovoEvento
                    : a.key === "voo"
                      ? onNovoVoo
                      : undefined
              }
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

const META_TIPO: Record<AgendaItem["tipo"], { label: string; icon: typeof Music; cor: string }> = {
  evento: { label: "Evento", icon: Calendar, cor: "var(--module-contratos)" },
  voo: { label: "Voo", icon: Plane, cor: "var(--module-agenda)" },
  transporte: { label: "Transporte", icon: Car, cor: "var(--module-financeiro)" },
};

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Nomes dos artistas (juntos) a partir dos ids; undefined se vazio. */
function labelArtistas(ids: string[], artistas: DJ[]): string | undefined {
  if (!ids.length) return undefined;
  const nomes = ids
    .map((id) => artistas.find((a) => a.id === id)?.name)
    .filter(Boolean) as string[];
  return nomes.length ? nomes.join(", ") : undefined;
}

/** Card compacto de um item da agenda (evento/voo/transporte) no dia. */
function AgendaItemCard({
  item,
  artistaLabel,
  onClick,
}: {
  item: AgendaItem;
  artistaLabel?: string;
  onClick: () => void;
}) {
  const t = useT();
  const meta = META_TIPO[item.tipo];
  const Icone = meta.icon;
  const horario = item.diaInteiro
    ? t("Dia inteiro")
    : [item.horaInicio, item.horaFim].filter(Boolean).join("–");
  const sub = [horario, artistaLabel].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left mb-1.5 rounded-md border p-2 transition-colors hover:border-border-strong"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: `color-mix(in srgb, ${meta.cor} 8%, transparent)`,
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Icone size={12} style={{ color: meta.cor, flexShrink: 0 }} />
        <span className="text-xs font-medium text-primary truncate">
          {item.titulo || t(meta.label)}
        </span>
      </div>
      {sub && <div className="text-[0.65rem] text-muted mt-0.5 truncate">{sub}</div>}
    </button>
  );
}

/** Campo rotulado simples pro form. */
function CampoForm({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

/** Seleção múltipla de artistas em chips (cor do DJ quando ativo). Reusado por
 *  Evento (label "Artistas") e Voo (label "Passageiros"). */
function SeletorArtistas({
  artistas,
  value,
  onChange,
  label,
  hintVazio,
}: {
  artistas: DJ[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  hintVazio?: string;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <CampoForm label={label}>
      <div className="flex flex-wrap gap-1.5">
        {artistas.map((a) => {
          const ativo = value.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              className="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
              style={
                ativo
                  ? {
                      borderColor: a.color,
                      backgroundColor: `color-mix(in srgb, ${a.color} 18%, transparent)`,
                      color: a.color,
                    }
                  : { borderColor: "var(--border-color)", color: "var(--text-secondary)" }
              }
            >
              {a.name}
            </button>
          );
        })}
      </div>
      {value.length === 0 && hintVazio && (
        <div className="text-[0.7rem] text-muted mt-1.5">{hintVazio}</div>
      )}
    </CampoForm>
  );
}

/** Form de criação de evento personalizado (Fase 2). */
function EventoFormModal({
  day,
  artistas,
  defaultArtistIds,
  onClose,
  onCriar,
}: {
  day: DayCell;
  artistas: DJ[];
  defaultArtistIds: string[];
  onClose: () => void;
  onCriar: (input: NovoAgendaItem) => Promise<void>;
}) {
  const t = useT();
  const [titulo, setTitulo] = useState("");
  const [artistIds, setArtistIds] = useState<string[]>(defaultArtistIds);
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit() {
    if (salvando) return;
    if (!titulo.trim()) {
      setErro(t("Informe um título."));
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({
        tipo: "evento",
        titulo: titulo.trim(),
        data: day.dataISO,
        diaInteiro,
        horaInicio: diaInteiro ? undefined : horaInicio || undefined,
        horaFim: diaInteiro ? undefined : horaFim || undefined,
        artistIds,
        observacoes: observacoes.trim() || undefined,
      });
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("Novo evento")}
      subtitle={`${t(day.name)} · ${day.date}`}
      maxWidth={440}
    >
      <div className="flex flex-col gap-4">
        <CampoForm label={t("Título")}>
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("Studio, Day Off, Férias…")}
            className="campo-input"
          />
        </CampoForm>

        <SeletorArtistas
          artistas={artistas}
          value={artistIds}
          onChange={setArtistIds}
          label={t("Artistas")}
          hintVazio={t("Nenhum selecionado = vale para todos os artistas")}
        />

        <CampoForm label={t("Quando")}>
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            {[
              { v: true, label: t("Dia inteiro") },
              { v: false, label: t("Definir horário") },
            ].map((op, i) => {
              const ativo = diaInteiro === op.v;
              return (
                <button
                  key={op.label}
                  type="button"
                  onClick={() => setDiaInteiro(op.v)}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    i === 1 ? "border-l border-border" : ""
                  }`}
                  style={
                    ativo
                      ? {
                          color: "var(--module-contratos)",
                          backgroundColor:
                            "color-mix(in srgb, var(--module-contratos) 16%, transparent)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </CampoForm>

        {!diaInteiro && (
          <div className="grid grid-cols-2 gap-3">
            <CampoForm label={t("Início")}>
              <InputHora
                value={horaInicio}
                onChange={setHoraInicio}
                accent="var(--module-contratos)"
              />
            </CampoForm>
            <CampoForm label={t("Fim")}>
              <InputHora
                value={horaFim}
                onChange={setHoraFim}
                accent="var(--module-contratos)"
              />
            </CampoForm>
          </div>
        )}

        <CampoForm label={t("Observações")}>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="campo-input resize-none"
          />
        </CampoForm>

        {erro && <div className="text-xs text-danger">{erro}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">
            {t("Cancelar")}
          </button>
          <button
            onClick={submit}
            disabled={salvando}
            className="btn btn-primary disabled:opacity-50"
            style={{ backgroundColor: "var(--module-contratos)", color: "#fff" }}
          >
            {salvando ? t("Salvando…") : t("Criar evento")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Form de criação de voo (Fase 3) — manual + autofill opcional (AviationStack). */
/** Card de escolha de modo (visual do "Tipo de orçamento"). */
function ModoCard({
  ativo,
  onClick,
  icon: Icone,
  titulo,
  desc,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: typeof Music;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border p-3 transition-colors"
      style={{
        borderColor: ativo ? "var(--module-agenda)" : "var(--border-color)",
        backgroundColor: ativo
          ? "color-mix(in srgb, var(--module-agenda) 10%, transparent)"
          : "transparent",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: "color-mix(in srgb, var(--module-agenda) 16%, transparent)",
            color: "var(--module-agenda)",
          }}
        >
          <Icone size={15} />
        </span>
        <span className="text-sm font-semibold text-primary">{titulo}</span>
      </div>
      <span className="block text-xs text-muted leading-snug">{desc}</span>
    </button>
  );
}

function VooFormModal({
  day,
  artistas,
  defaultArtistIds,
  onClose,
  onCriar,
}: {
  day: DayCell;
  artistas: DJ[];
  defaultArtistIds: string[];
  onClose: () => void;
  onCriar: (input: NovoAgendaItem) => Promise<void>;
}) {
  const t = useT();
  const [modo, setModo] = useState<"manual" | "pdf">("manual");

  // Form (usado pelo manual E pelo PDF de 1 voo)
  const [dataVoo, setDataVoo] = useState(day.dataISO);
  const [numeroVoo, setNumeroVoo] = useState("");
  const [companhia, setCompanhia] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [partida, setPartida] = useState("");
  const [chegada, setChegada] = useState("");
  const [localizador, setLocalizador] = useState("");
  const [passageiros, setPassageiros] = useState<string[]>(defaultArtistIds);
  const [pdfPassageiros, setPdfPassageiros] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // PDF
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [lendoPdf, setLendoPdf] = useState(false);
  const [pdfMulti, setPdfMulti] = useState<VooExtraido[] | null>(null);
  const [pdfOk, setPdfOk] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);

  function aplicarVoo(v: VooExtraido) {
    if (v.data) setDataVoo(v.data);
    setNumeroVoo(v.numeroVoo ?? "");
    setCompanhia(v.companhia ?? "");
    setOrigem(v.origem ?? "");
    setDestino(v.destino ?? "");
    setPartida(v.partida ?? "");
    setChegada(v.chegada ?? "");
    setLocalizador(v.localizador ?? "");
    setPdfPassageiros(v.passageiros ?? []);
  }

  async function escolherPdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setPdfMulti(null);
    setPdfOk(false);
    setPdfMsg(null);
    setLendoPdf(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/voos/importar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64 }),
      });
      const body = await res.json();
      if (Array.isArray(body.voos)) {
        const achados = body.voos as VooExtraido[];
        if (achados.length === 0) setPdfMsg(t("Nenhum voo encontrado nesse PDF."));
        else if (achados.length === 1) {
          aplicarVoo(achados[0]);
          setPdfOk(true);
        } else setPdfMulti(achados);
      } else if (body.indisponivel) {
        setPdfMsg(
          t("Importação por IA indisponível — configure a chave Anthropic no servidor.")
        );
      } else {
        setPdfMsg(body.erro ?? t("Não consegui ler esse voucher."));
      }
    } catch {
      setPdfMsg(t("Não consegui ler esse voucher."));
    } finally {
      setLendoPdf(false);
    }
  }

  async function buscar() {
    const f = numeroVoo.trim();
    if (!f || buscando) return;
    setBuscando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/voos/lookup?flight=${encodeURIComponent(f)}`, {
        credentials: "include",
      });
      const body = await res.json();
      if (body.voo) {
        const v = body.voo;
        if (v.companhia) setCompanhia(v.companhia);
        if (v.origem) setOrigem(v.origem);
        if (v.destino) setDestino(v.destino);
        if (v.partida) setPartida(v.partida);
        if (v.chegada) setChegada(v.chegada);
        setAviso(t("Dados do voo de hoje aplicados — confira data e horário."));
      } else if (body.indisponivel) {
        setAviso(t("Busca automática indisponível (sem chave). Preencha manualmente."));
      } else if (body.naoEncontrado) {
        setAviso(t("Voo não encontrado hoje. Preencha manualmente."));
      } else {
        setAviso(body.erro ?? t("Não foi possível buscar agora."));
      }
    } catch {
      setAviso(t("Não foi possível buscar agora."));
    } finally {
      setBuscando(false);
    }
  }

  async function submitUm() {
    if (salvando) return;
    if (!numeroVoo.trim() && !origem.trim() && !destino.trim()) {
      setErro(t("Informe ao menos o número do voo ou a rota."));
      return;
    }
    setSalvando(true);
    setErro(null);
    const rota = origem && destino ? `${origem.toUpperCase()}→${destino.toUpperCase()}` : "";
    const titulo =
      [numeroVoo.trim().toUpperCase(), rota].filter(Boolean).join(" · ") || t("Voo");
    try {
      await onCriar({
        tipo: "voo",
        titulo,
        data: dataVoo,
        diaInteiro: false,
        horaInicio: partida || undefined,
        horaFim: chegada || undefined,
        artistIds: passageiros,
        observacoes: observacoes.trim() || undefined,
        dados: {
          numeroVoo: numeroVoo.trim().toUpperCase(),
          companhia: companhia.trim(),
          origem: origem.trim().toUpperCase(),
          destino: destino.trim().toUpperCase(),
          partida,
          chegada,
          localizador: localizador.trim(),
          passageiros: pdfPassageiros.join(", "),
        },
      });
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  async function submitTodos() {
    if (!pdfMulti || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      for (const v of pdfMulti.filter((x) => x.data)) {
        const rota = v.origem && v.destino ? `${v.origem}→${v.destino}` : "";
        const titulo = [v.numeroVoo, rota].filter(Boolean).join(" · ") || t("Voo");
        await onCriar({
          tipo: "voo",
          titulo,
          data: v.data as string,
          diaInteiro: false,
          horaInicio: v.partida || undefined,
          horaFim: v.chegada || undefined,
          artistIds: [],
          dados: {
            numeroVoo: v.numeroVoo ?? "",
            companhia: v.companhia ?? "",
            origem: v.origem ?? "",
            destino: v.destino ?? "",
            partida: v.partida ?? "",
            chegada: v.chegada ?? "",
            localizador: v.localizador ?? "",
            passageiros: (v.passageiros ?? []).join(", "),
          },
        });
      }
      onClose();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  const multiValidos = (pdfMulti ?? []).filter((v) => v.data);
  const mostrarForm = modo === "manual" || (modo === "pdf" && pdfOk);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("Novo voo")}
      subtitle={`${t(day.name)} · ${day.date}`}
      maxWidth={480}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <ModoCard
            ativo={modo === "manual"}
            onClick={() => setModo("manual")}
            icon={Pencil}
            titulo={t("Preencher manual")}
            desc={t("Digitar os dados do voo na mão.")}
          />
          <ModoCard
            ativo={modo === "pdf"}
            onClick={() => setModo("pdf")}
            icon={FileUp}
            titulo={t("Ler de um PDF")}
            desc={t("Sobe o voucher e preenche sozinho.")}
          />
        </div>

        {modo === "pdf" && (
          <>
            <label className="flex flex-col items-center justify-center gap-1.5 h-20 border border-dashed border-border rounded-md cursor-pointer text-sm text-muted hover:border-border-strong hover:text-secondary transition-colors">
              <FileUp size={18} />
              <span className="truncate max-w-full px-3">
                {nomeArquivo || t("Escolher PDF do voucher")}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={escolherPdf}
              />
            </label>
            {lendoPdf && <div className="text-sm text-muted">{t("Lendo o voucher…")}</div>}
            {pdfMsg && <div className="text-xs text-secondary">{pdfMsg}</div>}
          </>
        )}

        {modo === "pdf" && pdfMulti && (
          <div className="flex flex-col gap-2">
            <div className="stat-label">{t("Voos encontrados")}</div>
            {pdfMulti.map((v, i) => (
              <div key={i} className="rounded-md border border-border p-2.5">
                <div className="text-sm font-medium text-primary">
                  {[v.numeroVoo, v.origem && v.destino ? `${v.origem}→${v.destino}` : ""]
                    .filter(Boolean)
                    .join(" · ") || t("Voo")}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {[
                    v.companhia,
                    v.data ? formatarDataBR(v.data) : "⚠ " + t("sem data"),
                    [v.partida, v.chegada].filter(Boolean).join("–"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {(v.passageiros?.length ?? 0) > 0 && (
                  <div className="text-xs text-muted mt-0.5">{v.passageiros!.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {mostrarForm && (
          <>
            <CampoForm label={t("Número do voo")}>
              {modo === "manual" ? (
                <div className="flex gap-2">
                  <input
                    value={numeroVoo}
                    onChange={(e) => setNumeroVoo(e.target.value)}
                    placeholder="LA3477"
                    className="campo-input flex-1 uppercase placeholder:normal-case"
                  />
                  <button
                    type="button"
                    onClick={buscar}
                    disabled={buscando || !numeroVoo.trim()}
                    className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Search size={14} />
                    {buscando ? t("Buscando…") : t("Buscar")}
                  </button>
                </div>
              ) : (
                <input
                  value={numeroVoo}
                  onChange={(e) => setNumeroVoo(e.target.value)}
                  className="campo-input uppercase placeholder:normal-case"
                />
              )}
              {aviso && <div className="text-[0.7rem] text-muted mt-1.5">{aviso}</div>}
            </CampoForm>

            <div className="grid grid-cols-2 gap-3">
              <CampoForm label={t("Data")}>
                <input
                  type="date"
                  value={dataVoo}
                  onChange={(e) => setDataVoo(e.target.value)}
                  className="campo-input"
                />
              </CampoForm>
              <CampoForm label={t("Companhia")}>
                <input
                  value={companhia}
                  onChange={(e) => setCompanhia(e.target.value)}
                  className="campo-input"
                />
              </CampoForm>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CampoForm label={t("Origem")}>
                <input
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="GRU"
                  className="campo-input uppercase placeholder:normal-case"
                />
              </CampoForm>
              <CampoForm label={t("Destino")}>
                <input
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  placeholder="SCL"
                  className="campo-input uppercase placeholder:normal-case"
                />
              </CampoForm>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CampoForm label={t("Partida")}>
                <InputHora value={partida} onChange={setPartida} accent="var(--module-agenda)" />
              </CampoForm>
              <CampoForm label={t("Chegada")}>
                <InputHora value={chegada} onChange={setChegada} accent="var(--module-agenda)" />
              </CampoForm>
            </div>

            <CampoForm label={t("Localizador (PNR)")}>
              <input
                value={localizador}
                onChange={(e) => setLocalizador(e.target.value)}
                placeholder="ABC123"
                className="campo-input uppercase placeholder:normal-case"
              />
            </CampoForm>

            <SeletorArtistas
              artistas={artistas}
              value={passageiros}
              onChange={setPassageiros}
              label={t("Passageiros")}
            />
            {pdfPassageiros.length > 0 && (
              <div className="text-[0.7rem] text-muted -mt-2">
                {t("Do voucher")}: {pdfPassageiros.join(", ")}
              </div>
            )}

            <CampoForm label={t("Observações")}>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="campo-input resize-none"
              />
            </CampoForm>
          </>
        )}

        {erro && <div className="text-xs text-danger">{erro}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">
            {t("Cancelar")}
          </button>
          {modo === "pdf" && pdfMulti
            ? multiValidos.length > 0 && (
                <button
                  onClick={submitTodos}
                  disabled={salvando}
                  className="btn btn-primary disabled:opacity-50"
                  style={{ backgroundColor: "var(--module-agenda)", color: "#fff" }}
                >
                  {salvando ? t("Adicionando…") : t("Adicionar à agenda")}
                </button>
              )
            : mostrarForm && (
                <button
                  onClick={submitUm}
                  disabled={salvando}
                  className="btn btn-primary disabled:opacity-50"
                  style={{ backgroundColor: "var(--module-agenda)", color: "#fff" }}
                >
                  {salvando ? t("Salvando…") : t("Criar voo")}
                </button>
              )}
        </div>
      </div>
    </Modal>
  );
}

type VooExtraido = {
  numeroVoo?: string;
  companhia?: string;
  data?: string;
  origem?: string;
  destino?: string;
  partida?: string;
  chegada?: string;
  localizador?: string;
  passageiros?: string[];
};

/** Linha rótulo/valor pro detalhe. */
function LinhaDetalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted flex-shrink-0">{rotulo}</span>
      <span className="text-primary text-right">{valor}</span>
    </div>
  );
}

/** Linhas específicas de um voo (a partir do `dados` do item). */
function DetalheVoo({ dados }: { dados?: Record<string, unknown> }) {
  const t = useT();
  const d = (dados ?? {}) as Record<string, string>;
  const rota = d.origem && d.destino ? `${d.origem}→${d.destino}` : "";
  return (
    <>
      {d.companhia && <LinhaDetalhe rotulo={t("Companhia")} valor={d.companhia} />}
      {rota && <LinhaDetalhe rotulo={t("Rota")} valor={rota} />}
      {d.localizador && <LinhaDetalhe rotulo={t("Localizador (PNR)")} valor={d.localizador} />}
      {d.passageiros && <LinhaDetalhe rotulo={t("Passageiros")} valor={d.passageiros} />}
    </>
  );
}

/** Detalhe de um item + excluir (Fase 2: sem edição). */
function ItemDetalheModal({
  item,
  artistaLabel,
  onClose,
  onExcluir,
}: {
  item: AgendaItem;
  artistaLabel?: string;
  onClose: () => void;
  onExcluir: () => Promise<void>;
}) {
  const t = useT();
  const [excluindo, setExcluindo] = useState(false);
  const meta = META_TIPO[item.tipo];
  const horario = item.diaInteiro
    ? t("Dia inteiro")
    : [item.horaInicio, item.horaFim].filter(Boolean).join(" – ") || "—";

  async function excluir() {
    if (excluindo) return;
    setExcluindo(true);
    try {
      await onExcluir();
    } catch {
      setExcluindo(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item.titulo || t(meta.label)}
      subtitle={t(meta.label)}
      maxWidth={400}
    >
      <div className="flex flex-col gap-3">
        <LinhaDetalhe rotulo={t("Quando")} valor={`${formatarDataBR(item.data)} · ${horario}`} />
        {item.tipo === "voo" && <DetalheVoo dados={item.dados} />}
        {artistaLabel && (
          <LinhaDetalhe
            rotulo={item.tipo === "voo" ? t("Passageiros") : t("Artistas")}
            valor={artistaLabel}
          />
        )}
        {item.observacoes && <LinhaDetalhe rotulo={t("Observações")} valor={item.observacoes} />}
        <div className="flex justify-end pt-2">
          <button
            onClick={excluir}
            disabled={excluindo}
            className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ color: "var(--danger)" }}
          >
            <Trash2 size={14} />
            {excluindo ? t("Excluindo…") : t("Excluir")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MobileDayCard({
  day,
  shows,
  itens,
  artistas,
  accent,
  onShowClick,
  onItemClick,
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  itens: AgendaItem[];
  artistas: DJ[];
  accent: string;
  onShowClick: (id: string) => void;
  onItemClick: (item: AgendaItem) => void;
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
      {shows.map((show) => (
        <EventCard
          key={show.id}
          show={show}
          dj={artistas.find((d) => d.id === show.djId)}
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
