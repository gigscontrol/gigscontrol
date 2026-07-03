"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  FileText,
  FileSignature,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import PageHeader from "../PageHeader";
import StatCard from "../StatCard";
import Modal from "../Modal";
import { useContratos } from "@/lib/contratos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import type { Contrato, ContratoStatus } from "@/lib/mappers/contrato";
import { descreverContrato, formatarDataCurta } from "@/lib/contratoTitulo";
import { useT } from "@/lib/i18n";
import { MODULE_THEMES } from "@/types";
import type { ActiveTab, ActivePage } from "@/types";

const ACCENT = MODULE_THEMES.contratos.color;

/** Rótulo + classe de badge + cor por status. */
const STATUS_INFO: Record<
  ContratoStatus,
  { label: string; badge: string; color: string }
> = {
  rascunho: { label: "Rascunho", badge: "badge-neutral", color: "var(--text-muted)" },
  enviado: { label: "Enviado", badge: "badge-info", color: "var(--info)" },
  assinado: { label: "Assinado", badge: "badge-success", color: "var(--success)" },
  cancelado: { label: "Cancelado", badge: "badge-danger", color: "var(--danger)" },
};

const STATUS_ORDEM: ContratoStatus[] = ["rascunho", "enviado", "assinado", "cancelado"];

/** Ícone por status (usado nos cards). */
const STATUS_ICON: Record<ContratoStatus, ReactNode> = {
  rascunho: <FileSignature size={16} />,
  enviado: <Send size={16} />,
  assinado: <CheckCircle2 size={16} />,
  cancelado: <XCircle size={16} />,
};

/** Qual card está aberto no modal de resumo (null = fechado). */
type Resumo = null | "total" | ContratoStatus;

type Props = {
  onNavigate?: (tab: ActiveTab, page: ActivePage) => void;
  /** Abre o histórico filtrado por um status (null = todos). */
  onVerStatus?: (status: ContratoStatus | null) => void;
  /** Abre um contrato específico no histórico. */
  onAbrirContrato?: (id: string) => void;
};

export default function DashboardContratos({
  onNavigate,
  onVerStatus,
  onAbrirContrato,
}: Props) {
  const t = useT();
  const { contratos, carregando, erro } = useContratos();
  const { vendas } = useVendas();
  const artistas = useArtistas();
  const { podeUI } = useAuth();
  const [resumo, setResumo] = useState<Resumo>(null);

  // "Novo Contrato" não fixa artista (é escolhido no wizard) → habilita se
  // o usuário PODE criar contrato em algum artista.
  const podeCriar = artistas.some((a) => podeUI(a.id, "contratos.criar"));

  // Total + contagem por status + a lista (ordenada) por status.
  const { total, porStatus, listaPorStatus } = useMemo(() => {
    const contagem: Record<ContratoStatus, number> = {
      rascunho: 0,
      enviado: 0,
      assinado: 0,
      cancelado: 0,
    };
    const lista: Record<ContratoStatus, Contrato[]> = {
      rascunho: [],
      enviado: [],
      assinado: [],
      cancelado: [],
    };
    const ordenados = [...contratos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    for (const c of ordenados) {
      contagem[c.status] += 1;
      lista[c.status].push(c);
    }
    return { total: contratos.length, porStatus: contagem, listaPorStatus: lista };
  }, [contratos]);

  // Últimos 5 (qualquer status) por criadoEm desc.
  const recentes = useMemo<Contrato[]>(
    () =>
      [...contratos]
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .slice(0, 5),
    [contratos]
  );

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Contratos"
        subtitle={t("Visão geral")}
        accentColor={ACCENT}
        actions={
          <button
            onClick={() => onNavigate?.("contratos", "contratos-novo")}
            disabled={!podeCriar}
            title={!podeCriar ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: ACCENT, color: "#fff" }}
          >
            <Plus size={14} />
            {t("Novo Contrato")}
          </button>
        }
      />

      {carregando ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando contratos...")}
        </div>
      ) : erro ? (
        <div className="card flex items-center justify-center py-12 text-center text-sm text-danger">
          {erro}
        </div>
      ) : total === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
            <FileText size={18} className="text-muted" />
          </div>
          <div className="section-title mb-1">{t("Nenhum contrato ainda")}</div>
          <div className="section-subtitle mb-4">
            {t("Gere o primeiro em Novo Contrato.")}
          </div>
          <button
            onClick={() => onNavigate?.("contratos", "contratos-novo")}
            disabled={!podeCriar}
            title={!podeCriar ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: ACCENT, color: "#fff" }}
          >
            <Plus size={14} />
            {t("Novo Contrato")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Cards de estatística clicáveis → abrem o resumo (modal) */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
            <ClickableStat onClick={() => setResumo("total")}>
              <StatCard
                title={t("Total")}
                value={total}
                icon={<FileText size={16} />}
                accentColor={ACCENT}
                subtitle={t("Ver resumo")}
              />
            </ClickableStat>
            {STATUS_ORDEM.map((s) => {
              const info = STATUS_INFO[s];
              return (
                <ClickableStat key={s} onClick={() => setResumo(s)}>
                  <StatCard
                    title={t(info.label)}
                    value={porStatus[s]}
                    icon={STATUS_ICON[s]}
                    accentColor={info.color}
                    subtitle={t("Ver resumo")}
                  />
                </ClickableStat>
              );
            })}
          </div>

          {/* Contratos recentes */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="section-title">{t("Contratos recentes")}</div>
              <button
                onClick={() => onNavigate?.("contratos", "contratos-historico")}
                className="btn-ghost text-xs inline-flex items-center gap-1"
              >
                {t("Ver todos")}
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {recentes.map((c) => (
                <LinhaContrato
                  key={c.id}
                  contrato={c}
                  desc={descreverContrato(c, vendas, artistas)}
                  onClick={() => onAbrirContrato?.(c.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de resumo — aberto pelos cards (visualizador na mesma página) */}
      <Modal
        isOpen={resumo !== null}
        onClose={() => setResumo(null)}
        title={
          resumo === "total"
            ? t("Resumo de contratos")
            : resumo
              ? t(STATUS_INFO[resumo].label)
              : ""
        }
        subtitle={resumo === "total" ? t("Todos os contratos") : undefined}
      >
        {resumo === "total" ? (
          <div className="flex flex-col gap-4">
            <ResumoNumero label={t("Total")} value={String(total)} color={ACCENT} />
            <div className="flex flex-col gap-2">
              <div className="stat-label">{t("Por status")}</div>
              {STATUS_ORDEM.map((s) => (
                <ResumoLinha
                  key={s}
                  onClick={() => setResumo(s)}
                  left={<span className={`badge ${STATUS_INFO[s].badge}`}>{t(STATUS_INFO[s].label)}</span>}
                  right={porStatus[s]}
                />
              ))}
            </div>
            <ResumoFooter
              onClick={() => {
                setResumo(null);
                onVerStatus?.(null);
              }}
            >
              {t("Ver todos no histórico")}
            </ResumoFooter>
          </div>
        ) : resumo ? (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setResumo("total")}
              className="btn-ghost text-xs inline-flex items-center gap-1 self-start"
            >
              <ChevronLeft size={12} />
              {t("Resumo")}
            </button>
            <ResumoNumero
              label={t(STATUS_INFO[resumo].label)}
              value={String(porStatus[resumo])}
              color={STATUS_INFO[resumo].color === "var(--text-muted)" ? undefined : STATUS_INFO[resumo].color}
            />
            {porStatus[resumo] === 0 ? (
              <div className="text-sm text-muted text-center py-6">
                {t("Nenhum contrato com esse status.")}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {listaPorStatus[resumo].slice(0, 5).map((c) => (
                  <LinhaContrato
                    key={c.id}
                    contrato={c}
                    desc={descreverContrato(c, vendas, artistas)}
                    semBadge
                    onClick={() => {
                      setResumo(null);
                      onAbrirContrato?.(c.id);
                    }}
                  />
                ))}
              </div>
            )}
            <ResumoFooter
              onClick={() => {
                const s = resumo;
                setResumo(null);
                onVerStatus?.(s);
              }}
            >
              {t("Ver no histórico")}
            </ResumoFooter>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/** Linha de um contrato (numero + emissão + badge), clicável. */
function LinhaContrato({
  contrato,
  desc,
  onClick,
  semBadge,
}: {
  contrato: Contrato;
  desc: ReturnType<typeof descreverContrato>;
  onClick: () => void;
  semBadge?: boolean;
}) {
  const t = useT();
  const info = STATUS_INFO[contrato.status];
  const partes: string[] = [];
  if (desc.artista) partes.push(desc.artista);
  if (desc.temEvento) partes.push(desc.numero);
  partes.push(formatarDataCurta(desc.data));
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left w-full"
    >
      <div
        className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `color-mix(in srgb, ${ACCENT} 13%, transparent)`,
          color: ACCENT,
        }}
      >
        <FileText size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary truncate" title={desc.titulo}>
          {desc.titulo}
        </div>
        <div className="text-xs text-muted truncate">{partes.join(" · ")}</div>
      </div>
      {!semBadge && (
        <span className={`badge ${info.badge} flex-shrink-0`}>{t(info.label)}</span>
      )}
      <ChevronRight size={14} className="text-muted flex-shrink-0" />
    </button>
  );
}

/** Envolve um StatCard num botão com leve elevação no hover (padrão do app). */
function ClickableStat({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
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

/** Número grande dentro do resumo (label + valor). */
function ResumoNumero({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-elevated p-3">
      <div className="stat-label">{label}</div>
      <div
        className={`text-2xl font-bold tabular-nums ${color ? "" : "text-primary"}`}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

/** Linha label → valor dentro do resumo. Clicável quando recebe onClick. */
function ResumoLinha({
  left,
  right,
  onClick,
}: {
  left: ReactNode;
  right: ReactNode;
  onClick?: () => void;
}) {
  const base =
    "flex items-center justify-between gap-3 p-2.5 rounded-md border border-border bg-elevated";
  if (!onClick) {
    return (
      <div className={base}>
        <div className="text-sm text-secondary min-w-0">{left}</div>
        <div className="text-sm font-semibold tabular-nums flex-shrink-0 text-primary">
          {right}
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`${base} w-full text-left hover:border-border-strong transition-colors`}
    >
      <div className="text-sm text-secondary min-w-0">{left}</div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-semibold tabular-nums text-primary">{right}</span>
        <ChevronRight size={14} className="text-muted" />
      </div>
    </button>
  );
}

/** Botão de rodapé do resumo que leva ao histórico. */
function ResumoFooter({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full inline-flex items-center justify-center gap-1.5 p-2.5 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-sm font-medium text-primary mt-1"
    >
      {children}
      <ChevronRight size={14} />
    </button>
  );
}
