"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  BellRing,
  Paperclip,
  FileText,
  Undo2,
  RotateCcw,
  DollarSign,
  CalendarClock,
  User,
  Building2,
  Hash,
  StickyNote,
} from "lucide-react";
import Modal from "./Modal";
import { useVendas } from "@/lib/vendas-context";
import { useAuth } from "@/lib/auth-context";
import { useArtistas } from "@/lib/workspace-context";
import { formatBRL } from "@/lib/whatsapp";
import { LABELS_STATUS_PARCELA, statusEfetivoParcela } from "@/types";
import { useT } from "@/lib/i18n";

function fmtData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}
function fmtDataHora(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  vendaId: string | null;
  parcelaId: string | null;
  onClose: () => void;
};

export default function ParcelaDetalheModal({ vendaId, parcelaId, onClose }: Props) {
  const t = useT();
  const { vendas, acaoParcela } = useVendas();
  const { podeUI, modoVisitante } = useAuth();
  const artistas = useArtistas();

  const [modo, setModo] = useState<"info" | "pagar" | "cancelar">("info");
  const [nota, setNota] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const venda = vendaId ? vendas.find((v) => v.id === vendaId) : null;
  const idx = venda?.parcelas.findIndex((p) => p.id === parcelaId) ?? -1;
  const parcela = venda && idx >= 0 ? venda.parcelas[idx] : null;

  if (!venda || !parcela) {
    return (
      <Modal isOpen={false} onClose={onClose} title="">
        <></>
      </Modal>
    );
  }

  const artista = artistas.find((d) => d.id === venda.artistaId);
  const status = statusEfetivoParcela(parcela);
  const st = LABELS_STATUS_PARCELA[status];
  const meta = parcela.meta;
  const cobrancas = meta?.cobrancas ?? [];
  const podeRegistrar = podeUI(venda.artistaId || null, "financeiro.registrar_pagamento");
  const podeCancelar = podeUI(venda.artistaId || null, "financeiro.cancelar_pagamento");

  function reset() {
    setModo("info");
    setNota("");
    setFile(null);
    setMotivo("");
  }

  async function rodar(fn: () => Promise<unknown>) {
    setSalvando(true);
    try {
      await fn();
      reset();
    } catch (e) {
      window.alert((e as Error).message ?? t("Falha na operação."));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarPagamento() {
    await rodar(async () => {
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch(`/api/parcelas/${parcela!.id}/comprovante`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!up.ok) {
          const b = (await up.json().catch(() => ({}))) as { erro?: string };
          throw new Error(b.erro ?? t("Falha ao enviar o comprovante."));
        }
      }
      await acaoParcela(venda!.id, parcela!.id, {
        status_base: "pago",
        data_pagamento: new Date().toISOString().slice(0, 10),
        nota_pagamento: nota.trim() || null,
      });
    });
  }

  async function verComprovante() {
    try {
      const res = await fetch(`/api/parcelas/${parcela!.id}/comprovante`, { credentials: "include" });
      const b = (await res.json()) as { url?: string | null };
      if (b.url) window.open(b.url, "_blank", "noopener");
      else window.alert(t("Comprovante indisponível."));
    } catch {
      window.alert(t("Falha ao abrir o comprovante."));
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={t("Parcela {i}/{n}", { i: idx + 1, n: venda.parcelas.length })}>
      <div className="flex flex-col gap-5">
        {/* ===== RESUMO ===== */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary tabular-nums">{formatBRL(parcela.valor)}</span>
            <span className="text-sm text-muted">({parcela.percentual.toFixed(0)}%)</span>
          </div>
          <span className={`badge ${st.badge}`}>
            {status === "pago" && <CheckCircle2 size={11} />}
            {status === "pendente" && <Clock size={11} />}
            {status === "atrasado" && <AlertTriangle size={11} />}
            {status === "cancelado" && <Ban size={11} />}
            {t(st.label)}
          </span>
        </div>

        <Bloco icon={<DollarSign size={14} />} title={t("Venda")}>
          <Linha icon={<Hash size={13} />} bold>{venda.numero}</Linha>
          {venda.contratanteNome && <Linha icon={<User size={13} />}>{venda.contratanteNome}</Linha>}
          {venda.nomeEvento && <Linha icon={<Building2 size={13} />}>{venda.nomeEvento}</Linha>}
          {artista && (
            <Linha>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: artista.color }} />
                {artista.name}
              </span>
            </Linha>
          )}
          <Linha icon={<CalendarClock size={13} />}>
            {t("Vence em")} {fmtData(parcela.dataVencimento + "T12:00:00")}
          </Linha>
        </Bloco>

        {/* ===== PAGAMENTO ===== */}
        {status === "pago" && (
          <Bloco icon={<CheckCircle2 size={14} />} title={t("Pagamento")}>
            {parcela.dataPagamento && (
              <Linha icon={<CalendarClock size={13} />}>
                {t("Pago em")} {fmtData(parcela.dataPagamento + "T12:00:00")}
              </Linha>
            )}
            {meta?.pagamento?.pagoPorNome && (
              <Linha icon={<User size={13} />}>{t("Informado por")} {meta.pagamento.pagoPorNome}</Linha>
            )}
            {meta?.pagamento?.nota && (
              <Linha icon={<StickyNote size={13} />}>{meta.pagamento.nota}</Linha>
            )}
            {meta?.pagamento?.comprovantePath && (
              <button
                type="button"
                onClick={verComprovante}
                className="btn btn-secondary text-xs inline-flex items-center gap-1.5 self-start mt-1"
              >
                <FileText size={13} /> {t("Ver comprovante")}
              </button>
            )}
          </Bloco>
        )}

        {/* ===== CANCELAMENTO ===== */}
        {status === "cancelado" && meta?.cancelamento && (
          <Bloco icon={<Ban size={14} />} title={t("Cancelado")}>
            {meta.cancelamento.motivo && <Linha icon={<StickyNote size={13} />} bold>{meta.cancelamento.motivo}</Linha>}
            {meta.cancelamento.canceladoPorNome && (
              <Linha icon={<User size={13} />} subtle>
                {t("por")} {meta.cancelamento.canceladoPorNome} · {fmtDataHora(meta.cancelamento.canceladoEm)}
              </Linha>
            )}
          </Bloco>
        )}

        {/* ===== COBRANÇAS (log) ===== */}
        {cobrancas.length > 0 && (
          <Bloco icon={<BellRing size={14} />} title={t("Cobranças enviadas ({n})", { n: cobrancas.length })}>
            {cobrancas.map((c, i) => (
              <Linha key={i} icon={<BellRing size={13} />} subtle>
                {fmtDataHora(c.em)}
                {c.porNome ? ` · ${c.porNome}` : ""}
              </Linha>
            ))}
          </Bloco>
        )}

        {/* ===== AÇÕES (interativas) ===== */}
        {!modoVisitante && (
          <div className="pt-3 border-t border-border">
            {modo === "info" && (
              <div className="flex flex-wrap gap-2">
                {status === "pago" ? (
                  <button
                    onClick={() => rodar(() => acaoParcela(venda.id, parcela.id, { status_base: "pendente" }))}
                    disabled={!podeCancelar || salvando}
                    className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!podeCancelar ? t("Você não tem permissão para isso.") : undefined}
                  >
                    <Undo2 size={14} /> {t("Desfazer pagamento")}
                  </button>
                ) : status === "cancelado" ? (
                  <button
                    onClick={() => rodar(() => acaoParcela(venda.id, parcela.id, { cancelar: false }))}
                    disabled={!podeCancelar || salvando}
                    className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!podeCancelar ? t("Você não tem permissão para isso.") : undefined}
                  >
                    <RotateCcw size={14} /> {t("Reativar cachê")}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setModo("pagar")}
                      disabled={!podeRegistrar}
                      className="btn text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!podeRegistrar ? t("Você não tem permissão para isso.") : undefined}
                      style={{ backgroundColor: "var(--success)", color: "#fff" }}
                    >
                      <CheckCircle2 size={14} /> {t("Informar pagamento")}
                    </button>
                    <button
                      onClick={() => rodar(() => acaoParcela(venda.id, parcela.id, { registrar_cobranca: true }))}
                      disabled={!podeRegistrar || salvando}
                      className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!podeRegistrar ? t("Você não tem permissão para isso.") : undefined}
                    >
                      <BellRing size={14} /> {t("Cobrança enviada")}
                    </button>
                    <button
                      onClick={() => setModo("cancelar")}
                      disabled={!podeCancelar}
                      className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!podeCancelar ? t("Você não tem permissão para isso.") : undefined}
                      style={{ color: "var(--danger)" }}
                    >
                      <Ban size={14} /> {t("Cancelar cachê")}
                    </button>
                  </>
                )}
              </div>
            )}

            {modo === "pagar" && (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">{t("Forma / observação")}</span>
                  <textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows={2}
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
                <div className="flex justify-end gap-2">
                  <button onClick={() => setModo("info")} disabled={salvando} className="btn btn-secondary text-sm">
                    {t("Voltar")}
                  </button>
                  <button
                    onClick={confirmarPagamento}
                    disabled={salvando}
                    className="btn text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ backgroundColor: "var(--success)", color: "#fff" }}
                  >
                    <CheckCircle2 size={14} /> {salvando ? t("Salvando…") : t("Confirmar pagamento")}
                  </button>
                </div>
              </div>
            )}

            {modo === "cancelar" && (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-secondary">
                  {t("O cachê sai do \"a receber\" e fica registrado como cancelado. Você pode reativar depois.")}
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">{t("Motivo do cancelamento")} *</span>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    autoFocus
                    placeholder={t("Ex.: Entramos em ação judicial · Isentamos o pagamento · Acordo…")}
                    className="input resize-none"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setModo("info")} disabled={salvando} className="btn btn-secondary text-sm">
                    {t("Voltar")}
                  </button>
                  <button
                    onClick={() =>
                      motivo.trim() &&
                      rodar(() => acaoParcela(venda.id, parcela.id, { cancelar: true, cancelamento_motivo: motivo.trim() }))
                    }
                    disabled={salvando || !motivo.trim()}
                    className="btn text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                  >
                    <Ban size={14} /> {salvando ? t("Cancelando…") : t("Cancelar cachê")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Bloco({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
        <span style={{ color: "var(--brand)" }}>{icon}</span>
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Linha({
  icon,
  bold,
  subtle,
  children,
}: {
  icon?: React.ReactNode;
  bold?: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-2 text-sm ${
        bold ? "text-primary font-semibold" : subtle ? "text-muted" : "text-secondary"
      }`}
    >
      {icon && <span className="mt-0.5 text-muted flex-shrink-0">{icon}</span>}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
