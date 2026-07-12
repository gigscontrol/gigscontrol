"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Settings2,
  X,
  Check,
  Ban,
  PlayCircle,
  PauseCircle,
} from "lucide-react";
import { usePlataforma } from "@/lib/plataforma-context";
import {
  LABELS_STATUS_ASSINATURA,
  type Assinatura,
  type StatusAssinatura,
} from "@/lib/plataforma";
import { getPlano, formatarPreco, type PlanoId } from "@/lib/planos";

/** Centavos → reais/dólares (pagamentos.valor é gravado em centavos). */
function fmtCentavos(centavos: number, moeda: "brl" | "usd"): string {
  return formatarPreco(centavos / 100, moeda);
}

export default function AdminAssinaturas() {
  const { assinaturas, planos, receita } = usePlataforma();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusAssinatura | "todos">(
    "todos"
  );
  const [gerenciando, setGerenciando] = useState<Assinatura | null>(null);

  const lista = useMemo(() => {
    return assinaturas.filter((a) => {
      if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [a.nomeWorkspace, a.responsavel, a.email]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assinaturas, search, filtroStatus]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Assinaturas</h1>
        <p className="text-sm text-muted">
          Gestão de todas as assinaturas dos clientes
        </p>
      </div>

      {receita && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <ReceitaCard
            label="Receita realizada — 30 dias"
            brl={receita.ultimos30dBrl}
            usd={receita.ultimos30dUsd}
          />
          <ReceitaCard
            label="Receita realizada — 12 meses"
            brl={receita.ultimos12mBrl}
            usd={receita.ultimos12mUsd}
          />
          <div className="card">
            <div className="stat-label mb-2">Workspaces com validade futura</div>
            <div className="text-xl font-bold text-primary tabular-nums">
              {receita.workspacesComValidadeFutura}
            </div>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-1.5 flex-1 min-w-[220px]">
            <Search size={14} className="text-muted flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="input text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "ativa", "trial", "suspensa", "cancelada"] as const).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setFiltroStatus(st)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                    filtroStatus === st
                      ? "bg-elevated text-primary font-medium"
                      : "text-muted hover:text-secondary"
                  }`}
                >
                  {st === "todos" ? "Todas" : LABELS_STATUS_ASSINATURA[st].label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/40">
                <Th>Cliente</Th>
                <Th>Plano</Th>
                <Th>Uso</Th>
                <Th>Válido até</Th>
                <Th>Último pagamento</Th>
                <Th>Status</Th>
                <Th className="w-[1%]"></Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => {
                const plano = getPlano(a.plano);
                const st = LABELS_STATUS_ASSINATURA[a.status];
                return (
                  <tr
                    key={a.workspaceId}
                    className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors"
                  >
                    <Td>
                      <div className="font-medium text-primary">
                        {a.nomeWorkspace}
                      </div>
                      <div className="text-xs text-muted">{a.responsavel}</div>
                    </Td>
                    <Td>
                      <div className="text-secondary">{plano.nome}</div>
                      <div className="text-xs text-muted capitalize">
                        {a.ciclo}
                      </div>
                    </Td>
                    <Td className="text-secondary text-xs">
                      {a.artistasEmUso}/{plano.maxArtistas} artistas
                      <br />
                      {a.usuariosEmUso}/{plano.maxUsuariosAdicionais} adicionais
                    </Td>
                    <Td className="tabular-nums text-xs">
                      <div>
                        {a.acessoAte
                          ? new Date(a.acessoAte).toLocaleDateString("pt-BR")
                          : "—"}
                      </div>
                      <div style={{ color: corDias(a.diasRestantes) }}>
                        {fmtDias(a.diasRestantes)}
                      </div>
                    </Td>
                    <Td className="text-xs">
                      {a.ultimoPagamento ? (
                        <>
                          <div className="text-secondary">
                            {new Date(a.ultimoPagamento.data).toLocaleDateString(
                              "pt-BR"
                            )}{" "}
                            ·{" "}
                            {a.ultimoPagamento.valor != null && a.ultimoPagamento.moeda
                              ? fmtCentavos(a.ultimoPagamento.valor, a.ultimoPagamento.moeda)
                              : "—"}
                          </div>
                          <div className="text-muted capitalize">
                            {a.ultimoPagamento.provider}
                            {a.ultimoPagamento.metodo
                              ? ` · ${a.ultimoPagamento.metodo}`
                              : ""}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                    </Td>
                    <Td>
                      <button
                        onClick={() => setGerenciando(a)}
                        className="btn-ghost text-xs inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <Settings2 size={13} />
                        Gerenciar
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {lista.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">
              Nenhuma assinatura encontrada.
            </div>
          )}
        </div>
      </div>

      {gerenciando && (
        <ModalGerenciar
          assinatura={gerenciando}
          onClose={() => setGerenciando(null)}
        />
      )}
    </div>
  );
}

function ModalGerenciar({
  assinatura,
  onClose,
}: {
  assinatura: Assinatura;
  onClose: () => void;
}) {
  const { alterarStatusAssinatura, alterarPlanoAssinatura, planos } =
    usePlataforma();
  const planoAtual = getPlano(assinatura.plano);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-[460px] overflow-hidden"
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
          <div>
            <div className="section-title">{assinatura.nomeWorkspace}</div>
            <div className="text-xs text-muted mt-0.5">
              {assinatura.responsavel} · {assinatura.email}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          <div className="bg-elevated/40 border border-border rounded-md p-3 text-xs text-secondary flex flex-col gap-1">
            <div>
              Válido até:{" "}
              <strong style={{ color: corDias(assinatura.diasRestantes) }}>
                {assinatura.acessoAte
                  ? new Date(assinatura.acessoAte).toLocaleDateString("pt-BR")
                  : "—"}{" "}
                ({fmtDias(assinatura.diasRestantes)})
              </strong>
            </div>
            {assinatura.ultimoPagamento && (
              <div>
                Último pagamento:{" "}
                <strong className="text-primary capitalize">
                  {new Date(assinatura.ultimoPagamento.data).toLocaleDateString(
                    "pt-BR"
                  )}{" "}
                  via {assinatura.ultimoPagamento.provider}
                </strong>
              </div>
            )}
          </div>

          <div>
            <div className="stat-label mb-2">
              Dar dias grátis (soma na validade)
            </div>
            <DarDiasGratis workspaceId={assinatura.workspaceId} />
          </div>

          <div>
            <div className="stat-label mb-2">Status da assinatura</div>
            <div className="grid grid-cols-2 gap-2">
              <BotaoStatus
                ativo={assinatura.status === "ativa"}
                cor="var(--success)"
                icon={<PlayCircle size={14} />}
                label="Reativar"
                onClick={() =>
                  alterarStatusAssinatura(assinatura.workspaceId, "ativa")
                }
              />
              <BotaoStatus
                ativo={assinatura.status === "suspensa"}
                cor="var(--danger)"
                icon={<PauseCircle size={14} />}
                label="Suspender"
                onClick={() =>
                  alterarStatusAssinatura(assinatura.workspaceId, "suspensa")
                }
              />
              <BotaoStatus
                ativo={assinatura.status === "cancelada"}
                cor="var(--text-muted)"
                icon={<Ban size={14} />}
                label="Cancelar"
                onClick={() =>
                  alterarStatusAssinatura(assinatura.workspaceId, "cancelada")
                }
              />
            </div>
          </div>

          <div>
            <div className="stat-label mb-2">Plano</div>
            <div className="flex flex-col gap-1.5">
              {planos.map((p) => {
                const atual = p.id === assinatura.plano;
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      alterarPlanoAssinatura(
                        assinatura.workspaceId,
                        p.id as PlanoId
                      )
                    }
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border transition-colors text-left"
                    style={{
                      borderColor: atual
                        ? "var(--brand)"
                        : "var(--border-color)",
                      backgroundColor: atual
                        ? "var(--bg-elevated)"
                        : "transparent",
                    }}
                  >
                    <div>
                      <div className="text-sm font-medium text-primary">
                        {p.nome}
                      </div>
                      <div className="text-xs text-muted">
                        {p.maxArtistas} artistas · {p.maxUsuariosAdicionais} usuários
                      </div>
                    </div>
                    {atual && (
                      <Check size={15} style={{ color: "var(--brand)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-elevated/40 border border-border rounded-md p-3 text-xs text-secondary">
            Plano atual:{" "}
            <strong className="text-primary">{planoAtual.nome}</strong> · ciclo{" "}
            <span className="capitalize">{assinatura.ciclo}</span>.
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="btn btn-primary text-sm">
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

function DarDiasGratis({ workspaceId }: { workspaceId: string }) {
  const { estenderDiasAssinatura } = usePlataforma();
  const [agindo, setAgindo] = useState<number | null>(null);
  const [diasCustom, setDiasCustom] = useState("");

  async function darDias(dias: number) {
    if (agindo || !dias || dias <= 0) return;
    setAgindo(dias);
    try {
      await estenderDiasAssinatura(workspaceId, dias);
    } finally {
      setAgindo(null);
      setDiasCustom("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {[7, 15, 30].map((d) => (
        <button
          key={d}
          onClick={() => void darDias(d)}
          disabled={!!agindo}
          className="btn btn-secondary text-sm disabled:opacity-50"
        >
          {agindo === d ? "…" : `+${d} dias`}
        </button>
      ))}
      <input
        type="number"
        min={1}
        max={365}
        value={diasCustom}
        onChange={(e) => setDiasCustom(e.target.value)}
        placeholder="nº"
        className="w-20 bg-elevated border border-border rounded-md px-2 py-1.5 text-sm text-primary outline-none focus:border-border-strong"
      />
      <button
        onClick={() => void darDias(parseInt(diasCustom, 10))}
        disabled={!!agindo || !diasCustom}
        className="btn btn-secondary text-sm disabled:opacity-50"
      >
        Aplicar
      </button>
    </div>
  );
}

function ReceitaCard({
  label,
  brl,
  usd,
}: {
  label: string;
  brl: number;
  usd: number;
}) {
  return (
    <div className="card">
      <div className="stat-label mb-2">{label}</div>
      <div className="text-xl font-bold text-primary tabular-nums">
        {fmtCentavos(brl, "brl")}
      </div>
      {usd > 0 && (
        <div className="text-sm text-muted tabular-nums mt-0.5">
          + {fmtCentavos(usd, "usd")}
        </div>
      )}
    </div>
  );
}

function fmtDias(d: number | null | undefined): string {
  if (d == null) return "sem validade";
  if (d < 0) return `expirado há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`;
  if (d === 0) return "expira hoje";
  return `${d} dia${d === 1 ? "" : "s"} restante${d === 1 ? "" : "s"}`;
}
function corDias(d: number | null | undefined): string {
  if (d == null) return "var(--text-muted)";
  if (d < 0) return "var(--danger)";
  if (d <= 3) return "var(--warning)";
  return "var(--text-secondary)";
}

function BotaoStatus({
  ativo,
  cor,
  icon,
  label,
  onClick,
}: {
  ativo: boolean;
  cor: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors"
      style={{
        borderColor: ativo ? cor : "var(--border-color)",
        backgroundColor: ativo ? `${cor}1a` : "transparent",
        color: ativo ? cor : "var(--text-secondary)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-3 stat-label font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
