"use client";

import { useEffect, useMemo, useState, useRef, type ReactNode, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { MapPin, Clock, Music, Calendar, Plus, Plane, Car, Trash2, Search, FileUp, Pencil, X, Check, Download, ArrowLeft, FileSignature } from "lucide-react";
import DateRangeSelector from "./DateRangeSelector";
import PageHeader from "./PageHeader";
import { useShows } from "@/lib/shows-context";
import { useAgendaItems, type NovoAgendaItem } from "@/lib/agenda-items-context";
import { useWorkspace, useArtistas } from "@/lib/workspace-context";
import { setFeriados, ehFeriado, ehVesperaDeFeriado } from "@/lib/feriados";
import { MODULE_THEMES } from "@/types";
import type { AgendaDateRange, Show, ShowStatus, Artista, AgendaItem } from "@/types";
import ShowDetalheModal from "./ShowDetalheModal";
import Modal from "./Modal";
import InputHora from "./inputs/InputHora";
import InputDataBR from "./inputs/InputDataBR";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { podeCriarShowUI } from "@/lib/permissoes/gatesShow";
import { useContratos } from "@/lib/contratos-context";
import { resumoContratoDoShow, rotuloContratoShow } from "@/lib/contratoDoShow";
import { showNoDia } from "@/lib/agenda/showNoDia";

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

/** ISO "YYYY-MM-DD" de hoje (fuso local do browser). */
function isoHoje(): string {
  const now = new Date();
  return isoDia(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * DayCell SINTÉTICO a partir de um ISO escolhido — reusa os mesmos helpers
 * do grid (DAY_NAMES/ALL_MONTHS) pro fluxo do "+" mobile poder criar item em
 * QUALQUER dia. `isQuente` fica false (cosmético; feriados só carregam pro
 * período em visualização). Retorna null se o ISO for inválido.
 */
function cellDeISO(iso: string): DayCell | null {
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

function EventCard({ show, artista, onClick }: { show: Show; artista?: Artista; onClick?: () => void }) {
  const t = useT();
  const { contratos, assinantesPorContrato } = useContratos();
  const cancelado = show.status === "cancelado";
  const rcontrato = resumoContratoDoShow(show.vendaId, contratos, assinantesPorContrato);
  const rotContrato = rotuloContratoShow(rcontrato, t);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-surface-2 border border-border rounded-md p-2.5 mb-2 transition-all hover:border-border-strong hover:bg-elevated cursor-pointer ${
        cancelado ? "opacity-60" : ""
      }`}
      style={{
        borderLeft: `3px solid ${cancelado ? "var(--danger)" : artista ? artista.color : "transparent"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={`text-xs font-bold text-primary truncate ${
            cancelado ? "line-through" : ""
          }`}
        >
          {show.artistaNome}
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
          {show.time ? (
            <span className="font-semibold text-primary tabular-nums">{show.time}</span>
          ) : (
            <span className="font-medium text-warning">{t("A definir")}</span>
          )}
        </div>
      </div>

      {show.vendaId && (
        <div className="mt-2">
          <span className={`badge ${rotContrato.badgeClass} inline-flex items-center gap-1`}>
            <FileSignature size={10} />
            {rotContrato.texto}
          </span>
        </div>
      )}
    </button>
  );
}

type Props = {
  selectedArtistas: string[];
  onAbrirOrcamento?: (id: string) => void;
  onAbrirVenda?: (id: string) => void;
  /** "Novo Show" no "+" de um dia → abre Nova Venda Direta com a data. */
  onNovaVendaNoDia?: (dataISO: string) => void;
};

export default function AgendaEscala({ selectedArtistas, onAbrirOrcamento, onAbrirVenda, onNovaVendaNoDia }: Props) {
  const t = useT();
  const { shows, recarregar: recarregarShows } = useShows();
  const { workspaceCriadoEm } = useWorkspace();
  // Chegou na Agenda = refetch (I7) — ver AgendaDashboard.
  useEffect(() => {
    void recarregarShows();
  }, [recarregarShows]);
  const artistas = useArtistas();
  const { podeUI } = useAuth();
  // L5c — DUAS chaves distintas alimentam o "+":
  //   podeCriarAlgum  → agenda.criar: voo, transporte terrestre e evento.
  //   podeCriarShow   → vendas.criar_venda: "Novo Show" (agenda virou só
  //                     visualização; criar show é permissão de VENDAS).
  // O "+" aparece se ele pode criar QUALQUER uma das duas coisas — senão quem
  // só tem vendas.criar_venda ficaria sem botão nenhum.
  const podeCriarAlgum = artistas.some((a) => podeUI(a.id, "agenda.criar"));
  const podeCriarShow = artistas.some((a) => podeCriarShowUI(podeUI, a.id));
  const podeAbrirNovoItem = podeCriarAlgum || podeCriarShow;
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

  const filteredShows = shows.filter((show) => selectedArtistas.includes(show.artistaId));
  const { itens: agendaItens, criar: criarItem, editar: editarItem, remover: removerItem } =
    useAgendaItems();
  // Itens visíveis: gerais (sem artista) sempre; com artista, filtra pelo artista.
  const filteredItens = agendaItens.filter(
    (i) => i.artistIds.length === 0 || i.artistIds.some((id) => selectedArtistas.includes(id))
  );
  const [novoItemDia, setNovoItemDia] = useState<DayCell | null>(null);
  const [eventoFormDia, setEventoFormDia] = useState<DayCell | null>(null);
  const [vooFormDia, setVooFormDia] = useState<DayCell | null>(null);
  const [transporteFormDia, setTransporteFormDia] = useState<DayCell | null>(null);
  const [itemDetalhe, setItemDetalhe] = useState<AgendaItem | null>(null);
  const [editandoItem, setEditandoItem] = useState<AgendaItem | null>(null);
  // FAB mobile: seletor "Para qual data?" antes de cair no NovoItemModal.
  const [fabDataAberto, setFabDataAberto] = useState(false);
  const [fabDataISO, setFabDataISO] = useState("");

  // Dias planos para listagem mobile
  const allDays = monthWeeks.flat();

  // Meses que a grade renderiza com células PRÓPRIAS ("YYYY-MM"). Um show só
  // é escondido de uma célula de padding se o mês dele já tiver lugar aqui —
  // ver `showNoDia`. Derivado da grade em si, não da lógica que a montou.
  const mesesNaGrade = useMemo(
    () =>
      new Set(
        allDays
          .filter((d) => !d.isOtherMonth && d.dataISO)
          .map((d) => d.dataISO.slice(0, 7))
      ),
    [allDays]
  );

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
                shows={filteredShows.filter((s) => showNoDia(s, day, mesesNaGrade))}
                itens={filteredItens.filter((i) => i.data === day.dataISO)}
                artistas={artistas}
                accent={accent}
                podeAbrirNovoItem={podeAbrirNovoItem}
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
                podeAbrirNovoItem={podeAbrirNovoItem}
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

      {/* FAB mobile: cria item em QUALQUER data (a lista mobile só mostra dias
          com conteúdo + hoje, então sem isto só dava pra criar em hoje). */}
      <FabNovoDia
        podeCriar={podeAbrirNovoItem}
        onClick={() => {
          setFabDataISO(isoHoje());
          setFabDataAberto(true);
        }}
      />

      {/* Passo "Para qual data?" — vira DayCell sintético e cai no NovoItemModal */}
      {fabDataAberto && (
        <Modal
          isOpen
          onClose={() => setFabDataAberto(false)}
          title={t("Novo item na agenda")}
          subtitle={t("Para qual data?")}
          maxWidth={360}
        >
          <div className="flex flex-col gap-4">
            <CampoForm label={t("Data")}>
              <InputDataBR
                value={fabDataISO}
                onChange={setFabDataISO}
                className="w-full"
                autoFocus
              />
            </CampoForm>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setFabDataAberto(false)} className="btn btn-secondary">
                {t("Cancelar")}
              </button>
              <button
                onClick={() => {
                  const cell = cellDeISO(fabDataISO);
                  if (!cell) return;
                  setFabDataAberto(false);
                  setNovoItemDia(cell);
                }}
                disabled={!/^\d{4}-\d{2}-\d{2}$/.test(fabDataISO)}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--brand)", color: "#fff" }}
              >
                {t("Continuar")}
              </button>
            </div>
          </div>
        </Modal>
      )}

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
          podeCriarItem={podeCriarAlgum}
          podeCriarShow={podeCriarShow}
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
          onNovoTransporte={() => {
            const d = novoItemDia;
            setNovoItemDia(null);
            setTransporteFormDia(d);
          }}
        />
      )}

      {/* Form de novo evento personalizado */}
      {eventoFormDia && (
        <EventoFormModal
          day={eventoFormDia}
          artistas={artistas}
          defaultArtistIds={selectedArtistas.length === 1 ? selectedArtistas : []}
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
          defaultArtistIds={selectedArtistas.length === 1 ? selectedArtistas : []}
          onClose={() => setVooFormDia(null)}
          onCriar={async (input) => {
            await criarItem(input);
            setVooFormDia(null);
          }}
        />
      )}

      {/* Form de novo transporte terrestre */}
      {transporteFormDia && (
        <TransporteFormModal
          day={transporteFormDia}
          artistas={artistas}
          defaultArtistIds={selectedArtistas.length === 1 ? selectedArtistas : []}
          onClose={() => setTransporteFormDia(null)}
          onCriar={async (input) => {
            await criarItem(input);
            setTransporteFormDia(null);
          }}
        />
      )}

      {/* Edição de item (reusa os forms em modo edição) */}
      {editandoItem && (
        <>
          {editandoItem.tipo === "evento" && (
            <EventoFormModal
              itemEditar={editandoItem}
              artistas={artistas}
              defaultArtistIds={editandoItem.artistIds}
              onClose={() => setEditandoItem(null)}
              onCriar={async (input) => {
                await editarItem(editandoItem.id, input);
                setEditandoItem(null);
              }}
            />
          )}
          {editandoItem.tipo === "voo" && (
            <VooFormModal
              itemEditar={editandoItem}
              artistas={artistas}
              defaultArtistIds={editandoItem.artistIds}
              onClose={() => setEditandoItem(null)}
              onCriar={async (input) => {
                await editarItem(editandoItem.id, input);
                setEditandoItem(null);
              }}
            />
          )}
          {editandoItem.tipo === "transporte" && (
            <TransporteFormModal
              itemEditar={editandoItem}
              artistas={artistas}
              defaultArtistIds={editandoItem.artistIds}
              onClose={() => setEditandoItem(null)}
              onCriar={async (input) => {
                await editarItem(editandoItem.id, input);
                setEditandoItem(null);
              }}
            />
          )}
        </>
      )}

      {/* Detalhe + excluir item */}
      {itemDetalhe && (
        <ItemDetalheModal
          item={itemDetalhe}
          artistasDoItem={artistas.filter((a) => itemDetalhe.artistIds.includes(a.id))}
          podeUI={podeUI}
          onClose={() => setItemDetalhe(null)}
          onEditar={() => {
            setEditandoItem(itemDetalhe);
            setItemDetalhe(null);
          }}
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
  podeAbrirNovoItem,
  onShowClick,
  onItemClick,
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  itens: AgendaItem[];
  artistas: Artista[];
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
      id={day.isToday ? "day-card-today" : undefined}
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

      <div className="flex-1 overflow-y-auto -mr-1 pr-1">
        {shows.map((show) => (
          <EventCard
            key={show.id}
            show={show}
            artista={artistas.find((d) => d.id === show.artistaId)}
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

function DayCellEmptySlot() {
  const t = useT();
  return (
    <div className="flex items-center justify-center h-20 border border-dashed border-border rounded-md text-[0.7rem] text-muted">
      {t("Sem shows")}
    </div>
  );
}

/** Retângulo pontilhado com "+" — sempre o último item da coluna do dia. */
function NovoItemSlot({ onClick, podeCriar = true }: { onClick: () => void; podeCriar?: boolean }) {
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
function FabNovoDia({ onClick, podeCriar }: { onClick: () => void; podeCriar: boolean }) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !podeCriar) return null;
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Novo item na agenda")}
      className="md:hidden fixed bottom-5 right-5 z-30 h-14 w-14 rounded-full flex items-center justify-center text-white transition-transform active:scale-95"
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

const ACOES_NOVO_ITEM: {
  key: string;
  label: string;
  desc: string;
  icon: typeof Music;
  cor: string;
  emBreve?: boolean;
}[] = [
  { key: "show", label: "Novo Show", desc: "Venda direta neste dia", icon: Music, cor: "var(--brand)" },
  { key: "voo", label: "Novo Voo", desc: "Voo com passageiros (busca por número)", icon: Plane, cor: "var(--brand)" },
  {
    key: "transporte",
    label: "Novo Transporte Terrestre",
    desc: "Transfer/van com motorista",
    icon: Car,
    cor: "var(--brand)",
  },
  {
    key: "evento",
    label: "Novo Evento Personalizado",
    desc: "Reserva o dia ou um horário",
    icon: Calendar,
    cor: "var(--brand)",
  },
];

/** Action-sheet do "+": escolhe o tipo de item a adicionar no dia.
 *  Usa o Modal do app (portal pra document.body) → sempre centralizado na
 *  viewport, sem o bug de `fixed` ancorando no <main> com transform. */
function NovoItemModal({
  day,
  podeCriarItem,
  podeCriarShow,
  onClose,
  onNovoShow,
  onNovoEvento,
  onNovoVoo,
  onNovoTransporte,
}: {
  day: DayCell;
  /** agenda.criar — voo, transporte terrestre e evento personalizado. */
  podeCriarItem: boolean;
  /** vendas.criar_venda — "Novo Show" (não é mais permissão de agenda). */
  podeCriarShow: boolean;
  onClose: () => void;
  onNovoShow: () => void;
  onNovoEvento: () => void;
  onNovoVoo: () => void;
  onNovoTransporte: () => void;
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
        {ACOES_NOVO_ITEM.filter((a) =>
          // L5c — gate POR CHAVE, não um só pra todos:
          //   voo/transporte/evento → agenda.criar (item de agenda);
          //   show                  → vendas.criar_venda (abre a Nova Venda
          //                           Direta; agenda.criar NÃO serve mais).
          // ESCONDE, não desabilita: o dono pediu que "Novo Show" só APAREÇA
          // pra quem tem vendas.criar_venda. Diverge do grey-out usado no resto
          // do app de propósito — aqui o pedido foi literal, e um item cinza
          // vaza a existência da ação pra quem não pode executá-la.
          a.key === "show" ? podeCriarShow : podeCriarItem
        ).map((a) => {
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
                      : a.key === "transporte"
                        ? onNovoTransporte
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
  evento: { label: "Evento", icon: Calendar, cor: "var(--brand)" },
  voo: { label: "Voo", icon: Plane, cor: "var(--brand)" },
  transporte: { label: "Transporte", icon: Car, cor: "var(--brand)" },
};

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Nomes dos artistas (juntos) a partir dos ids; undefined se vazio. */
function labelArtistas(ids: string[], artistas: Artista[]): string | undefined {
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

/** Seleção múltipla de artistas em chips (cor do artista quando ativo). Reusado por
 *  Evento (label "Artistas") e Voo (label "Passageiros"). */
function SeletorArtistas({
  artistas,
  value,
  onChange,
  label,
  hintVazio,
}: {
  artistas: Artista[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  hintVazio?: string;
}) {
  const t = useT();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [aberto]);
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const selecionados = artistas.filter((a) => value.includes(a.id));
  const q = busca.trim().toLowerCase();
  const filtrados = q ? artistas.filter((a) => a.name.toLowerCase().includes(q)) : artistas;
  return (
    <CampoForm label={label}>
      <div className="relative" ref={ref}>
        {selecionados.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selecionados.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
                style={{
                  borderColor: a.color,
                  backgroundColor: `color-mix(in srgb, ${a.color} 16%, transparent)`,
                  color: a.color,
                }}
              >
                {a.name}
                <button type="button" onClick={() => toggle(a.id)} aria-label={t("Remover")}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder={t("Buscar artista…")}
          className="campo-input w-full"
        />
        {aberto && (
          <div
            className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-surface border border-border rounded-lg"
            style={{ boxShadow: "0 12px 30px var(--shadow-color)" }}
          >
            {filtrados.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted">{t("Nenhum artista")}</div>
            ) : (
              filtrados.map((a) => {
                const ativo = value.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-elevated transition-colors"
                  >
                    <span
                      className="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: ativo ? a.color : "var(--border-strong)",
                        backgroundColor: ativo ? a.color : "transparent",
                      }}
                    >
                      {ativo && <Check size={11} color="#fff" />}
                    </span>
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: a.color }}
                    />
                    <span className="text-primary truncate">{a.name}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {value.length === 0 && hintVazio && (
        <div className="text-[0.7rem] text-muted mt-1.5">{hintVazio}</div>
      )}
    </CampoForm>
  );
}

/** Passo 1 dos forms de item: "pra qual artista?" antes do formulário. */
function PassoArtista({
  artistas,
  value,
  onChange,
  onCancelar,
  onContinuar,
  cor,
}: {
  artistas: Artista[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCancelar: () => void;
  onContinuar: () => void;
  cor: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <SeletorArtistas
        artistas={artistas}
        value={value}
        onChange={onChange}
        label={t("Para qual artista?")}
        hintVazio={t("Nenhum selecionado = vale para todos os artistas")}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancelar} className="btn btn-secondary">
          {t("Cancelar")}
        </button>
        <button
          onClick={onContinuar}
          className="btn btn-primary"
          style={{ backgroundColor: cor, color: "#fff" }}
        >
          {t("Continuar")}
        </button>
      </div>
    </div>
  );
}

/** Cabeçalho da etapa 2: mostra pra quem é o item + volta pra trocar o artista. */
function VoltarArtista({
  artistas,
  ids,
  onVoltar,
}: {
  artistas: Artista[];
  ids: string[];
  onVoltar: () => void;
}) {
  const t = useT();
  const resumo = labelArtistas(ids, artistas) ?? t("Todos os artistas");
  return (
    <button
      type="button"
      onClick={onVoltar}
      className="self-start inline-flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors"
    >
      <ArrowLeft size={14} />
      <span className="truncate max-w-[16rem]">{resumo}</span>
    </button>
  );
}

type Passageiro = {
  nome: string;
  nascimento?: string;
  bagagemExtra?: boolean;
};

/** Passageiros guardados (array de objeto OU string) → array do form. */
function passageirosDe(item?: AgendaItem): Passageiro[] {
  const arr = item?.dados?.passageiros;
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => (typeof p === "string" ? { nome: p } : (p as Passageiro)));
}

/** Lista repetível de passageiros (nome obrigatório; nascimento/bagagem opcionais). */
function PassageirosField({
  value,
  onChange,
}: {
  value: Passageiro[];
  onChange: (p: Passageiro[]) => void;
}) {
  const t = useT();
  const setP = (i: number, patch: Partial<Passageiro>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  return (
    <CampoForm label={t("Passageiros")}>
      <div className="flex flex-col gap-2">
        {value.map((p, i) => (
          <div key={i} className="rounded-md border border-border p-2.5 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input
                value={p.nome}
                onChange={(e) => setP(i, { nome: e.target.value })}
                placeholder={t("Nome completo")}
                className="campo-input flex-1"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-muted hover:text-danger p-1"
                aria-label={t("Remover")}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-stretch gap-2">
              <InputDataBR
                value={p.nascimento ?? ""}
                onChange={(iso) => setP(i, { nascimento: iso })}
                className="flex-1"
                title={t("Nascimento")}
                aria-label={t("Nascimento")}
              />
              <button
                type="button"
                onClick={() => setP(i, { bagagemExtra: !p.bagagemExtra })}
                aria-pressed={!!p.bagagemExtra}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
                style={
                  p.bagagemExtra
                    ? {
                        color: "var(--brand)",
                        borderColor: "color-mix(in srgb, var(--brand) 45%, transparent)",
                        backgroundColor:
                          "color-mix(in srgb, var(--brand) 16%, transparent)",
                      }
                    : { color: "var(--text-muted)", borderColor: "var(--border-color)" }
                }
              >
                <Check size={13} style={{ opacity: p.bagagemExtra ? 1 : 0.35 }} />
                {t("Bagagem extra")}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, { nome: "" }])}
          className="flex items-center justify-center gap-1.5 h-9 border border-dashed border-border rounded-md text-sm text-muted hover:text-secondary hover:border-border-strong transition-colors"
        >
          <Plus size={14} /> {t("Adicionar passageiro")}
        </button>
      </div>
    </CampoForm>
  );
}

/** "HH:mm" partida/chegada → duração "3h15" (naive; +24h se chegada no dia seguinte). */
function calcularDuracao(partida: string, chegada: string): string {
  const p = /^(\d{2}):(\d{2})$/.exec(partida);
  const c = /^(\d{2}):(\d{2})$/.exec(chegada);
  if (!p || !c) return "";
  let min =
    parseInt(c[1], 10) * 60 + parseInt(c[2], 10) - (parseInt(p[1], 10) * 60 + parseInt(p[2], 10));
  if (min < 0) min += 24 * 60;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Form de criação de evento personalizado (Fase 2). */
function EventoFormModal({
  day,
  artistas,
  defaultArtistIds,
  itemEditar,
  onClose,
  onCriar,
}: {
  day?: DayCell;
  artistas: Artista[];
  defaultArtistIds: string[];
  itemEditar?: AgendaItem;
  onClose: () => void;
  onCriar: (input: NovoAgendaItem) => Promise<void>;
}) {
  const t = useT();
  const editando = !!itemEditar;
  const subtitulo = itemEditar
    ? formatarDataBR(itemEditar.data)
    : day
      ? `${t(day.name)} · ${day.date}`
      : "";
  const [dataEvento, setDataEvento] = useState(itemEditar?.data ?? day?.dataISO ?? "");
  const [titulo, setTitulo] = useState(itemEditar?.titulo ?? "");
  const [artistIds, setArtistIds] = useState<string[]>(itemEditar?.artistIds ?? defaultArtistIds);
  const [diaInteiro, setDiaInteiro] = useState(itemEditar ? itemEditar.diaInteiro : true);
  const [horaInicio, setHoraInicio] = useState(itemEditar?.horaInicio ?? "");
  const [horaFim, setHoraFim] = useState(itemEditar?.horaFim ?? "");
  const [observacoes, setObservacoes] = useState(itemEditar?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<1 | 2>(itemEditar ? 2 : 1);

  async function submit() {
    if (salvando) return;
    if (!titulo.trim()) {
      setErro(t("Informe um título."));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEvento)) {
      setErro(t("Informe a data."));
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({
        tipo: "evento",
        titulo: titulo.trim(),
        data: dataEvento,
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
      title={editando ? t("Editar evento") : t("Novo evento")}
      subtitle={subtitulo}
      maxWidth={440}
    >
      {etapa === 1 ? (
        <PassoArtista
          artistas={artistas}
          value={artistIds}
          onChange={setArtistIds}
          onCancelar={onClose}
          onContinuar={() => setEtapa(2)}
          cor="var(--brand)"
        />
      ) : (
      <div className="flex flex-col gap-4">
        <VoltarArtista artistas={artistas} ids={artistIds} onVoltar={() => setEtapa(1)} />
        <CampoForm label={t("Título")}>
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("Studio, Day Off, Férias…")}
            className="campo-input"
          />
        </CampoForm>

        <CampoForm label={t("Data")}>
          <InputDataBR
            value={dataEvento}
            onChange={setDataEvento}
            className="w-full"
          />
        </CampoForm>

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
                          color: "var(--brand)",
                          backgroundColor:
                            "color-mix(in srgb, var(--brand) 16%, transparent)",
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
                accent="var(--brand)"
              />
            </CampoForm>
            <CampoForm label={t("Fim")}>
              <InputHora
                value={horaFim}
                onChange={setHoraFim}
                accent="var(--brand)"
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
            style={{ backgroundColor: "var(--brand)", color: "#fff" }}
          >
            {salvando ? t("Salvando…") : editando ? t("Salvar alterações") : t("Criar evento")}
          </button>
        </div>
      </div>
      )}
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
        borderColor: ativo ? "var(--brand)" : "var(--border-color)",
        backgroundColor: ativo
          ? "color-mix(in srgb, var(--brand) 10%, transparent)"
          : "transparent",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand) 16%, transparent)",
            color: "var(--brand)",
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
  itemEditar,
  onClose,
  onCriar,
}: {
  day?: DayCell;
  artistas: Artista[];
  defaultArtistIds: string[];
  itemEditar?: AgendaItem;
  onClose: () => void;
  onCriar: (input: NovoAgendaItem) => Promise<void>;
}) {
  const t = useT();
  const editando = !!itemEditar;
  const dadosE = (itemEditar?.dados ?? {}) as Record<string, unknown>;
  const strE = (k: string) => (typeof dadosE[k] === "string" ? (dadosE[k] as string) : "");
  const subtitulo = itemEditar
    ? formatarDataBR(itemEditar.data)
    : day
      ? `${t(day.name)} · ${day.date}`
      : "";
  const voucherPathExistente = strE("voucherPath");
  const [modo, setModo] = useState<"manual" | "pdf">("manual");

  // Form (usado pelo manual E pelo PDF de 1 voo)
  const [dataVoo, setDataVoo] = useState(itemEditar?.data ?? day?.dataISO ?? "");
  const [numeroVoo, setNumeroVoo] = useState(strE("numeroVoo"));
  const [companhia, setCompanhia] = useState(strE("companhia"));
  const [origem, setOrigem] = useState(strE("origem"));
  const [destino, setDestino] = useState(strE("destino"));
  const [partida, setPartida] = useState(strE("partida") || (itemEditar?.horaInicio ?? ""));
  const [chegada, setChegada] = useState(strE("chegada") || (itemEditar?.horaFim ?? ""));
  const [localizador, setLocalizador] = useState(strE("localizador"));
  const [artistIds, setArtistIds] = useState<string[]>(itemEditar?.artistIds ?? defaultArtistIds);
  const [passageiros, setPassageiros] = useState<Passageiro[]>(passageirosDe(itemEditar));
  const [duracao, setDuracao] = useState(strE("duracao"));
  const [bagagem, setBagagem] = useState(strE("bagagem"));
  const [pdfBase64, setPdfBase64] = useState("");
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
  const [etapa, setEtapa] = useState<1 | 2>(1);

  function aplicarVoo(v: VooExtraido) {
    if (v.data) setDataVoo(v.data);
    setNumeroVoo(v.numeroVoo ?? "");
    setCompanhia(v.companhia ?? "");
    setOrigem(v.origem ?? "");
    setDestino(v.destino ?? "");
    setPartida(v.partida ?? "");
    setChegada(v.chegada ?? "");
    setLocalizador(v.localizador ?? "");
    setPassageiros((v.passageiros ?? []).map((n) => ({ nome: n })));
    if (v.duracao) setDuracao(v.duracao);
    if (v.bagagem) setBagagem(v.bagagem);
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
      setPdfBase64(base64);
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

  async function subirVoucher(): Promise<string> {
    if (!pdfBase64) return "";
    try {
      const res = await fetch("/api/voos/voucher", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: pdfBase64 }),
      });
      const b = await res.json();
      return typeof b.path === "string" ? b.path : "";
    } catch {
      return "";
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
      const voucherPath = (await subirVoucher()) || voucherPathExistente;
      await onCriar({
        tipo: "voo",
        titulo,
        data: dataVoo,
        diaInteiro: false,
        horaInicio: partida || undefined,
        horaFim: chegada || undefined,
        artistIds: artistIds,
        observacoes: observacoes.trim() || undefined,
        dados: {
          numeroVoo: numeroVoo.trim().toUpperCase(),
          companhia: companhia.trim(),
          origem: origem.trim().toUpperCase(),
          destino: destino.trim().toUpperCase(),
          partida,
          chegada,
          duracao: duracao || calcularDuracao(partida, chegada),
          bagagem: bagagem.trim(),
          voucherPath,
          localizador: localizador.trim(),
          passageiros: passageiros.filter((p) => p.nome.trim()),
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
      const voucherPath = await subirVoucher();
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
          artistIds: artistIds,
          dados: {
            numeroVoo: v.numeroVoo ?? "",
            companhia: v.companhia ?? "",
            origem: v.origem ?? "",
            destino: v.destino ?? "",
            partida: v.partida ?? "",
            chegada: v.chegada ?? "",
            duracao: v.duracao || calcularDuracao(v.partida ?? "", v.chegada ?? ""),
            bagagem: v.bagagem ?? "",
            voucherPath,
            localizador: v.localizador ?? "",
            passageiros: (v.passageiros ?? []).map((n) => ({ nome: n })),
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
      title={editando ? t("Editar voo") : t("Novo voo")}
      subtitle={subtitulo}
      maxWidth={480}
    >
      {etapa === 1 ? (
        <PassoArtista
          artistas={artistas}
          value={artistIds}
          onChange={setArtistIds}
          onCancelar={onClose}
          onContinuar={() => setEtapa(2)}
          cor="var(--brand)"
        />
      ) : (
      <div className="flex flex-col gap-4">
        <VoltarArtista artistas={artistas} ids={artistIds} onVoltar={() => setEtapa(1)} />
        {!editando && (
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
        )}

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
                <InputDataBR
                  value={dataVoo}
                  onChange={setDataVoo}
                  className="w-full"
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
                <InputHora value={partida} onChange={setPartida} accent="var(--brand)" />
              </CampoForm>
              <CampoForm label={t("Chegada")}>
                <InputHora value={chegada} onChange={setChegada} accent="var(--brand)" />
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

            <PassageirosField value={passageiros} onChange={setPassageiros} />

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
                  style={{ backgroundColor: "var(--brand)", color: "#fff" }}
                >
                  {salvando ? t("Adicionando…") : t("Adicionar à agenda")}
                </button>
              )
            : mostrarForm && (
                <button
                  onClick={submitUm}
                  disabled={salvando}
                  className="btn btn-primary disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand)", color: "#fff" }}
                >
                  {salvando ? t("Salvando…") : editando ? t("Salvar alterações") : t("Criar voo")}
                </button>
              )}
        </div>
      </div>
      )}
    </Modal>
  );
}

const TIPOS_TRANSPORTE = ["Executivo", "Van", "Carro", "Ônibus", "Transfer", "Outro"];

/** Form de criação de transporte terrestre (Fase 3, manual). */
function TransporteFormModal({
  day,
  artistas,
  defaultArtistIds,
  itemEditar,
  onClose,
  onCriar,
}: {
  day?: DayCell;
  artistas: Artista[];
  defaultArtistIds: string[];
  itemEditar?: AgendaItem;
  onClose: () => void;
  onCriar: (input: NovoAgendaItem) => Promise<void>;
}) {
  const t = useT();
  const editando = !!itemEditar;
  const dadosE = (itemEditar?.dados ?? {}) as Record<string, unknown>;
  const strE = (k: string) => (typeof dadosE[k] === "string" ? (dadosE[k] as string) : "");
  const subtitulo = itemEditar
    ? formatarDataBR(itemEditar.data)
    : day
      ? `${t(day.name)} · ${day.date}`
      : "";
  const [artistIds, setArtistIds] = useState<string[]>(itemEditar?.artistIds ?? defaultArtistIds);
  const [dataT, setDataT] = useState(itemEditar?.data ?? day?.dataISO ?? "");
  const [etapa, setEtapa] = useState<1 | 2>(itemEditar ? 2 : 1);
  const [tipo, setTipo] = useState(strE("tipoTransporte") || "Executivo");
  const [empresa, setEmpresa] = useState(strE("empresa"));
  const [motorista, setMotorista] = useState(strE("motorista"));
  const [contato, setContato] = useState(strE("contato"));
  const [origem, setOrigem] = useState(strE("origem"));
  const [destino, setDestino] = useState(strE("destino"));
  const [horario, setHorario] = useState(itemEditar?.horaInicio ?? "");
  const [passageiros, setPassageiros] = useState<Passageiro[]>(passageirosDe(itemEditar));
  const [observacoes, setObservacoes] = useState(itemEditar?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit() {
    if (salvando) return;
    if (!origem.trim() && !destino.trim() && !empresa.trim()) {
      setErro(t("Informe ao menos a rota ou a empresa."));
      return;
    }
    setSalvando(true);
    setErro(null);
    const rota = origem && destino ? `${origem.trim()}→${destino.trim()}` : "";
    const titulo = [t(tipo), rota].filter(Boolean).join(" · ") || t("Transporte");
    try {
      await onCriar({
        tipo: "transporte",
        titulo,
        data: dataT,
        diaInteiro: false,
        horaInicio: horario || undefined,
        artistIds,
        observacoes: observacoes.trim() || undefined,
        dados: {
          tipoTransporte: tipo,
          empresa: empresa.trim(),
          motorista: motorista.trim(),
          contato: contato.trim(),
          origem: origem.trim(),
          destino: destino.trim(),
          passageiros: passageiros.filter((p) => p.nome.trim()),
        },
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
      title={editando ? t("Editar transporte") : t("Novo transporte terrestre")}
      subtitle={subtitulo}
      maxWidth={480}
    >
      {etapa === 1 ? (
        <PassoArtista
          artistas={artistas}
          value={artistIds}
          onChange={setArtistIds}
          onCancelar={onClose}
          onContinuar={() => setEtapa(2)}
          cor="var(--brand)"
        />
      ) : (
      <div className="flex flex-col gap-4">
        <VoltarArtista artistas={artistas} ids={artistIds} onVoltar={() => setEtapa(1)} />

        <div className="grid grid-cols-2 gap-3">
          <CampoForm label={t("Data")}>
            <InputDataBR
              value={dataT}
              onChange={setDataT}
              className="w-full"
            />
          </CampoForm>
          <CampoForm label={t("Horário")}>
            <InputHora value={horario} onChange={setHorario} accent="var(--brand)" />
          </CampoForm>
        </div>

        <CampoForm label={t("Tipo")}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo-input">
            {TIPOS_TRANSPORTE.map((tp) => (
              <option key={tp} value={tp}>
                {t(tp)}
              </option>
            ))}
          </select>
        </CampoForm>

        <div className="grid grid-cols-2 gap-3">
          <CampoForm label={t("Origem")}>
            <input
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder={t("Aeroporto, hotel…")}
              className="campo-input"
            />
          </CampoForm>
          <CampoForm label={t("Destino")}>
            <input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder={t("Local do evento…")}
              className="campo-input"
            />
          </CampoForm>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CampoForm label={t("Empresa")}>
            <input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className="campo-input"
            />
          </CampoForm>
          <CampoForm label={t("Motorista")}>
            <input
              value={motorista}
              onChange={(e) => setMotorista(e.target.value)}
              className="campo-input"
            />
          </CampoForm>
        </div>

        <CampoForm label={t("Contato do motorista")}>
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            placeholder={t("Telefone/WhatsApp")}
            className="campo-input"
          />
        </CampoForm>

        <PassageirosField value={passageiros} onChange={setPassageiros} />

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
            style={{ backgroundColor: "var(--brand)", color: "#fff" }}
          >
            {salvando ? t("Salvando…") : editando ? t("Salvar alterações") : t("Criar transporte")}
          </button>
        </div>
      </div>
      )}
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
  duracao?: string;
  bagagem?: string;
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

/**
 * Normaliza a franquia de bagagem pra exibição como "Bagagem extra":
 * - "" quando o voucher não fala de bagagem (esconde a linha);
 * - `labelNao` (ex: "Não") quando é só bagagem de mão / sem mala despachada;
 * - o texto original quando há bagagem despachada de fato ("2x 32kg").
 */
function formatarBagagemExtra(raw: string, labelNao: string): string {
  const s = raw.trim();
  if (!s) return "";
  const low = s.toLowerCase();
  // Tem bagagem despachada de fato (peso/quantidade)?
  if (/\d\s*(kg|quilo|mala|peç|pec|piece|pc\b|x\s)/.test(low)) return s;
  // Frases que indicam ausência de bagagem despachada.
  if (/(sem mala|sem baga|s[oó]\s|apenas|somente|de m[aã]o|carry.?on|hand luggage|no checked|nenhum|n[aã]o)/.test(low)) {
    return labelNao;
  }
  return s;
}

/**
 * Cabeçalho do detalhe: o(s) artista(s) do item em destaque, no mesmo estilo
 * "coloridinho" dos cards de show da agenda (barrinha colorida na lateral).
 */
function CabecalhoArtistas({ artistas }: { artistas: Artista[] }) {
  if (artistas.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {artistas.map((a) => (
        <div
          key={a.id}
          className="inline-flex items-center gap-2 bg-surface-2 border border-border rounded-md pl-2.5 pr-3 py-1.5"
          style={{ borderLeft: `3px solid ${a.color}` }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: a.color }}
          />
          <span className="text-sm font-bold text-primary">{a.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Linhas específicas de um voo (a partir do `dados` do item). */
function DetalheVoo({ dados }: { dados?: Record<string, unknown> }) {
  const t = useT();
  const [baixando, setBaixando] = useState(false);
  const d = (dados ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const rota = str("origem") && str("destino") ? `${str("origem")} → ${str("destino")}` : "";
  const voucherPath = str("voucherPath");
  const bagagemExtra = formatarBagagemExtra(str("bagagem"), t("Não"));
  const passageiros: Passageiro[] = Array.isArray(d.passageiros)
    ? (d.passageiros as Passageiro[])
    : str("passageiros")
      ? str("passageiros")
          .split(", ")
          .filter(Boolean)
          .map((nome) => ({ nome }))
      : [];

  async function baixarVoucher() {
    if (!voucherPath || baixando) return;
    setBaixando(true);
    try {
      const res = await fetch(
        `/api/voos/voucher?path=${encodeURIComponent(voucherPath)}`,
        { credentials: "include" }
      );
      const b = await res.json();
      if (b?.url) window.open(b.url, "_blank", "noopener");
    } catch {
      // silencioso — download é secundário
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      {str("companhia") && <LinhaDetalhe rotulo={t("Companhia")} valor={str("companhia")} />}
      {rota && <LinhaDetalhe rotulo={t("Rota")} valor={rota} />}
      {bagagemExtra && <LinhaDetalhe rotulo={t("Bagagem extra")} valor={bagagemExtra} />}
      {str("localizador") && (
        <LinhaDetalhe rotulo={t("Localizador (PNR)")} valor={str("localizador")} />
      )}
      {passageiros.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t("Passageiros")}</span>
          {passageiros.map((p, i) => (
            <div key={i} className="text-sm text-primary font-medium leading-snug">
              {p.nome}
              {(p.nascimento || p.bagagemExtra) && (
                <span className="text-xs text-muted">
                  {" · "}
                  {[
                    p.nascimento && formatarDataBR(p.nascimento),
                    p.bagagemExtra && t("bagagem extra"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {voucherPath && (
        <button
          type="button"
          onClick={baixarVoucher}
          disabled={baixando}
          className="btn btn-secondary self-start inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
        >
          <Download size={14} />
          {baixando ? t("Baixando…") : t("Baixar voucher")}
        </button>
      )}
    </>
  );
}

/** Linhas específicas de um transporte terrestre. */
function DetalheTransporte({ dados }: { dados?: Record<string, unknown> }) {
  const t = useT();
  const d = (dados ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const rota = str("origem") && str("destino") ? `${str("origem")} → ${str("destino")}` : "";
  const contato = [str("motorista"), str("contato")].filter(Boolean).join(" · ");
  const passageiros: Passageiro[] = Array.isArray(d.passageiros)
    ? (d.passageiros as Passageiro[])
    : [];
  return (
    <>
      {str("tipoTransporte") && <LinhaDetalhe rotulo={t("Tipo")} valor={t(str("tipoTransporte"))} />}
      {rota && <LinhaDetalhe rotulo={t("Rota")} valor={rota} />}
      {str("empresa") && <LinhaDetalhe rotulo={t("Empresa")} valor={str("empresa")} />}
      {contato && <LinhaDetalhe rotulo={t("Motorista")} valor={contato} />}
      {passageiros.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t("Passageiros")}</span>
          {passageiros.map((p, i) => (
            <div key={i} className="text-sm text-primary font-medium leading-snug">
              {p.nome}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Detalhe de um item + excluir (Fase 2: sem edição). */
function ItemDetalheModal({
  item,
  artistasDoItem,
  podeUI,
  onClose,
  onEditar,
  onExcluir,
}: {
  item: AgendaItem;
  artistasDoItem: Artista[];
  podeUI: (artistaId: string | null, chave: string) => boolean;
  onClose: () => void;
  onEditar: () => void;
  onExcluir: () => Promise<void>;
}) {
  const t = useT();
  const [excluindo, setExcluindo] = useState(false);
  const meta = META_TIPO[item.tipo];
  const podeEditar = item.artistIds.length
    ? item.artistIds.some(
        (id) => podeUI(id, "agenda.editar") || podeUI(id, "agenda.editar_todos")
      )
    : podeUI(null, "agenda.editar_todos");
  const podeExcluir = item.artistIds.length
    ? item.artistIds.some(
        (id) => podeUI(id, "agenda.excluir") || podeUI(id, "agenda.excluir_todos")
      )
    : podeUI(null, "agenda.excluir_todos");
  const horario = item.diaInteiro
    ? t("Dia inteiro")
    : [item.horaInicio, item.horaFim].filter(Boolean).join(" – ") || "—";
  const dur =
    item.tipo === "voo" && typeof item.dados?.duracao === "string"
      ? (item.dados.duracao as string)
      : "";

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
        <CabecalhoArtistas artistas={artistasDoItem} />
        {item.tipo === "voo" ? (
          <>
            <LinhaDetalhe rotulo={t("Data")} valor={formatarDataBR(item.data)} />
            {item.horaInicio && <LinhaDetalhe rotulo={t("Partida")} valor={item.horaInicio} />}
            {item.horaFim && <LinhaDetalhe rotulo={t("Chegada")} valor={item.horaFim} />}
            {dur && <LinhaDetalhe rotulo={t("Tempo de voo")} valor={dur} />}
          </>
        ) : (
          <LinhaDetalhe
            rotulo={t("Quando")}
            valor={`${formatarDataBR(item.data)} · ${horario}${dur ? ` · ${dur}` : ""}`}
          />
        )}
        {item.tipo === "voo" && <DetalheVoo dados={item.dados} />}
        {item.tipo === "transporte" && <DetalheTransporte dados={item.dados} />}
        {item.observacoes && <LinhaDetalhe rotulo={t("Observações")} valor={item.observacoes} />}
        {item.tipo === "voo" && (
          <div className="text-[0.7rem] text-muted pt-2 border-t border-border">
            ⚠ {t("Confira no site da companhia (pelo localizador) se o horário não mudou.")}
          </div>
        )}
        <div className="flex justify-between pt-2">
          <button
            onClick={onEditar}
            disabled={!podeEditar}
            title={!podeEditar ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Pencil size={14} />
            {t("Editar")}
          </button>
          <button
            onClick={excluir}
            disabled={excluindo || !podeExcluir}
            title={!podeExcluir ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
  podeAbrirNovoItem,
  onShowClick,
  onItemClick,
  onNovoItem,
}: {
  day: DayCell;
  shows: Show[];
  itens: AgendaItem[];
  artistas: Artista[];
  accent: string;
  podeAbrirNovoItem: boolean;
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
          artista={artistas.find((d) => d.id === show.artistaId)}
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
