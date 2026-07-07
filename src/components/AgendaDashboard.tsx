"use client";

import { useMemo, useState } from "react";
import {
  Music,
  ChevronRight,
  Plane,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ListChecks,
  Clock,
  Copy,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import DateRangeSelector from "./DateRangeSelector";
import Modal from "./Modal";
import { useShows } from "@/lib/shows-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { useVendas } from "@/lib/vendas-context";
import { setFeriados, ehFeriado, ehVesperaDeFeriado } from "@/lib/feriados";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage, AgendaDateRange, Show } from "@/types";
import { useT } from "@/lib/i18n";

type Props = {
  selectedDJs: string[];
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  onAbrirShow?: (showId: string) => void;
};

const ATALHOS: AgendaDateRange[] = [
  "Visão geral",
  "Mês anterior",
  "Mês atual",
  "Próximo mês",
  "Personalizado",
];
const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function iso(ano: number, mes1: number, dia: number): string {
  return `${ano}-${String(mes1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
function hojeISO(): string {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function diasEntre(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T12:00:00`).getTime();
  const b = new Date(`${bISO}T12:00:00`).getTime();
  return Math.round((a - b) / 86400000);
}
/**
 * Resolve {ano, mes(0-based), tudo} a partir do seletor. `tudo` = "Visão geral"
 * (all-time, sem recorte de data). Nesse caso ano/mes apontam pro mês corrente —
 * fallback pros widgets que precisam de um mês concreto (ocupação, datas).
 */
function resolverMes(
  range: AgendaDateRange,
  customMonth: string | null,
  customYear: number | null
): { ano: number; mes: number; tudo: boolean } {
  const h = new Date();
  if (range === "Visão geral") {
    return { ano: h.getFullYear(), mes: h.getMonth(), tudo: true };
  }
  if (range === "Mês anterior") {
    const d = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Próximo mês") {
    const d = new Date(h.getFullYear(), h.getMonth() + 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Personalizado" && customMonth && customYear !== null) {
    return { ano: customYear, mes: Math.max(0, MESES_CURTO.indexOf(customMonth)), tudo: false };
  }
  return { ano: h.getFullYear(), mes: h.getMonth(), tudo: false };
}

export default function AgendaDashboard({ selectedDJs, onNavigate, onAbrirShow }: Props) {
  const t = useT();
  const accent = MODULE_THEMES.agenda.color;
  const { shows } = useShows();
  const { cidades, casas } = useContatos();
  const artistas = useArtistas();
  const { workspaceCriadoEm } = useWorkspace();
  const { vendas } = useVendas();

  // ---- Seletor de mês ----
  const [range, setRange] = useState<AgendaDateRange>("Mês atual");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [ocupacaoAberta, setOcupacaoAberta] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  // Quais tipos de dia entram na lista de datas disponíveis (copiar).
  const [incluir, setIncluir] = useState({
    sex: true,
    sab: true,
    dom: true,
    feriado: true,
  });
  const toggleInclui = (k: keyof typeof incluir) =>
    setIncluir((prev) => ({ ...prev, [k]: !prev[k] }));
  const [lista, setLista] = useState<{
    titulo: string;
    subtitulo?: string;
    shows: Show[];
    pendencias?: boolean;
  } | null>(null);
  const { ano, mes, tudo } = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const hoje = hojeISO();

  // Shows do período + DJs visíveis na sidebar. Em "Visão geral" (tudo) pega o
  // histórico inteiro; senão, só o mês selecionado.
  const showsMes = useMemo(
    () =>
      shows.filter((s) => {
        if (!selectedDJs.includes(s.djId) || !s.data) return false;
        if (tudo) return true;
        const d = new Date(`${s.data}T12:00:00`);
        return d.getFullYear() === ano && d.getMonth() === mes;
      }),
    [shows, selectedDJs, ano, mes, tudo]
  );

  const cidadeDoShow = (s: Show) =>
    s.cidadeId ? cidades.find((c) => String(c.id) === s.cidadeId) : undefined;
  const djDoShow = (s: Show) => artistas.find((d) => d.id === s.djId);
  // Local do evento (a "balada"): venue do show → casa vinculada →
  // nome_local da venda vinculada. Vazio se nenhum estiver setado.
  const localDoEvento = (s: Show): string => {
    const casa = s.casaId ? casas.find((c) => String(c.id) === s.casaId) : undefined;
    const venda = s.vendaId ? vendas.find((v) => v.id === s.vendaId) : undefined;
    return s.venue || casa?.nome || venda?.nomeLocal || "";
  };

  // ---- 1) Shows confirmados (no mês) ----
  const confirmadosList = useMemo(
    () => showsMes.filter((s) => s.status === "confirmado"),
    [showsMes]
  );
  const confirmados = confirmadosList.length;
  // Cancelados (novo indicador) e total do período.
  const canceladosList = useMemo(
    () => showsMes.filter((s) => s.status === "cancelado"),
    [showsMes]
  );
  const cancelados = canceladosList.length;
  const totalShows = showsMes.length;
  // Shows ainda a realizar (data de hoje em diante) — cancelados NÃO contam.
  const aRealizarList = useMemo(
    () =>
      showsMes
        .filter((s) => s.data && s.data >= hoje && s.status !== "cancelado")
        .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? "")),
    [showsMes, hoje]
  );
  const aRealizar = aRealizarList.length;

  // Shows com pendência: data marcada, mas algo pendente — confirmação,
  // logística, horário ou pagamento atrasado.
  const pendenciasDoShow = (s: Show): string[] => {
    // Show cancelado saiu da operação — não tem pendência a resolver.
    if (s.status === "cancelado") return [];
    const p: string[] = [];
    if (s.status === "pendente") p.push("confirmação");
    if (s.status === "logistica") p.push("logística");
    if (!s.time) p.push("horário");
    if (s.vendaId) {
      const v = vendas.find((x) => x.id === s.vendaId);
      if (
        v &&
        v.parcelas.some(
          (pc) =>
            pc.statusBase !== "pago" &&
            pc.dataVencimento &&
            pc.dataVencimento < hoje
        )
      ) {
        p.push("pagamento");
      }
    }
    return p;
  };
  const showsComPendencia = useMemo(
    () => showsMes.filter((s) => pendenciasDoShow(s).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showsMes, vendas, hoje]
  );
  const subtitlePendencia = useMemo(() => {
    if (showsComPendencia.length === 0) return t("Tudo resolvido");
    const tipos = new Set<string>();
    showsComPendencia.forEach((s) =>
      pendenciasDoShow(s).forEach((tipo) => tipos.add(tipo))
    );
    const txt = Array.from(tipos).map((tipo) => t(tipo)).join(", ");
    return txt.charAt(0).toUpperCase() + txt.slice(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showsComPendencia, t]);

  // ---- 2) Próximas viagens (fora da cidade natal do DJ) ----
  const viagens = useMemo(() => {
    return showsMes
      .filter((s) => {
        // Em "Visão geral", "próximas viagens" = só as futuras (senão o
        // histórico inteiro entraria, inclusive viagens já passadas).
        if (tudo && (!s.data || s.data < hoje)) return false;
        const cid = cidadeDoShow(s);
        const dj = djDoShow(s);
        // Sem cidade não dá pra dizer se é viagem — inclui por garantia.
        if (!cid) return true;
        // Exclui se a cidade do show é a cidade natal do DJ (match por IBGE).
        if (cid.ibgeId && dj?.cidadeIbgeId && cid.ibgeId === dj.cidadeIbgeId) {
          return false;
        }
        return true;
      })
      .map((s) => {
        const cid = cidadeDoShow(s);
        const dj = djDoShow(s);
        const dias = s.data ? diasEntre(s.data, hoje) : 0;
        return {
          show: s,
          cidade: cid ? `${cid.nome}/${cid.estado}` : s.location || "—",
          djNome: dj?.name ?? "—",
          djCor: dj?.color ?? "#888",
          dias,
          data: s.data ?? "",
        };
      })
      .sort((a, b) => a.data.localeCompare(b.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showsMes, cidades, artistas, hoje]);

  // ---- 3) Fim de semana / feriados ocupados ----
  const ocupacao = useMemo(() => {
    const diasComShow = new Set(showsMes.map((s) => s.data));
    const feriados = setFeriados([ano - 1, ano, ano + 1]);
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    // [ocupados, total]
    const q = [0, 0], sx = [0, 0], sb = [0, 0], dm = [0, 0], vp = [0, 0], fr = [0, 0];
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dISO = iso(ano, mes + 1, dia);
      const wd = new Date(ano, mes, dia).getDay(); // 0=Dom .. 6=Sáb
      const ocupado = diasComShow.has(dISO);
      const bump = (arr: number[]) => {
        arr[1]++;
        if (ocupado) arr[0]++;
      };
      if (wd === 4) bump(q);
      if (wd === 5) bump(sx);
      if (wd === 6) bump(sb);
      if (wd === 0) bump(dm);
      if (ehVesperaDeFeriado(dISO, feriados)) bump(vp);
      if (ehFeriado(dISO, feriados)) bump(fr);
    }
    return [
      { label: "Quintas", v: q },
      { label: "Sextas", v: sx },
      { label: "Sábados", v: sb },
      { label: "Domingos", v: dm },
      { label: "Véspera de feriado", v: vp },
      { label: "Feriados", v: fr },
    ].filter((row) => row.v[1] > 0);
  }, [showsMes, ano, mes]);

  // ---- 4) Próximos shows — do mês + 1ª semana do mês seguinte, só os
  //         que ainda vão acontecer (data >= hoje). Assim no fim do mês
  //         já aparecem os primeiros shows do mês que vem.
  const proximosShowsFull = useMemo(() => {
    const inicioMes = iso(ano, mes + 1, 1);
    const inicio = inicioMes > hoje ? inicioMes : hoje;
    const fimDate = new Date(ano, mes + 1, 7);
    const fim = iso(
      fimDate.getFullYear(),
      fimDate.getMonth() + 1,
      fimDate.getDate()
    );
    return shows
      .filter(
        (s) =>
          selectedDJs.includes(s.djId) &&
          s.data &&
          s.data >= inicio &&
          s.data <= fim
      )
      .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? ""));
  }, [shows, selectedDJs, ano, mes, hoje]);
  const proximosShows = proximosShowsFull.slice(0, 6);

  // ---- 5) Shows realizados (data passada) + pendências ----
  const temPendencia = (s: Show): boolean => {
    if (!s.vendaId) return false;
    const v = vendas.find((x) => x.id === s.vendaId);
    if (!v) return false;
    return v.parcelas.some((p) => p.statusBase !== "pago");
  };
  const realizados = useMemo(() => {
    const passados = showsMes.filter(
      (s) => s.data && s.data < hoje && s.status !== "cancelado"
    );
    const comPendencia = passados.filter(temPendencia);
    return { total: passados.length, comPendencia, lista: passados };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showsMes, vendas, hoje]);

  // ---- 6) Resumo do mês (todos os shows do mês) ----
  const resumo = useMemo(
    () => [...showsMes].sort((a, b) => (a.data ?? "").localeCompare(b.data ?? "")),
    [showsMes]
  );

  const tituloMesConcreto = `${MESES_LONGO[mes]} ${ano}`;
  const tituloMes = tudo ? t("Visão geral") : tituloMesConcreto;

  // Texto de datas disponíveis de UM DJ pra colar no WhatsApp do cliente.
  // Dias importantes (Sex/Sáb/Dom + feriados/vésperas) FUTUROS do mês:
  //   - livre → "Qualquer horário"
  //   - com show → "Disponível para região de {cidade} — checar horário"
  const gerarDatasDisponiveis = (djId: string): string => {
    const dj = artistas.find((d) => d.id === djId);
    const djNome = dj?.name ?? "DJ";
    const feriados = setFeriados([ano - 1, ano, ano + 1]);
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const linhas: string[] = [];
    // Só o mês selecionado (não estende pro mês seguinte aqui).
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dISO = iso(ano, mes + 1, dia);
      if (dISO < hoje) continue; // só datas futuras
      const wd = new Date(ano, mes, dia).getDay();
      const importante =
        (incluir.sex && wd === 5) ||
        (incluir.sab && wd === 6) ||
        (incluir.dom && wd === 0) ||
        (incluir.feriado &&
          (ehFeriado(dISO, feriados) || ehVesperaDeFeriado(dISO, feriados)));
      if (!importante) continue;
      const ddmm = `${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
      const showsNoDia = showsMes.filter((s) => s.data === dISO && s.djId === djId);
      if (showsNoDia.length === 0) {
        linhas.push(`${t(DIAS_SEMANA[wd])} ${ddmm} - ${t("Qualquer horário")}`);
      } else {
        const cidadesDia = Array.from(
          new Set(
            showsNoDia
              .map((s) => {
                const c = cidadeDoShow(s);
                return c ? c.nome : s.location || "";
              })
              .filter(Boolean)
          )
        ).join(", ");
        linhas.push(
          `${t(DIAS_SEMANA[wd])} ${ddmm} - ${t("Disponível para região de {cidade} — checar disponibilidade de horário", { cidade: cidadesDia })}`
        );
      }
    }
    const header = `*${t("Datas disponíveis ({djNome}) em {mes}", { djNome, mes: t(MESES_LONGO[mes]) })}*`;
    if (linhas.length === 0) {
      return `${header}\n\n${t("Nenhuma data importante disponível neste mês.")}`;
    }
    return [header, "", ...linhas].join("\n");
  };

  const copiarDatas = async (djId: string) => {
    try {
      await navigator.clipboard.writeText(gerarDatasDisponiveis(djId));
      setCopiado(djId);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* clipboard indisponível */
    }
  };

  // Linha de show reutilizada no "Resumo do mês" e nos modais das stats.
  // opts.pendencias → mostra badges das pendências em vez do status.
  const renderLinhaResumo = (show: Show, opts?: { pendencias?: boolean }) => {
    const dj = djDoShow(show);
    const cid = cidadeDoShow(show);
    const diaMes = show.data ? Number(show.data.slice(8, 10)) : show.dayId;
    const balada = localDoEvento(show);
    const cidadeTxt = cid ? `${cid.nome}/${cid.estado}` : show.location || "";
    const headline = balada || cidadeTxt || "Local a definir";
    const sub = [balada ? cidadeTxt : "", dj?.name, show.time]
      .filter(Boolean)
      .join(" · ");
    return (
      <button
        key={show.id}
        onClick={() => onAbrirShow?.(show.id)}
        className="flex items-center gap-3 py-2.5 text-left hover:bg-elevated transition-colors -mx-2 px-2 rounded-md w-full"
      >
        <div className="w-10 text-center flex-shrink-0">
          <div className="text-lg font-bold tabular-nums leading-none text-primary">
            {diaMes}
          </div>
          <div className="text-[0.6rem] uppercase text-muted">{t(MESES_CURTO[mes])}</div>
        </div>
        <span
          className="h-7 w-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold flex-shrink-0"
          style={{ backgroundColor: dj?.color ?? "#888", color: "#fff" }}
        >
          {dj?.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-primary truncate">
            {headline === "Local a definir" ? t("Local a definir") : headline}
          </div>
          {sub && <div className="text-xs text-muted truncate">{sub}</div>}
        </div>
        {opts?.pendencias ? (
          <span className="flex flex-wrap gap-1 justify-end max-w-[180px]">
            {pendenciasDoShow(show).map((p) => (
              <span key={p} className="badge badge-warning">
                {t(p)}
              </span>
            ))}
          </span>
        ) : (
          <span
            className={`badge ${
              show.status === "confirmado"
                ? "badge-success"
                : show.status === "logistica"
                ? "badge-danger"
                : "badge-warning"
            }`}
          >
            {t(show.status)}
          </span>
        )}
        <ChevronRight size={14} className="text-muted flex-shrink-0" />
      </button>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Agenda"
        subtitle={tudo ? t("Panorama completo da agenda") : `${t("Visão do mês")} — ${tituloMes}`}
        accentColor={accent}
        actions={
          <DateRangeSelector
            options={ATALHOS}
            value={range}
            onChange={setRange}
            selectedCustomMonth={customMonth}
            setSelectedCustomMonth={setCustomMonth}
            selectedCustomYear={customYear}
            setSelectedCustomYear={setCustomYear}
            accountCreatedAt={workspaceCriadoEm}
          />
        }
      />

      {/* Cards de número — clicáveis, abrem a lista correspondente. Em "Visão
          geral" contam a agenda inteira; senão, só o mês selecionado. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ClickableStat
          onClick={() =>
            setLista({ titulo: t("Todos os shows"), subtitulo: tituloMes, shows: resumo })
          }
        >
          <StatCard
            title={t("Total de shows")}
            value={totalShows}
            icon={<CalendarDays size={16} />}
            accentColor={accent}
            subtitle={tudo ? t("Na agenda inteira") : t("Em {mes}", { mes: t(MESES_LONGO[mes]) })}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() =>
            setLista({
              titulo: t("Shows confirmados"),
              subtitulo: tituloMes,
              shows: confirmadosList,
            })
          }
        >
          <StatCard
            title={t("Shows confirmados")}
            value={confirmados}
            icon={<Music size={16} />}
            accentColor="var(--success)"
            subtitle={tudo ? t("Confirmados no total") : t("Em {mes}", { mes: t(MESES_LONGO[mes]) })}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() =>
            setLista({
              titulo: t("Shows cancelados"),
              subtitulo: tituloMes,
              shows: canceladosList,
            })
          }
        >
          <StatCard
            title={t("Cancelados")}
            value={cancelados}
            icon={<XCircle size={16} />}
            accentColor="var(--danger)"
            subtitle={cancelados === 0 ? t("Nenhum cancelamento") : t("Fora da operação")}
          />
        </ClickableStat>
        <ClickableStat
          onClick={() =>
            setLista({
              titulo: t("Shows com pendências"),
              subtitulo: tituloMes,
              shows: showsComPendencia,
              pendencias: true,
            })
          }
        >
          <StatCard
            title={t("Com pendências")}
            value={showsComPendencia.length}
            icon={<AlertTriangle size={16} />}
            accentColor="var(--warning)"
            subtitle={subtitlePendencia}
          />
        </ClickableStat>
      </div>

      {/* Shows realizados + a realizar — em lista (saíram dos cards de cima). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
              {t("Shows realizados")}
              <span className="badge badge-neutral tabular-nums">{realizados.total}</span>
            </div>
            {realizados.lista.length > 0 && (
              <button
                onClick={() =>
                  setLista({ titulo: t("Shows realizados"), subtitulo: tituloMes, shows: realizados.lista })
                }
                className="btn-ghost text-xs inline-flex items-center gap-1"
              >
                {t("Ver todos")} <ChevronRight size={12} />
              </button>
            )}
          </div>
          {realizados.lista.length === 0 ? (
            <div className="text-sm text-muted text-center py-6">
              {t("Nenhum show realizado no período.")}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {realizados.lista.slice(0, 5).map((s) => renderLinhaResumo(s))}
              {realizados.lista.length > 5 && (
                <button
                  onClick={() =>
                    setLista({ titulo: t("Shows realizados"), subtitulo: tituloMes, shows: realizados.lista })
                  }
                  className="text-xs text-muted hover:text-primary py-2.5 text-center transition-colors"
                >
                  {t("+ {n} shows — ver todos", { n: realizados.lista.length - 5 })}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title flex items-center gap-2">
              <Clock size={16} style={{ color: "var(--warning)" }} />
              {t("Shows a realizar")}
              <span className="badge badge-neutral tabular-nums">{aRealizar}</span>
            </div>
            {aRealizarList.length > 0 && (
              <button
                onClick={() =>
                  setLista({ titulo: t("Shows a realizar"), subtitulo: tituloMes, shows: aRealizarList })
                }
                className="btn-ghost text-xs inline-flex items-center gap-1"
              >
                {t("Ver todos")} <ChevronRight size={12} />
              </button>
            )}
          </div>
          {aRealizarList.length === 0 ? (
            <div className="text-sm text-muted text-center py-6">
              {t("Nenhum show a realizar no período.")}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {aRealizarList.slice(0, 5).map((s) => renderLinhaResumo(s))}
              {aRealizarList.length > 5 && (
                <button
                  onClick={() =>
                    setLista({ titulo: t("Shows a realizar"), subtitulo: tituloMes, shows: aRealizarList })
                  }
                  className="text-xs text-muted hover:text-primary py-2.5 text-center transition-colors"
                >
                  {t("+ {n} shows — ver todos", { n: aRealizarList.length - 5 })}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fim de semana / feriados ocupados */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title flex items-center gap-2">
              <CalendarDays size={16} style={{ color: accent }} />
              {t("Ocupação do mês")}
            </div>
            <button
              onClick={() => setOcupacaoAberta(true)}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Datas disponíveis")} <ChevronRight size={12} />
            </button>
          </div>
          {ocupacao.length === 0 ? (
            <div className="text-sm text-muted text-center py-6">{t("Sem dias no mês.")}</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {ocupacao.map((row) => {
                const [ocup, total] = row.v;
                const pct = total > 0 ? (ocup / total) * 100 : 0;
                const cheio = ocup === total && total > 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-secondary">{t(row.label)}</span>
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: cheio ? "var(--success)" : "var(--text-primary)" }}
                      >
                        {ocup}/{total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: cheio ? "var(--success)" : "var(--grad-signal)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Próximas viagens */}
        <div className="card">
          <div className="section-title mb-4 flex items-center gap-2">
            <Plane size={16} style={{ color: accent }} />
            {t("Próximas viagens")}
          </div>
          {viagens.length === 0 ? (
            <div className="text-sm text-muted text-center py-6">
              {t("Nenhuma viagem no mês (só shows na cidade local).")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {viagens.slice(0, 8).map((v) => (
                <button
                  key={v.show.id}
                  onClick={() => onAbrirShow?.(v.show.id)}
                  className="flex items-center gap-3 p-2 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: v.djCor }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-primary block truncate">
                      {v.cidade}
                    </span>
                    <span className="text-xs text-muted">{v.djNome}</span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
                    {v.dias > 0
                      ? t("em {n} dia{s}", { n: v.dias, s: v.dias > 1 ? "s" : "" })
                      : v.dias === 0
                      ? t("hoje")
                      : v.data.split("-").reverse().slice(0, 2).join("/")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Próximos shows */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">{t("Próximos shows")}</div>
            <button
              onClick={() =>
                setLista({
                  titulo: t("Próximos shows"),
                  subtitulo: tituloMes,
                  shows: proximosShowsFull,
                })
              }
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver todos")} <ChevronRight size={12} />
            </button>
          </div>
          {proximosShows.length === 0 ? (
            <div className="text-sm text-muted text-center py-6">
              {t("Nenhum show próximo.")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {proximosShows.map((show) => {
                const dj = djDoShow(show);
                const cid = cidadeDoShow(show);
                return (
                  <button
                    key={show.id}
                    onClick={() => onAbrirShow?.(show.id)}
                    className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
                  >
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0"
                      style={{ backgroundColor: dj?.color ?? "#888", color: "#fff" }}
                    >
                      {dj?.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-primary truncate">
                        {show.venue || t("Local a definir")}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {dj?.name} ·{" "}
                        {cid ? `${cid.nome}/${cid.estado}` : show.location}
                        {show.data ? ` · ${show.data.split("-").reverse().slice(0, 2).join("/")}` : ""}
                        {show.time ? ` · ${show.time}` : ""}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        show.status === "confirmado"
                          ? "badge-success"
                          : show.status === "logistica"
                          ? "badge-danger"
                          : "badge-warning"
                      }`}
                    >
                      {t(show.status)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Shows realizados com pendência */}
        <div className="card">
          <div className="section-title mb-4 flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
            {t("Realizados com pendência")}
          </div>
          {realizados.comPendencia.length === 0 ? (
            <div className="text-sm text-muted text-center py-6">
              {realizados.total === 0
                ? t("Nenhum show realizado no mês.")
                : t("Todos os shows realizados estão quitados. ✓")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {realizados.comPendencia.map((show) => {
                const dj = djDoShow(show);
                const cid = cidadeDoShow(show);
                return (
                  <button
                    key={show.id}
                    onClick={() => onAbrirShow?.(show.id)}
                    className="flex items-center gap-3 p-2.5 rounded-md border bg-elevated text-left transition-colors hover:border-border-strong"
                    style={{ borderColor: "rgba(245,158,11,0.3)" }}
                  >
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0"
                      style={{ backgroundColor: dj?.color ?? "#888", color: "#fff" }}
                    >
                      {dj?.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-primary truncate">
                        {localDoEvento(show) || cid?.nome || t("Show")}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {dj?.name}
                        {cid ? ` · ${cid.nome}/${cid.estado}` : ""}
                        {show.data ? ` · ${show.data.split("-").reverse().slice(0, 2).join("/")}` : ""}
                      </div>
                    </div>
                    <span className="badge badge-warning">{t("pagamento")}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Resumo do mês — preview + botão pra ver completo */}
      <div className="card mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="section-title flex items-center gap-2">
            <ListChecks size={16} style={{ color: accent }} />
            {t("Resumo — {mes} ({n} {show})", { mes: tituloMes, n: resumo.length, show: resumo.length === 1 ? "show" : "shows" })}
          </div>
          {resumo.length > 0 && (
            <button
              onClick={() => setResumoAberto(true)}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver resumo completo")} <ChevronRight size={12} />
            </button>
          )}
        </div>
        {resumo.length === 0 ? (
          <div className="text-sm text-muted text-center py-8">
            {t("Nenhum show em {mes} para os DJs selecionados.", { mes: tituloMes })}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {resumo.slice(0, 5).map((s) => renderLinhaResumo(s))}
            {resumo.length > 5 && (
              <button
                onClick={() => setResumoAberto(true)}
                className="text-xs text-muted hover:text-primary py-2.5 text-center transition-colors"
              >
                {t("+ {n} shows — ver resumo completo", { n: resumo.length - 5 })}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal — resumo completo das datas do mês */}
      <Modal
        isOpen={resumoAberto}
        onClose={() => setResumoAberto(false)}
        title={t("Resumo — {mes}", { mes: tituloMes })}
        subtitle={t("{n} {show}", { n: resumo.length, show: resumo.length === 1 ? "show" : "shows" })}
        maxWidth={640}
      >
        {resumo.length === 0 ? (
          <div className="text-sm text-muted text-center py-8">
            {t("Nenhum show no mês.")}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border max-h-[65vh] overflow-y-auto">
            {resumo.map((s) => renderLinhaResumo(s))}
          </div>
        )}
      </Modal>

      {/* Modal — lista de shows (ao clicar nos cards de número) */}
      <Modal
        isOpen={!!lista}
        onClose={() => setLista(null)}
        title={lista?.titulo ?? ""}
        subtitle={lista?.subtitulo}
        maxWidth={640}
      >
        {!lista || lista.shows.length === 0 ? (
          <div className="text-sm text-muted text-center py-8">
            {t("Nenhum show nesta categoria em {mes}.", { mes: tituloMes })}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border max-h-[65vh] overflow-y-auto">
            {lista.shows.map((s) =>
              renderLinhaResumo(s, { pendencias: lista.pendencias })
            )}
          </div>
        )}
      </Modal>

      {/* Modal — ocupação do mês + copiar datas disponíveis */}
      <Modal
        isOpen={ocupacaoAberta}
        onClose={() => setOcupacaoAberta(false)}
        title={t("Ocupação — {mes}", { mes: tituloMesConcreto })}
        subtitle={t("Resumo da ocupação e datas disponíveis pro cliente")}
        maxWidth={560}
      >
        <div className="flex flex-col gap-4">
          {/* Resumo da ocupação */}
          <div className="flex flex-col gap-2.5">
            {ocupacao.length === 0 ? (
              <div className="text-sm text-muted text-center py-2">
                {t("Sem dias no mês.")}
              </div>
            ) : (
              ocupacao.map((row) => {
                const [ocup, total] = row.v;
                const pct = total > 0 ? (ocup / total) * 100 : 0;
                const cheio = ocup === total && total > 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-secondary">{t(row.label)}</span>
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: cheio ? "var(--success)" : "var(--text-primary)" }}
                      >
                        {ocup}/{total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: cheio ? "var(--success)" : "var(--grad-signal)" }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Datas disponíveis pro WhatsApp — um bloco por DJ selecionado */}
          <div className="border-t border-border pt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="stat-label">{t("Lista de datas disponíveis")}</span>
              <div className="pill-group flex-wrap">
                <button
                  type="button"
                  className={`pill ${incluir.sex ? "active" : ""}`}
                  onClick={() => toggleInclui("sex")}
                >
                  {t("Sex")}
                </button>
                <button
                  type="button"
                  className={`pill ${incluir.sab ? "active" : ""}`}
                  onClick={() => toggleInclui("sab")}
                >
                  {t("Sáb")}
                </button>
                <button
                  type="button"
                  className={`pill ${incluir.dom ? "active" : ""}`}
                  onClick={() => toggleInclui("dom")}
                >
                  {t("Dom")}
                </button>
                <button
                  type="button"
                  className={`pill ${incluir.feriado ? "active" : ""}`}
                  onClick={() => toggleInclui("feriado")}
                >
                  {t("Feriados")}
                </button>
              </div>
            </div>
            {artistas.filter((d) => selectedDJs.includes(d.id)).length === 0 ? (
              <div className="text-sm text-muted">{t("Nenhum DJ selecionado.")}</div>
            ) : (
              artistas
                .filter((d) => selectedDJs.includes(d.id))
                .map((dj) => (
                  <div key={dj.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: dj.color }}
                        />
                        {dj.name}
                      </span>
                      <button
                        onClick={() => copiarDatas(dj.id)}
                        className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
                      >
                        {copiado === dj.id ? (
                          <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copiado === dj.id ? t("Copiado!") : t("Copiar")}
                      </button>
                    </div>
                    <pre className="text-xs text-secondary bg-elevated border border-border rounded-md p-3 whitespace-pre-wrap font-sans max-h-[35vh] overflow-y-auto leading-relaxed">
                      {gerarDatasDisponiveis(dj.id)}
                    </pre>
                  </div>
                ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ClickableStat({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left transition-transform hover:-translate-y-0.5 active:translate-y-0 w-full"
    >
      {children}
    </button>
  );
}
