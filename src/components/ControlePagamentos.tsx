"use client";

import { useMemo, useState } from "react";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wallet,
  CalendarClock,
  Undo2,
  DollarSign,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import { useVendas } from "@/lib/vendas-context";
import { useAuth } from "@/lib/auth-context";
import { useArtistas } from "@/lib/workspace-context";
import { formatBRL } from "@/lib/whatsapp";
import {
  LABELS_STATUS_PARCELA,
  statusEfetivoParcela,
  type StatusParcela,
  type Parcela,
} from "@/types";
import { useT } from "@/lib/i18n";

/** Linha achatada: uma parcela + dados da venda dona */
type LinhaParcela = {
  vendaId: string;
  vendaNumero: string;
  parcela: Parcela;
  indiceParcela: number;
  totalParcelas: number;
  djNome: string;
  djColor: string;
  contratante: string;
  nomeEvento: string;
  status: StatusParcela;
};

export default function ControlePagamentos() {
  const t = useT();
  const accent = "var(--brand)";
  const { vendas, atualizarParcela } = useVendas();
  const { modoVisitante } = useAuth();
  const artistas = useArtistas();

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | "todos">("todos");

  // Achata todas as parcelas de todas as vendas
  const todasParcelas = useMemo<LinhaParcela[]>(() => {
    const linhas: LinhaParcela[] = [];
    for (const v of vendas) {
      const dj = artistas.find((d) => d.id === v.djId);
      v.parcelas.forEach((parcela, idx) => {
        linhas.push({
          vendaId: v.id,
          vendaNumero: v.numero,
          parcela,
          indiceParcela: idx + 1,
          totalParcelas: v.parcelas.length,
          djNome: dj?.name ?? "—",
          djColor: dj?.color ?? "#888",
          contratante: v.contratanteNome,
          nomeEvento: v.nomeEvento,
          status: statusEfetivoParcela(parcela),
        });
      });
    }
    // Ordena por data de vencimento
    return linhas.sort(
      (a, b) =>
        new Date(a.parcela.dataVencimento).getTime() -
        new Date(b.parcela.dataVencimento).getTime()
    );
  }, [vendas, artistas]);

  // Totais
  const totais = useMemo(() => {
    let recebido = 0;
    let aReceber = 0;
    let atrasado = 0;
    for (const l of todasParcelas) {
      if (l.status === "pago") recebido += l.parcela.valor;
      else if (l.status === "atrasado") atrasado += l.parcela.valor;
      else aReceber += l.parcela.valor;
    }
    return { recebido, aReceber, atrasado, total: recebido + aReceber + atrasado };
  }, [todasParcelas]);

  // Filtro
  const lista = useMemo(() => {
    return todasParcelas.filter((l) => {
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          l.vendaNumero,
          l.contratante,
          l.nomeEvento,
          l.djNome,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [todasParcelas, filtroStatus, search]);

  function marcarPago(l: LinhaParcela) {
    const hoje = new Date().toISOString().split("T")[0];
    atualizarParcela(l.vendaId, l.parcela.id, {
      statusBase: "pago",
      dataPagamento: hoje,
    });
  }

  function desfazerPago(l: LinhaParcela) {
    atualizarParcela(l.vendaId, l.parcela.id, {
      statusBase: "pendente",
      dataPagamento: undefined,
    });
  }

  const contadores = useMemo(() => {
    const c = { pago: 0, pendente: 0, atrasado: 0 };
    todasParcelas.forEach((l) => c[l.status]++);
    return c;
  }, [todasParcelas]);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Controle de Pagamentos"
        subtitle="Todas as parcelas de todas as vendas — datas, valores e status"
        accentColor={accent}
      />


      {/* Cards de totais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title={t("Total em vendas")}
          value={formatBRL(totais.total)}
          icon={<DollarSign size={18} />}
          accentColor={accent}
        />
        <StatCard
          title={t("Recebido")}
          value={formatBRL(totais.recebido)}
          icon={<CheckCircle2 size={18} />}
          accentColor="var(--success)"
        />
        <StatCard
          title={t("A receber")}
          value={formatBRL(totais.aReceber)}
          icon={<CalendarClock size={18} />}
          accentColor="var(--warning)"
        />
        <StatCard
          title={t("Atrasado")}
          value={formatBRL(totais.atrasado)}
          icon={<AlertTriangle size={18} />}
          accentColor="var(--danger)"
        />

      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 flex-1 min-w-[240px] max-w-md focus-within:border-border-strong transition-colors">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar por venda, contratante, evento, DJ...")}
            className="input"
          />
        </div>

        <div className="pill-group">
          <button
            type="button"
            className={`pill ${filtroStatus === "todos" ? "active" : ""}`}
            onClick={() => setFiltroStatus("todos")}
          >
            {t("Todas ({n})", { n: todasParcelas.length })}
          </button>
          <button
            type="button"
            className={`pill ${filtroStatus === "pendente" ? "active" : ""}`}
            onClick={() => setFiltroStatus("pendente")}
          >
            <Clock size={11} />
            {t("Pendentes ({n})", { n: contadores.pendente })}
          </button>
          <button
            type="button"
            className={`pill ${filtroStatus === "atrasado" ? "active" : ""}`}
            onClick={() => setFiltroStatus("atrasado")}
          >
            <AlertTriangle size={11} />
            {t("Atrasadas ({n})", { n: contadores.atrasado })}
          </button>
          <button
            type="button"
            className={`pill ${filtroStatus === "pago" ? "active" : ""}`}
            onClick={() => setFiltroStatus("pago")}
          >
            <CheckCircle2 size={11} />
            {t("Pagas ({n})", { n: contadores.pago })}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
              <Wallet size={18} className="text-muted" />
            </div>
            <div className="section-title mb-1">
              {todasParcelas.length === 0
                ? t("Nenhuma parcela registrada")
                : t("Nenhum resultado")}
            </div>
            <div className="section-subtitle">
              {todasParcelas.length === 0
                ? t("As parcelas aparecem aqui quando você concretiza uma venda")
                : t("Ajuste os filtros ou a busca")}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/40">
                  <Th>{t("Vencimento")}</Th>
                  <Th>{t("Venda")}</Th>
                  <Th>{t("Parcela")}</Th>
                  <Th>{t("Contratante / Evento")}</Th>
                  <Th>{t("DJ")}</Th>
                  <Th className="text-right">{t("Valor")}</Th>
                  <Th>{t("Status")}</Th>
                  <Th className="w-[1%]"></Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => {
                  const st = LABELS_STATUS_PARCELA[l.status];
                  const venc = new Date(
                    l.parcela.dataVencimento + "T12:00:00"
                  );
                  return (
                    <tr
                      key={`${l.vendaId}-${l.parcela.id}`}
                      className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors"
                    >
                      <Td className="tabular-nums whitespace-nowrap">
                        <div className="font-medium text-primary">
                          {venc.toLocaleDateString("pt-BR")}
                        </div>
                        {l.parcela.dataPagamento && (
                          <div className="text-[0.7rem] text-success">
                            {t("pago em")}{" "}
                            {new Date(
                              l.parcela.dataPagamento + "T12:00:00"
                            ).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </Td>
                      <Td className="font-mono text-xs" style={{ color: accent }}>
                        {l.vendaNumero}
                      </Td>
                      <Td className="text-secondary whitespace-nowrap">
                        {l.indiceParcela}/{l.totalParcelas}
                        <span className="text-muted text-xs ml-1">
                          ({l.parcela.percentual.toFixed(0)}%)
                        </span>
                      </Td>
                      <Td className="min-w-[180px]">
                        <div className="font-medium text-primary truncate max-w-[220px]">
                          {l.contratante}
                        </div>
                        <div className="text-xs text-muted truncate max-w-[220px]">
                          {l.nomeEvento}
                        </div>
                      </Td>
                      <Td>
                        <span
                          className="inline-flex items-center gap-1.5 text-secondary"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: l.djColor }}
                          />
                          {l.djNome}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums font-semibold">
                        {formatBRL(l.parcela.valor)}
                      </Td>
                      <Td>
                        <span className={`badge ${st.badge}`}>
                          {l.status === "pago" && <CheckCircle2 size={11} />}
                          {l.status === "pendente" && <Clock size={11} />}
                          {l.status === "atrasado" && <AlertTriangle size={11} />}
                          {t(st.label)}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex justify-end">
                          {modoVisitante ? (
                            <span className="text-xs text-muted">—</span>
                          ) : l.status === "pago" ? (
                            <button
                              onClick={() => desfazerPago(l)}
                              className="btn-ghost text-xs inline-flex items-center gap-1"
                              title={t("Desfazer pagamento")}
                            >
                              <Undo2 size={13} />
                              {t("Desfazer")}
                            </button>
                          ) : (
                            <button
                              onClick={() => marcarPago(l)}
                              className="btn text-xs inline-flex items-center gap-1"
                              style={{
                                backgroundColor: "var(--success)",
                                color: "#fff",
                              }}
                            >
                              <CheckCircle2 size={13} />
                              {t("Informar pagamento")}
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totais.atrasado > 0 && (
        <div
          className="mt-4 card flex items-start gap-3"
          style={{
            borderColor: "var(--danger)",
            backgroundColor: "rgba(239,68,68,0.06)",
          }}
        >
          <AlertTriangle
            size={16}
            className="flex-shrink-0 mt-0.5"
            style={{ color: "var(--danger)" }}
          />
          <div className="text-sm text-secondary">
            {t("Você tem")} <strong>{formatBRL(totais.atrasado)}</strong> {t("em parcelas atrasadas ({n} {parcela}). Filtre por \"Atrasadas\" para ver e cobrar.", { n: contadores.atrasado, parcela: contadores.atrasado === 1 ? t("parcela") : t("parcelas") })}
          </div>
        </div>
      )}
    </div>
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
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td className={`px-4 py-3 align-middle ${className}`} style={style}>
      {children}
    </td>
  );
}
