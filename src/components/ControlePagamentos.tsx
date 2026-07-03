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
  Ban,
  BellRing,
  Paperclip,
  FileText,
  RotateCcw,
} from "lucide-react";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";
import Modal from "./Modal";
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
  djId: string;
  djNome: string;
  djColor: string;
  contratante: string;
  nomeEvento: string;
  status: StatusParcela;
};

function fmtData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export default function ControlePagamentos() {
  const t = useT();
  const accent = "var(--brand)";
  const { vendas, acaoParcela } = useVendas();
  const { modoVisitante, podeUI } = useAuth();
  const artistas = useArtistas();

  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | "todos">("todos");
  const [modalPagar, setModalPagar] = useState<LinhaParcela | null>(null);
  const [modalCancelar, setModalCancelar] = useState<LinhaParcela | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

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
          djId: v.djId,
          djNome: dj?.name ?? "—",
          djColor: dj?.color ?? "#888",
          contratante: v.contratanteNome,
          nomeEvento: v.nomeEvento,
          status: statusEfetivoParcela(parcela),
        });
      });
    }
    return linhas.sort(
      (a, b) =>
        new Date(a.parcela.dataVencimento).getTime() -
        new Date(b.parcela.dataVencimento).getTime()
    );
  }, [vendas, artistas]);

  // Totais — CANCELADO (baixado/isentado) sai do a receber/atrasado.
  const totais = useMemo(() => {
    let recebido = 0;
    let aReceber = 0;
    let atrasado = 0;
    for (const l of todasParcelas) {
      if (l.status === "cancelado") continue;
      if (l.status === "pago") recebido += l.parcela.valor;
      else if (l.status === "atrasado") atrasado += l.parcela.valor;
      else aReceber += l.parcela.valor;
    }
    return { recebido, aReceber, atrasado, total: recebido + aReceber + atrasado };
  }, [todasParcelas]);

  const lista = useMemo(() => {
    return todasParcelas.filter((l) => {
      if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [l.vendaNumero, l.contratante, l.nomeEvento, l.djNome]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [todasParcelas, filtroStatus, search]);

  const contadores = useMemo(() => {
    const c = { pago: 0, pendente: 0, atrasado: 0, cancelado: 0 };
    todasParcelas.forEach((l) => c[l.status]++);
    return c;
  }, [todasParcelas]);

  async function desfazerPago(l: LinhaParcela) {
    setOcupadoId(l.parcela.id);
    try {
      await acaoParcela(l.vendaId, l.parcela.id, { status_base: "pendente" });
    } catch (e) {
      window.alert((e as Error).message ?? t("Falha ao atualizar."));
    } finally {
      setOcupadoId(null);
    }
  }

  async function reativar(l: LinhaParcela) {
    setOcupadoId(l.parcela.id);
    try {
      await acaoParcela(l.vendaId, l.parcela.id, { cancelar: false });
    } catch (e) {
      window.alert((e as Error).message ?? t("Falha ao atualizar."));
    } finally {
      setOcupadoId(null);
    }
  }

  async function registrarCobranca(l: LinhaParcela) {
    if (!window.confirm(t("Registrar que você enviou uma cobrança deste cachê agora?")))
      return;
    setOcupadoId(l.parcela.id);
    try {
      await acaoParcela(l.vendaId, l.parcela.id, { registrar_cobranca: true });
    } catch (e) {
      window.alert((e as Error).message ?? t("Falha ao registrar cobrança."));
    } finally {
      setOcupadoId(null);
    }
  }

  async function verComprovante(l: LinhaParcela) {
    try {
      const res = await fetch(`/api/parcelas/${l.parcela.id}/comprovante`, {
        credentials: "include",
      });
      const b = (await res.json()) as { url?: string | null };
      if (b.url) window.open(b.url, "_blank", "noopener");
      else window.alert(t("Comprovante indisponível."));
    } catch {
      window.alert(t("Falha ao abrir o comprovante."));
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Controle de Pagamentos"
        subtitle="Todas as parcelas de todas as vendas — datas, valores, comprovantes e cobranças"
        accentColor={accent}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title={t("Total em vendas")} value={formatBRL(totais.total)} icon={<DollarSign size={18} />} accentColor={accent} />
        <StatCard title={t("Recebido")} value={formatBRL(totais.recebido)} icon={<CheckCircle2 size={18} />} accentColor="var(--success)" />
        <StatCard title={t("A receber")} value={formatBRL(totais.aReceber)} icon={<CalendarClock size={18} />} accentColor="var(--warning)" />
        <StatCard title={t("Atrasado")} value={formatBRL(totais.atrasado)} icon={<AlertTriangle size={18} />} accentColor="var(--danger)" />
      </div>

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
          <button type="button" className={`pill ${filtroStatus === "todos" ? "active" : ""}`} onClick={() => setFiltroStatus("todos")}>
            {t("Todas ({n})", { n: todasParcelas.length })}
          </button>
          <button type="button" className={`pill ${filtroStatus === "pendente" ? "active" : ""}`} onClick={() => setFiltroStatus("pendente")}>
            <Clock size={11} />
            {t("Pendentes ({n})", { n: contadores.pendente })}
          </button>
          <button type="button" className={`pill ${filtroStatus === "atrasado" ? "active" : ""}`} onClick={() => setFiltroStatus("atrasado")}>
            <AlertTriangle size={11} />
            {t("Atrasadas ({n})", { n: contadores.atrasado })}
          </button>
          <button type="button" className={`pill ${filtroStatus === "pago" ? "active" : ""}`} onClick={() => setFiltroStatus("pago")}>
            <CheckCircle2 size={11} />
            {t("Pagas ({n})", { n: contadores.pago })}
          </button>
          {contadores.cancelado > 0 && (
            <button type="button" className={`pill ${filtroStatus === "cancelado" ? "active" : ""}`} onClick={() => setFiltroStatus("cancelado")}>
              <Ban size={11} />
              {t("Canceladas ({n})", { n: contadores.cancelado })}
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
              <Wallet size={18} className="text-muted" />
            </div>
            <div className="section-title mb-1">
              {todasParcelas.length === 0 ? t("Nenhuma parcela registrada") : t("Nenhum resultado")}
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
                  const venc = new Date(l.parcela.dataVencimento + "T12:00:00");
                  const meta = l.parcela.meta;
                  const nCobrancas = meta?.cobrancas?.length ?? 0;
                  const podeRegistrar = podeUI(l.djId || null, "financeiro.registrar_pagamento");
                  const podeCancelar = podeUI(l.djId || null, "financeiro.cancelar_pagamento");
                  return (
                    <tr
                      key={`${l.vendaId}-${l.parcela.id}`}
                      className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors"
                    >
                      <Td className="tabular-nums whitespace-nowrap align-top">
                        <div className="font-medium text-primary">{venc.toLocaleDateString("pt-BR")}</div>
                        {l.parcela.dataPagamento && (
                          <div className="text-[0.7rem] text-success">
                            {t("pago em")} {fmtData(l.parcela.dataPagamento + "T12:00:00")}
                          </div>
                        )}
                        {meta?.pagamento?.pagoPorNome && (
                          <div className="text-[0.7rem] text-muted">
                            {t("por")} {meta.pagamento.pagoPorNome}
                          </div>
                        )}
                      </Td>
                      <Td className="font-mono text-xs align-top" style={{ color: accent }}>{l.vendaNumero}</Td>
                      <Td className="text-secondary whitespace-nowrap align-top">
                        {l.indiceParcela}/{l.totalParcelas}
                        <span className="text-muted text-xs ml-1">({l.parcela.percentual.toFixed(0)}%)</span>
                      </Td>
                      <Td className="min-w-[180px] align-top">
                        <div className="font-medium text-primary truncate max-w-[240px]">{l.contratante}</div>
                        <div className="text-xs text-muted truncate max-w-[240px]">{l.nomeEvento}</div>
                        {/* Metadados ricos */}
                        {meta?.pagamento?.nota && (
                          <div className="text-[0.7rem] text-secondary mt-1 max-w-[240px]">
                            <span className="text-muted">{t("Forma:")}</span> {meta.pagamento.nota}
                          </div>
                        )}
                        {meta?.pagamento?.comprovantePath && (
                          <button
                            type="button"
                            onClick={() => verComprovante(l)}
                            className="text-[0.7rem] inline-flex items-center gap-1 mt-1 hover:underline"
                            style={{ color: accent }}
                          >
                            <FileText size={11} /> {t("Ver comprovante")}
                          </button>
                        )}
                        {l.status === "cancelado" && meta?.cancelamento?.motivo && (
                          <div className="text-[0.7rem] mt-1 max-w-[240px]" style={{ color: "var(--danger)" }}>
                            <span className="text-muted">{t("Motivo:")}</span> {meta.cancelamento.motivo}
                          </div>
                        )}
                      </Td>
                      <Td className="align-top">
                        <span className="inline-flex items-center gap-1.5 text-secondary">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.djColor }} />
                          {l.djNome}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums font-semibold align-top">{formatBRL(l.parcela.valor)}</Td>
                      <Td className="align-top">
                        <span className={`badge ${st.badge}`}>
                          {l.status === "pago" && <CheckCircle2 size={11} />}
                          {l.status === "pendente" && <Clock size={11} />}
                          {l.status === "atrasado" && <AlertTriangle size={11} />}
                          {l.status === "cancelado" && <Ban size={11} />}
                          {t(st.label)}
                        </span>
                        {nCobrancas > 0 && l.status !== "pago" && l.status !== "cancelado" && (
                          <div
                            className="text-[0.7rem] inline-flex items-center gap-1 mt-1"
                            style={{ color: "var(--warning)" }}
                            title={(meta?.cobrancas ?? [])
                              .map((c) => fmtData(c.em))
                              .filter(Boolean)
                              .join(" · ")}
                          >
                            <BellRing size={10} /> {t("cobrado {n}x", { n: nCobrancas })}
                          </div>
                        )}
                      </Td>
                      <Td className="align-top">
                        <div className="flex justify-end items-center gap-1.5">
                          {modoVisitante ? (
                            <span className="text-xs text-muted">—</span>
                          ) : l.status === "pago" ? (
                            <IconBtn
                              onClick={() => desfazerPago(l)}
                              disabled={!podeCancelar || ocupadoId === l.parcela.id}
                              label={t("Desfazer")}
                              icon={<Undo2 size={13} />}
                              texto
                            />
                          ) : l.status === "cancelado" ? (
                            <IconBtn
                              onClick={() => reativar(l)}
                              disabled={!podeCancelar || ocupadoId === l.parcela.id}
                              label={t("Reativar")}
                              icon={<RotateCcw size={13} />}
                              texto
                            />
                          ) : (
                            <>
                              <IconBtn
                                onClick={() => registrarCobranca(l)}
                                disabled={!podeRegistrar || ocupadoId === l.parcela.id}
                                label={t("Cobrança enviada")}
                                icon={<BellRing size={14} />}
                              />
                              <IconBtn
                                onClick={() => setModalCancelar(l)}
                                disabled={!podeCancelar}
                                label={t("Cancelar cachê")}
                                icon={<Ban size={14} />}
                                perigo
                              />
                              <button
                                onClick={() => setModalPagar(l)}
                                disabled={!podeRegistrar}
                                className="btn text-xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!podeRegistrar ? t("Você não tem permissão para isso.") : undefined}
                                style={{ backgroundColor: "var(--success)", color: "#fff" }}
                              >
                                <CheckCircle2 size={13} />
                                {t("Informar pagamento")}
                              </button>
                            </>
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
        <div className="mt-4 card flex items-start gap-3" style={{ borderColor: "var(--danger)", backgroundColor: "rgba(239,68,68,0.06)" }}>
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
          <div className="text-sm text-secondary">
            {t("Você tem")} <strong>{formatBRL(totais.atrasado)}</strong>{" "}
            {t("em parcelas atrasadas ({n} {parcela}). Filtre por \"Atrasadas\" para ver e cobrar.", {
              n: contadores.atrasado,
              parcela: contadores.atrasado === 1 ? t("parcela") : t("parcelas"),
            })}
          </div>
        </div>
      )}

      {modalPagar && (
        <InformarPagamentoModal
          linha={modalPagar}
          onClose={() => setModalPagar(null)}
          onConfirmar={async (nota, file) => {
            const l = modalPagar;
            setOcupadoId(l.parcela.id);
            try {
              if (file) {
                const fd = new FormData();
                fd.append("file", file);
                const up = await fetch(`/api/parcelas/${l.parcela.id}/comprovante`, {
                  method: "POST",
                  credentials: "include",
                  body: fd,
                });
                if (!up.ok) {
                  const b = (await up.json().catch(() => ({}))) as { erro?: string };
                  throw new Error(b.erro ?? t("Falha ao enviar o comprovante."));
                }
              }
              await acaoParcela(l.vendaId, l.parcela.id, {
                status_base: "pago",
                data_pagamento: new Date().toISOString().slice(0, 10),
                nota_pagamento: nota || null,
              });
              setModalPagar(null);
            } catch (e) {
              window.alert((e as Error).message ?? t("Falha ao informar o pagamento."));
            } finally {
              setOcupadoId(null);
            }
          }}
        />
      )}

      {modalCancelar && (
        <CancelarModal
          linha={modalCancelar}
          onClose={() => setModalCancelar(null)}
          onConfirmar={async (motivo) => {
            const l = modalCancelar;
            setOcupadoId(l.parcela.id);
            try {
              await acaoParcela(l.vendaId, l.parcela.id, {
                cancelar: true,
                cancelamento_motivo: motivo,
              });
              setModalCancelar(null);
            } catch (e) {
              window.alert((e as Error).message ?? t("Falha ao cancelar."));
            } finally {
              setOcupadoId(null);
            }
          }}
        />
      )}
    </div>
  );
}

/* ============================================================ */

function IconBtn({
  onClick,
  disabled,
  label,
  icon,
  texto,
  perigo,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon: React.ReactNode;
  texto?: boolean;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="btn-ghost text-xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      style={perigo ? { color: "var(--danger)" } : undefined}
    >
      {icon}
      {texto && label}
    </button>
  );
}

function InformarPagamentoModal({
  linha,
  onClose,
  onConfirmar,
}: {
  linha: LinhaParcela;
  onClose: () => void;
  onConfirmar: (nota: string, file: File | null) => Promise<void>;
}) {
  const t = useT();
  const [nota, setNota] = useState(linha.parcela.meta?.pagamento?.nota ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  return (
    <Modal isOpen onClose={onClose} title={t("Informar pagamento")}>
      <div className="flex flex-col gap-4">
        <div className="text-sm text-secondary">
          {t("Parcela {i}/{n} — {valor}", {
            i: linha.indiceParcela,
            n: linha.totalParcelas,
            valor: formatBRL(linha.parcela.valor),
          })}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">{t("Forma / observação")}</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t("Ex.: Pago em dinheiro pessoalmente · PIX · Cobrança por WhatsApp…")}
            className="input resize-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary inline-flex items-center gap-1.5">
            <Paperclip size={12} /> {t("Comprovante (JPG, PNG ou PDF — opcional)")}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-primary file:cursor-pointer"
          />
          {file && <span className="text-[0.7rem] text-muted">{file.name}</span>}
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} className="btn btn-secondary" disabled={salvando}>
            {t("Cancelar")}
          </button>
          <button
            onClick={async () => {
              setSalvando(true);
              await onConfirmar(nota.trim(), file);
              setSalvando(false);
            }}
            disabled={salvando}
            className="btn inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ backgroundColor: "var(--success)", color: "#fff" }}
          >
            <CheckCircle2 size={14} />
            {salvando ? t("Salvando…") : t("Confirmar pagamento")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CancelarModal({
  linha,
  onClose,
  onConfirmar,
}: {
  linha: LinhaParcela;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const t = useT();
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  return (
    <Modal isOpen onClose={onClose} title={t("Cancelar cachê")}>
      <div className="flex flex-col gap-4">
        <div className="text-sm text-secondary">
          {t("O cachê sai do \"a receber\" e fica registrado como cancelado, com o motivo abaixo. Você pode reativar depois.")}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">{t("Motivo do cancelamento")} *</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={1000}
            autoFocus
            placeholder={t("Ex.: Entramos em ação judicial · Isentamos o pagamento · Acordo…")}
            className="input resize-none"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} className="btn btn-secondary" disabled={salvando}>
            {t("Voltar")}
          </button>
          <button
            onClick={async () => {
              if (!motivo.trim()) return;
              setSalvando(true);
              await onConfirmar(motivo.trim());
              setSalvando(false);
            }}
            disabled={salvando || !motivo.trim()}
            className="btn inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ backgroundColor: "var(--danger)", color: "#fff" }}
          >
            <Ban size={14} />
            {salvando ? t("Cancelando…") : t("Cancelar cachê")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 stat-label font-semibold whitespace-nowrap ${className}`}>
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
