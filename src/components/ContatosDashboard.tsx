"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import {
  Users,
  Building2,
  MapPin,
  ChevronRight,
  UserPlus,
  TrendingUp,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import { useContatos } from "@/lib/contatos-context";
import { useShows } from "@/lib/shows-context";
import { useVendas } from "@/lib/vendas-context";
import { formatBRL } from "@/lib/whatsapp";
import { MODULE_THEMES } from "@/types";
import type { ContatoCategoria } from "@/types";

type Props = {
  /** Abre a aba de Contatos numa categoria específica */
  onAbrirCategoria?: (cat: ContatoCategoria) => void;
};

export default function ContatosDashboard({ onAbrirCategoria }: Props) {
  const t = useT();
  const accent = MODULE_THEMES.contatos.color;
  const { contratantes, casas, cidades } = useContatos();
  const { shows } = useShows();
  const { vendas } = useVendas();

  // Ranking de contratantes por número de shows / faturamento
  const rankingContratantes = useMemo(() => {
    return contratantes
      .map((c) => {
        const showsDoContratante = shows.filter((s) => s.contratanteId === c.id);
        const vendasDoContratante = vendas.filter((v) => v.contratanteId === c.id);
        const faturamento = vendasDoContratante.reduce((acc, v) => acc + v.cache, 0);
        return {
          contratante: c,
          totalShows: showsDoContratante.length,
          totalVendas: vendasDoContratante.length,
          faturamento,
        };
      })
      .sort((a, b) => b.faturamento - a.faturamento || b.totalShows - a.totalShows)
      .slice(0, 5);
  }, [contratantes, shows, vendas]);

  // Ranking de casas por shows
  const rankingCasas = useMemo(() => {
    return casas
      .map((casa) => ({
        casa,
        totalShows: shows.filter((s) => s.casaId === casa.id).length,
      }))
      .sort((a, b) => b.totalShows - a.totalShows)
      .slice(0, 5);
  }, [casas, shows]);

  // Cidades com mais shows
  const cidadesAtivas = useMemo(() => {
    const ativas = new Set(shows.map((s) => s.cidadeId).filter(Boolean));
    return ativas.size;
  }, [shows]);

  const maxFat = Math.max(1, ...rankingContratantes.map((r) => r.faturamento));

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Contatos"
        subtitle="Contratantes, casas e cidades da agência"
        accentColor={accent}
        actions={
          <button
            onClick={() => onAbrirCategoria?.("contratantes")}
            className="btn btn-primary"
          >
            <UserPlus size={14} />
            {t("Gerenciar Contatos")}
          </button>
        }
      />

      {/* Cards clicáveis — cada um abre a categoria */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <ClickableStat onClick={() => onAbrirCategoria?.("contratantes")}>
          <StatCard
            title={t("Contratantes")}
            value={contratantes.length}
            icon={<Users size={16} />}
            accentColor={accent}
            subtitle={t("Toque para gerenciar")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => onAbrirCategoria?.("casas")}>
          <StatCard
            title={t("Casas / Locais")}
            value={casas.length}
            icon={<Building2 size={16} />}
            accentColor={accent}
            subtitle={t("Clubs, festivais, bares")}
          />
        </ClickableStat>
        <ClickableStat onClick={() => onAbrirCategoria?.("cidades")}>
          <StatCard
            title={t("Cidades")}
            value={cidades.length}
            icon={<MapPin size={16} />}
            accentColor={accent}
            subtitle={t("{n} com shows", { n: cidadesAtivas })}
          />
        </ClickableStat>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top contratantes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} style={{ color: accent }} />
              <div className="section-title">{t("Principais contratantes")}</div>
            </div>
            <button
              onClick={() => onAbrirCategoria?.("contratantes")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver todos")}
              <ChevronRight size={12} />
            </button>
          </div>

          {rankingContratantes.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Nenhum contratante cadastrado.")}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rankingContratantes.map((r) => (
                <button
                  key={r.contratante.id}
                  onClick={() => onAbrirCategoria?.("contratantes")}
                  className="text-left"
                >
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-primary truncate">
                      {r.contratante.nome}
                    </span>
                    <span className="tabular-nums text-secondary flex-shrink-0 ml-2">
                      {r.faturamento > 0 ? formatBRL(r.faturamento) : "—"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(r.faturamento / maxFat) * 100}%`,
                        background: "var(--grad-signal)",
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {r.totalShows} {r.totalShows === 1 ? t("show") : t("shows")} ·{" "}
                    {r.totalVendas} {r.totalVendas === 1 ? t("venda") : t("vendas")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top casas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} style={{ color: accent }} />
              <div className="section-title">{t("Casas mais usadas")}</div>
            </div>
            <button
              onClick={() => onAbrirCategoria?.("casas")}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              {t("Ver todas")}
              <ChevronRight size={12} />
            </button>
          </div>

          {rankingCasas.length === 0 ? (
            <div className="text-sm text-muted text-center py-8">
              {t("Nenhuma casa cadastrada.")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {rankingCasas.map((r) => {
                const cidade = cidades.find((c) => c.id === r.casa.cidadeId);
                return (
                  <button
                    key={r.casa.id}
                    onClick={() => onAbrirCategoria?.("casas")}
                    className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
                  >
                    <div
                      className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accent}20`, color: accent }}
                    >
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {r.casa.nome}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {cidade ? `${cidade.nome}/${cidade.estado}` : "—"}
                        {r.casa.capacidade
                          ? ` · ${r.casa.capacidade.toLocaleString("pt-BR")} ${t("pessoas")}`
                          : ""}
                      </div>
                    </div>
                    <span className="text-xs text-secondary tabular-nums flex-shrink-0">
                      {r.totalShows} {r.totalShows === 1 ? t("show") : t("shows")}
                    </span>
                    <ChevronRight size={14} className="text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <AtalhoCard
          icon={<Users size={16} />}
          label={t("Novo contratante")}
          accent={accent}
          onClick={() => onAbrirCategoria?.("contratantes")}
        />
        <AtalhoCard
          icon={<Building2 size={16} />}
          label={t("Nova casa")}
          accent={accent}
          onClick={() => onAbrirCategoria?.("casas")}
        />
        <AtalhoCard
          icon={<MapPin size={16} />}
          label={t("Nova cidade")}
          accent={accent}
          onClick={() => onAbrirCategoria?.("cidades")}
        />
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

function AtalhoCard({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-interactive flex items-center gap-3"
    >
      <div
        className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}20`, color: accent }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium text-primary flex-1 text-left">
        {label}
      </span>
      <ChevronRight size={14} className="text-muted" />
    </button>
  );
}
