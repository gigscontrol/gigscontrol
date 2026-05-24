"use client";

import { useMemo } from "react";
import {
  Music,
  Clock,
  Users,
  MapPin,
  CalendarRange,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import { useShows } from "@/lib/shows-context";
import { useContatos } from "@/lib/contatos-context";
import { DJS } from "@/lib/djs";
import { formatBRL } from "@/lib/whatsapp";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage } from "@/types";

type Props = {
  selectedDJs: string[];
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  onAbrirShow?: (showId: string) => void;
};

export default function AgendaDashboard({ selectedDJs, onNavigate, onAbrirShow }: Props) {
  const accent = MODULE_THEMES.agenda.color;
  const { shows } = useShows();
  const { cidades } = useContatos();

  // Considera só DJs selecionados na sidebar (uuid após Etapa 7).
  const showsVisiveis = useMemo(
    () => shows.filter((s) => selectedDJs.includes(s.djId)),
    [shows, selectedDJs]
  );

  const stats = useMemo(() => {
    const confirmados = showsVisiveis.filter((s) => s.status === "confirmado").length;
    const pendentes = showsVisiveis.filter((s) => s.status === "pendente").length;
    const logistica = showsVisiveis.filter((s) => s.status === "logistica").length;
    const djsEscalados = new Set(showsVisiveis.map((s) => s.djId)).size;
    const pracas = new Set(showsVisiveis.map((s) => s.cidadeId).filter(Boolean)).size;
    const valorTotal = showsVisiveis.reduce((acc, s) => acc + (s.valor ?? 0), 0);
    return { confirmados, pendentes, logistica, djsEscalados, pracas, valorTotal };
  }, [showsVisiveis]);

  // Shows ordenados por dia (próximos)
  const proximosShows = useMemo(() => {
    return [...showsVisiveis]
      .sort((a, b) => (a.dayId || 999) - (b.dayId || 999))
      .slice(0, 6);
  }, [showsVisiveis]);

  // Distribuição por DJ
  const porDJ = useMemo(() => {
    return DJS.filter((d) => selectedDJs.includes(d.id)).map((dj) => ({
      dj,
      total: showsVisiveis.filter((s) => s.djId === dj.id).length,
    }));
  }, [showsVisiveis, selectedDJs]);

  const maxPorDJ = Math.max(1, ...porDJ.map((p) => p.total));

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Agenda"
        subtitle="Visão geral dos shows e da escala"
        accentColor={accent}
        actions={
          <button
            onClick={() => onNavigate?.("agenda", "agenda-completa")}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <CalendarRange size={14} />
            Abrir Agenda de Shows
          </button>
        }
      />

      {/* Cards — clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <ClickableStat onClick={() => onNavigate?.("agenda", "agenda-completa")}>
          <StatCard
            title="Shows Confirmados"
            value={stats.confirmados}
            icon={<Music size={16} />}
            accentColor={accent}
            subtitle="Toque para ver a escala"
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("agenda", "agenda-completa")}>
          <StatCard
            title="Aguardando Contrato"
            value={stats.pendentes}
            icon={<Clock size={16} />}
            accentColor="var(--warning)"
            subtitle="Datas pendentes"
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("agenda", "agenda-completa")}>
          <StatCard
            title="DJs Escalados"
            value={`${stats.djsEscalados}/${DJS.length}`}
            icon={<Users size={16} />}
            accentColor={accent}
            subtitle="Artistas com shows"
          />
        </ClickableStat>
        <ClickableStat onClick={() => onNavigate?.("agenda", "agenda-completa")}>
          <StatCard
            title="Praças"
            value={stats.pracas}
            icon={<MapPin size={16} />}
            accentColor={accent}
            subtitle="Cidades diferentes"
          />
        </ClickableStat>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Próximos shows — clicáveis */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">Próximos shows</div>
            <button
              onClick={() => onNavigate?.("agenda", "agenda-completa")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              Ver todos
              <ChevronRight size={12} />
            </button>
          </div>

          {proximosShows.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              Nenhum show agendado para os DJs selecionados.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {proximosShows.map((show) => {
                const dj = DJS.find((d) => d.id === show.djId);
                const cidade = cidades.find((c) => String(c.id) === show.cidadeId);
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
                        {show.venue || "Local a definir"}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {dj?.name} ·{" "}
                        {cidade ? `${cidade.nome}/${cidade.estado}` : show.location}
                        {" · "}
                        {show.dayId ? `dia ${show.dayId}` : ""}
                        {" · "}
                        {show.time}
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
                      {show.status}
                    </span>
                    <ChevronRight size={14} className="text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Shows por DJ */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: accent }} />
            <div className="section-title">Shows por DJ</div>
          </div>
          <div className="flex flex-col gap-3">
            {porDJ.map(({ dj, total }) => (
              <div key={dj.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-primary">{dj.name}</span>
                  <span className="tabular-nums text-secondary">{total}</span>
                </div>
                <div className="h-2 rounded-full bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(total / maxPorDJ) * 100}%`,
                      backgroundColor: dj.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-border">
            <div className="stat-label mb-1">Valor total em shows</div>
            <div className="text-2xl font-bold tabular-nums text-primary">
              {formatBRL(stats.valorTotal)}
            </div>
          </div>
        </div>
      </div>
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
      className="text-left transition-transform hover:-translate-y-0.5 active:translate-y-0"
    >
      {children}
    </button>
  );
}
