"use client";

import { useMemo } from "react";
import {
  FileText,
  FileSignature,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import PageHeader from "../PageHeader";
import { useContratos } from "@/lib/contratos-context";
import type { Contrato, ContratoStatus } from "@/lib/mappers/contrato";

const ACCENT = "var(--module-contratos)";

/** Rótulo + classe de badge por status (espelha as cores pedidas). */
const STATUS_INFO: Record<
  ContratoStatus,
  { label: string; badge: string; color: string }
> = {
  rascunho: { label: "Rascunho", badge: "badge-neutral", color: "var(--text-secondary)" },
  enviado: { label: "Enviado", badge: "badge-info", color: "var(--info)" },
  assinado: { label: "Assinado", badge: "badge-success", color: "var(--success)" },
  cancelado: { label: "Cancelado", badge: "badge-danger", color: "var(--danger)" },
};

/** Ordem dos cards de status (rascunho → enviado → assinado → cancelado). */
const STATUS_ORDEM: ContratoStatus[] = [
  "rascunho",
  "enviado",
  "assinado",
  "cancelado",
];

/** Formata uma data ISO em DD/MM/AAAA; "—" se ausente/ inválida. */
function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Card de estatística (Total + um por status). */
function StatCard({
  label,
  valor,
  cor,
  icon,
}: {
  label: string;
  valor: number;
  cor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card flex items-center gap-4">
      <div
        className="h-11 w-11 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${cor}1A`, color: cor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="stat-value leading-none">{valor}</div>
        <div className="stat-label mt-1.5">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardContratos() {
  const { contratos, carregando, erro } = useContratos();

  // Total + contagem por status, em uma única passada.
  const { total, porStatus } = useMemo(() => {
    const contagem: Record<ContratoStatus, number> = {
      rascunho: 0,
      enviado: 0,
      assinado: 0,
      cancelado: 0,
    };
    for (const c of contratos) contagem[c.status] += 1;
    return { total: contratos.length, porStatus: contagem };
  }, [contratos]);

  // Últimos 5 por criadoEm desc (não muta o array do contexto).
  const recentes = useMemo<Contrato[]>(
    () =>
      [...contratos]
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .slice(0, 5),
    [contratos]
  );

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader title="Contratos" subtitle="Visão geral" accentColor={ACCENT} />

      {carregando ? (
        <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          Carregando contratos...
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
          <div className="section-title mb-1">Nenhum contrato ainda</div>
          <div className="section-subtitle">
            Gere o primeiro em Novo Contrato.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Cards de estatística: Total + um por status */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Total"
              valor={total}
              cor={ACCENT}
              icon={<FileText size={20} />}
            />
            <StatCard
              label={STATUS_INFO.rascunho.label}
              valor={porStatus.rascunho}
              cor={STATUS_INFO.rascunho.color}
              icon={<FileSignature size={20} />}
            />
            <StatCard
              label={STATUS_INFO.enviado.label}
              valor={porStatus.enviado}
              cor={STATUS_INFO.enviado.color}
              icon={<Send size={20} />}
            />
            <StatCard
              label={STATUS_INFO.assinado.label}
              valor={porStatus.assinado}
              cor={STATUS_INFO.assinado.color}
              icon={<CheckCircle2 size={20} />}
            />
            <StatCard
              label={STATUS_INFO.cancelado.label}
              valor={porStatus.cancelado}
              cor={STATUS_INFO.cancelado.color}
              icon={<XCircle size={20} />}
            />
          </div>

          {/* Contratos recentes */}
          <div>
            <div className="stat-label mb-3">Contratos recentes</div>
            <div className="card p-0 overflow-hidden">
              <ul className="divide-y divide-border">
                {recentes.map((c) => {
                  const info = STATUS_INFO[c.status];
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
                        >
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="section-title truncate" title={c.numero}>
                            {c.numero}
                          </div>
                          <div className="section-subtitle">
                            Emissão: {formatarData(c.dataEmissao)}
                          </div>
                        </div>
                      </div>
                      <span className={`badge ${info.badge} flex-shrink-0`}>
                        {info.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
