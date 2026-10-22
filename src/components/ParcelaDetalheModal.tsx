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
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Modal from "./Modal";
import { Bloco, Linha } from "./detalhes/FichaUI";
import { useNavegacao } from "./NavOverlay";
import { urls } from "@/lib/navegacao/rotas";
import { useAviso } from "./ConfirmarModal";
import { useVendas } from "@/lib/vendas-context";
import { useAuth } from "@/lib/auth-context";
import {
  podeInformarPagamentoUI,
  podeCancelarPagamentoUI,
} from "@/lib/permissoes/gatesEquipeUI";
import { useArtistas } from "@/lib/workspace-context";
import { formatarMoeda, hojeISO, formatarData, formatarDataHora } from "@/lib/formatters";
import { LABELS_STATUS_PARCELA, statusEfetivoParcela } from "@/types";
import { useT } from "@/lib/i18n";
import { diasDeAtraso } from "@/lib/financeiro/cobranca";
import { PreviaCobranca, useCobranca, type AlvoCobranca } from "./financeiro/Cobranca";

const fmtData = (iso?: string) => formatarData(iso);
const fmtDataHora = (iso?: string) => formatarDataHora(iso);

type Props = {
  vendaId: string | null;
  parcelaId: string | null;
  onClose: () => void;
};

export default function ParcelaDetalheModal({ vendaId, parcelaId, onClose }: Props) {
  const t = useT();
  const { navegar } = useNavegacao();
  const pathname = usePathname();
  const { vendas, acaoParcela } = useVendas();
  const { podeUI, modoVisitante, sessao } = useAuth();
  const userId = sessao?.usuario.id;
  const artistas = useArtistas();
  const { avisar, avisador } = useAviso();

  const [modo, setModo] = useState<"info" | "pagar" | "cancelar" | "cobrar">("info");
  const cobranca = useCobranca();
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
  const emAberto = status === "pendente" || status === "atrasado";
  const dias = diasDeAtraso(parcela.dataVencimento, new Date());
  const alvo: AlvoCobranca = { venda, parcela, indice: idx + 1, total: venda.parcelas.length, artista };
  // A chave PIX chega redigida pra quem não é admin — o aviso de "sem chave"
  // só faz sentido pra quem enxerga o cadastro.
  const ehAdmin = sessao?.usuario.papel === "admin";
  // Autoria via VENDA-mãe: informar pagamento e cancelar/editar pagamento seguem
  // o criado_por da venda (parcela não tem autor próprio) — espelha
  // verificarMutacaoParcela ("informar"/"editar") no servidor.
  const podeRegistrar = podeInformarPagamentoUI(
    podeUI,
    venda.artistaId || null,
    venda.criadoPor,
    userId
  );
  const podeCancelar = podeCancelarPagamentoUI(
    podeUI,
    venda.artistaId || null,
    venda.criadoPor,
    userId
  );

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
      avisar((e as Error).message ?? t("Falha na operação."));
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
        // Dia LOCAL: toISOString é UTC e, depois das 21h no Brasil, gravava amanhã.
        data_pagamento: hojeISO(),
        nota_pagamento: nota.trim() || null,
      });
    });
  }

  async function verComprovante() {
    try {
      const res = await fetch(`/api/parcelas/${parcela!.id}/comprovante`, { credentials: "include" });
      const b = (await res.json()) as { url?: string | null };
      if (b.url) window.open(b.url, "_blank", "noopener");
      else avisar(t("Comprovante indisponível."));
    } catch {
      avisar(t("Falha ao abrir o comprovante."));
    }
  }

  return (
    // avisador FORA do Modal (não como children): o container de conteúdo do
    // Modal tem transform (animate-modal) + overflow-y-auto, o que confinaria
    // um Toast position:fixed dentro dele em vez do viewport.
    <>
    <Modal isOpen onClose={onClose} title={t("Parcela {i}/{n}", { i: idx + 1, n: venda.parcelas.length })}>
      <div className="flex flex-col gap-5">
        {/* ===== RESUMO ===== */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-primary tabular-nums">{formatarMoeda(parcela.valor, venda.moeda)}</span>
              <span className="text-sm text-muted">({parcela.percentual.toFixed(0)}%)</span>
            </div>
            {emAberto && (
              <span
                className={`text-sm ${dias > 0 ? "font-semibold" : "text-muted"}`}
                style={dias > 0 ? { color: "var(--danger-ink)" } : undefined}
              >
                {dias > 0
                  ? t("Venceu em {data} · há {n} dias", { data: fmtData(parcela.dataVencimento + "T12:00:00"), n: dias })
                  : dias === 0
                  ? t("Vence hoje")
                  : t("Vence em {data} · em {n} dias", { data: fmtData(parcela.dataVencimento + "T12:00:00"), n: -dias })}
              </span>
            )}
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
          <div className="flex items-center justify-between gap-3">
            <Linha icon={<Hash size={13} />} bold>{venda.numero}</Linha>
            {/* Leva até a venda — a não ser que o modal já esteja aberto em cima dela. */}
            {pathname !== urls.venda(venda.id) && (
              <button
                type="button"
                onClick={() => navegar(urls.venda(venda.id))}
                className="btn-ghost text-xs inline-flex items-center gap-1 flex-shrink-0"
              >
                {t("Abrir venda")}
                <ExternalLink size={11} />
              </button>
            )}
          </div>
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
        {(cobrancas.length > 0 || status === "atrasado") && (
          <Bloco icon={<BellRing size={14} />} title={t("Cobranças ({n})", { n: cobrancas.length })}>
            {cobrancas.length === 0 ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold" style={{ color: "var(--warning)" }}>
                  {t("Ainda não foi cobrada")}
                </span>
                <span className="text-xs text-muted">
                  {t("Cada cobrança feita pelo botão fica registrada aqui, com data, quem cobrou e por onde.")}
                </span>
              </div>
            ) : (
              cobrancas.map((c, i) => (
                <Linha key={i} icon={c.canal === "whatsapp" ? <MessageCircle size={13} /> : <BellRing size={13} />} subtle>
                  {fmtDataHora(c.em)}
                  {c.porNome ? ` · ${c.porNome}` : ""}
                  {c.canal === "whatsapp" ? ` · ${t("WhatsApp")}` : c.canal === "outro" ? ` · ${t("outro canal")}` : ""}
                </Linha>
              ))
            )}
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
                  // Em aberto: COBRAR é a ação principal (o mais comum aqui);
                  // pagamento e cobrança por outro canal logo abaixo, e o
                  // cancelar separado no fim.
                  <div className="flex w-full flex-col gap-2">
                    <button
                      onClick={() => setModo("cobrar")}
                      disabled={!podeRegistrar}
                      className="btn h-11 w-full justify-center text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!podeRegistrar ? t("Você não tem permissão para isso.") : undefined}
                      style={{ backgroundColor: "var(--success-solid)", color: "#fff" }}
                    >
                      <MessageCircle size={16} />
                      {status === "atrasado" ? t("Cobrar no WhatsApp") : t("Lembrar no WhatsApp")}
                    </button>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        onClick={() => setModo("pagar")}
                        disabled={!podeRegistrar}
                        className="btn btn-secondary justify-center text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!podeRegistrar ? t("Você não tem permissão para isso.") : undefined}
                      >
                        <CheckCircle2 size={14} /> {t("Informar pagamento")}
                      </button>
                      <button
                        onClick={() => rodar(() => cobranca.registrarOutroCanal(alvo))}
                        disabled={!podeRegistrar || salvando}
                        className="btn btn-secondary justify-center text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!podeRegistrar ? t("Você não tem permissão para isso.") : undefined}
                      >
                        <BellRing size={14} /> {t("Cobrei por outro canal")}
                      </button>
                    </div>
                    {artista?.pix ? (
                      <span className="text-xs text-muted">
                        {t("A mensagem leva a chave PIX do {artista} (a mesma do contrato).", { artista: artista.name })}
                      </span>
                    ) : ehAdmin && artista ? (
                      <span className="text-xs" style={{ color: "var(--warning)" }}>
                        {t("{artista} sem chave PIX cadastrada: a mensagem vai sem PIX.", { artista: artista.name })}
                      </span>
                    ) : null}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => setModo("cancelar")}
                        disabled={!podeCancelar}
                        className="btn btn-danger-outline text-sm"
                        title={!podeCancelar ? t("Você não tem permissão para isso.") : undefined}
                      >
                        <Ban size={14} /> {t("Cancelar cachê")}
                      </button>
                    </div>
                  </div>
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
                    style={{ backgroundColor: "var(--success-solid)", color: "#fff" }}
                  >
                    <CheckCircle2 size={14} /> {salvando ? t("Salvando…") : t("Confirmar pagamento")}
                  </button>
                </div>
              </div>
            )}

            {modo === "cobrar" && (
              <PreviaCobranca
                alvo={alvo}
                podeRegistrar={podeRegistrar}
                onCancelar={() => setModo("info")}
                onEnviar={(texto) => {
                  cobranca.enviarWhatsApp(alvo, texto);
                  setModo("info");
                }}
              />
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
                    className="btn btn-danger text-sm"
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
    {avisador}
    {cobranca.aviso}
    </>
  );
}
