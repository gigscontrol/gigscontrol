"use client";

import { useEffect, useState } from "react";
import {
  History,
  Music,
  Users,
  ShoppingBag,
  FileText,
  Wallet,
  CalendarClock,
  UserCircle,
  Palette,
  Trash2,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace-context";
import type { HistoricoAcao, ModuloHistorico } from "@/lib/mappers/historico";
import PageHeader from "../PageHeader";
import StatCard from "../StatCard";

/**
 * Dashboard do módulo Agência — visão geral de artistas/equipe + o feed de
 * "Últimas ações" do workspace (fonte: /api/historico, admin-only). É o que
 * substituiu o "Em construção" da aba Dashboard da Agência.
 */

/** Ícone + cor por módulo, pro card "Últimas ações". */
const MODULO_HISTORICO: Record<
  ModuloHistorico,
  { icon: typeof History; cor: string }
> = {
  venda: { icon: ShoppingBag, cor: "var(--brand)" },
  orcamento: { icon: FileText, cor: "var(--brand)" },
  parcela: { icon: Wallet, cor: "var(--success)" },
  show: { icon: CalendarClock, cor: "var(--brand)" },
  artista: { icon: Music, cor: "var(--brand)" },
  equipe: { icon: Users, cor: "var(--warning)" },
  contato: { icon: UserCircle, cor: "var(--brand)" },
  aparencia: { icon: Palette, cor: "var(--brand)" },
  lixeira: { icon: Trash2, cor: "var(--text-muted)" },
};

export default function AgenciaDashboard() {
  const t = useT();
  const { artistas, equipe } = useWorkspace();
  const accent = "var(--brand)";

  const [acoes, setAcoes] = useState<HistoricoAcao[]>([]);
  const [carregandoAcoes, setCarregandoAcoes] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch("/api/historico?limit=10", {
          credentials: "include",
        });
        if (!res.ok) {
          if (ativo) setAcoes([]);
          return;
        }
        const data = (await res.json()) as { historico?: HistoricoAcao[] };
        if (ativo) setAcoes(Array.isArray(data.historico) ? data.historico : []);
      } catch {
        if (ativo) setAcoes([]);
      } finally {
        if (ativo) setCarregandoAcoes(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Agência"
        subtitle="Visão geral dos seus artistas, equipe e atividade recente."
      />

      <div className="grid grid-cols-2 gap-4 mt-2">
        <StatCard
          title={t("Artistas")}
          value={artistas.length}
          icon={<Music size={15} />}
          accentColor={accent}
        />
        <StatCard
          title={t("Equipe")}
          value={equipe.length}
          icon={<Users size={15} />}
          accentColor="var(--warning)"
        />
      </div>

      {/* Últimas ações do workspace (artistas / equipe / etc.) */}
      <div className="card mt-4">
        <div className="flex items-center gap-2 mb-4">
          <History size={16} style={{ color: accent }} />
          <div className="section-title">{t("Últimas ações")}</div>
        </div>

        {carregandoAcoes ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <span className="h-8 w-8 rounded-md bg-elevated animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <span className="h-3 w-2/3 rounded bg-elevated animate-pulse" />
                  <span className="h-2.5 w-1/3 rounded bg-elevated animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : acoes.length === 0 ? (
          <div className="text-sm text-muted text-center py-8">
            {t("Nenhuma ação recente ainda.")}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {acoes.map((acao) => {
              const info = MODULO_HISTORICO[acao.modulo] ?? {
                icon: History,
                cor: "var(--text-muted)",
              };
              const Icon = info.icon;
              return (
                <div key={acao.id} className="flex items-start gap-3 p-2 rounded-md">
                  <span
                    className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${info.cor} 11%, transparent)`,
                      color: info.cor,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-primary">{acao.descricao}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted">
                      <span className="truncate">
                        {acao.actorNome ?? acao.actorEmail ?? t("Sistema")}
                      </span>
                      <span>·</span>
                      <span className="flex-shrink-0">
                        {tempoRelativo(acao.criadoEm, t)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Tempo relativo curto: "agora há pouco", "há 5 min", "há 2h", "há 3 dias" ou data. */
function tempoRelativo(
  iso: string,
  t: (s: string, p?: Record<string, string | number>) => string
): string {
  const data = new Date(iso);
  const diffMs = Date.now() - data.getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return t("agora há pouco");
  if (minutos < 60) return t("há {n} min", { n: minutos });
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return t("há {n}h", { n: horas });
  const dias = Math.floor(horas / 24);
  if (dias < 7) return t("há {n} dia{s}", { n: dias, s: dias === 1 ? "" : "s" });
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
