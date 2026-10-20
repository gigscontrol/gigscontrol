"use client";

import { useEffect, useMemo, useState } from "react";
import DateRangeSelector from "./DateRangeSelector";
import PageHeader from "./PageHeader";
import { useShows } from "@/lib/shows-context";
import { useAgendaItems } from "@/lib/agenda-items-context";
import { useWorkspace, useArtistas } from "@/lib/workspace-context";
import { setFeriados, ehFeriado, ehVesperaDeFeriado } from "@/lib/feriados";
import { MODULE_THEMES } from "@/types";
import type { AgendaDateRange, AgendaItem } from "@/types";
import { useNavegacao } from "./NavOverlay";
import Modal from "./Modal";
import InputDataBR from "./inputs/InputDataBR";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { podeCriarShowUI } from "@/lib/permissoes/gatesShow";
import { showNoDia } from "@/lib/agenda/showNoDia";
import { ALL_MONTHS, DATE_RANGES, DAY_NAMES, DAY_NAMES_SHORT, DayCell, DayCellComponent, EmptyState, FabNovoDia, MESES_LONGOS, MobileDayCard, cellDeISO, isoDia, isoHoje } from "./agenda/calendario";
import { NovoItemModal } from "./agenda/NovoItemModal";
import { CampoForm } from "./agenda/camposAgenda";
import { VooFormModal } from "./agenda/VooFormModal";
import { EventoFormModal } from "./agenda/EventoFormModal";
import { TransporteFormModal } from "./agenda/TransporteFormModal";
import { ItemDetalheModal } from "./agenda/ItemDetalheModal";

type Props = {
  selectedArtistas: string[];
  /** "Nova venda" no "+" de um dia → abre a Nova venda com a data. */
  onNovaVendaNoDia?: (dataISO: string) => void;
};

export default function AgendaEscala({ selectedArtistas, onNovaVendaNoDia }: Props) {
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
  //   podeCriarShow   → vendas.criar: "Novo Show" (agenda virou só
  //                     visualização; criar show é permissão de VENDAS).
  // O "+" aparece se ele pode criar QUALQUER uma das duas coisas — senão quem
  // só tem vendas.criar ficaria sem botão nenhum.
  const podeCriarAlgum = artistas.some((a) => podeUI(a.id, "agenda.criar"));
  const podeCriarShow = artistas.some((a) => podeCriarShowUI(podeUI, a.id));
  const podeAbrirNovoItem = podeCriarAlgum || podeCriarShow;
  // O show abre no modal GLOBAL com endereço (?show=<id>, ver layout) — o
  // mesmo de toda tela, com "Editar venda" (o modal local daqui não tinha).
  const { abrirSobreposicao } = useNavegacao();
  const setShowSelecionado = (id: string) => abrirSobreposicao("show", id);
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
  // Um artista só na tela (login de artista ou filtro com 1): o cartão do show
  // troca o nome dele (repetido em tudo) pelo local.
  const umArtista = artistas.filter((a) => selectedArtistas.includes(a.id)).length === 1;
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
        title="Calendário"
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
                umArtista={umArtista}
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
                umArtista={umArtista}
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
