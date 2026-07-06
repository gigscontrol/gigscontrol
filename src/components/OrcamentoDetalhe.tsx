"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, MessageCircle, CheckCircle2, XCircle, Clock, Trash2, Copy, AlertCircle, CalendarCheck2, Pencil, Check, X } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { gerarTextoWhatsApp, montarLinkWhatsApp, formatBRL, formatarDuracao } from "@/lib/whatsapp";
import { liquidoArtista } from "@/lib/taxaAgencia";
import { mascararCpfCnpj } from "@/lib/formatters";
import {
  LABELS_STATUS_ORCAMENTO,
  LABELS_TIPO_EVENTO,
  TEXTO_TRANSLADO,
  MODULE_THEMES,
} from "@/types";

type Props = {
  orcamentoId: string;
  onBack: () => void;
  onTransformarEmVenda: (orcamentoId: string) => void;
  /** Chamado para abrir outro orçamento (ex.: após duplicar). */
  onAbrir?: (orcamentoId: string) => void;
};

export default function OrcamentoDetalhe({ orcamentoId, onBack, onTransformarEmVenda, onAbrir }: Props) {
  const t = useT();
  const { podeUI } = useAuth();
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos, marcarStatus, aceitarOrcamento, removeOrcamento, duplicarOrcamento, updateOrcamento } = useOrcamentos();
  const { contratantes, casas, cidades } = useContatos();
  const artistas = useArtistas();

  // Estado dos diálogos de feedback (duplicar)
  const [confirmaDuplicar, setConfirmaDuplicar] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  // Edição inline do campo "Informações extras". Aberta sob demanda
  // pra não poluir o detalhe — admin clica em "Editar" pra revelar
  // o textarea.
  const [editandoInfoExtra, setEditandoInfoExtra] = useState(false);
  const [infoExtraDraft, setInfoExtraDraft] = useState("");
  const [salvandoInfoExtra, setSalvandoInfoExtra] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    tipo: "sucesso" | "erro";
    onAcao?: () => void;
    acaoLabel?: string;
  } | null>(null);

  const orc = orcamentos.find((o) => o.id === orcamentoId);
  if (!orc) {
    return (
      <div className="max-w-[800px] mx-auto w-full p-6 lg:p-8">
        <button onClick={onBack} className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} />
          {t("Voltar")}
        </button>
        <div className="card text-center py-12">
          <div className="section-title">{t("Orçamento não encontrado")}</div>
        </div>
      </div>
    );
  }

  const cont = contratantes.find((c) => c.id === orc.contratanteId);
  const cs = orc.casaId ? casas.find((c) => c.id === orc.casaId) : undefined;
  const cid = cidades.find((c) => c.id === orc.cidadeId);
  const dj = artistas.find((d) => d.id === orc.djId);
  const st = LABELS_STATUS_ORCAMENTO[orc.status];

  // Permissões por artista (podeUI já libera admin/legado).
  const podeConverter = podeUI(orc.djId || null, "vendas.converter");
  const podeEditarOrc = podeUI(orc.djId || null, "vendas.editar_orcamento");
  const podeExcluirOrc = podeUI(orc.djId || null, "vendas.excluir_orcamento");
  const semPermissao = t("Você não tem permissão para isso.");

  const texto = gerarTextoWhatsApp(orc, { contratante: cont, casa: cs, cidade: cid, dj });
  const linkWA = montarLinkWhatsApp(cont?.telefone ?? "", texto);

  const itensCamarim = orc.camarim.filter((i) => i.qtd > 0);
  const itensEfeitos = orc.efeitos.filter((i) => i.qtd > 0);
  const itensHotel = orc.hotel.filter((i) => i.qtd > 0);

  // Quais dados faltam para virar venda?
  const camposFaltantes: string[] = [];
  if (!orc.dataShow) camposFaltantes.push(t("Data do show"));
  if (!orc.horario) camposFaltantes.push(t("Horário"));
  if (!orc.casaId) camposFaltantes.push(t("Casa / Local"));
  if (!cont?.email) camposFaltantes.push(t("E-mail do contratante"));
  if (!cont?.documento) camposFaltantes.push(t("CPF / CNPJ do contratante"));

  return (
    <div className="max-w-[1100px] mx-auto w-full p-6 lg:p-8">
      <button onClick={onBack} className="btn-ghost mb-6 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft size={14} />
        {t("Voltar para Histórico")}
      </button>

      <PageHeader
        title={`Orçamento ${orc.numero}`}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className={`badge ${st.badge}`}>{t(st.label)}</span>
            <span className="badge badge-neutral">{t(LABELS_TIPO_EVENTO[orc.tipoEvento])}</span>
            <span className="text-muted">·</span>
            <span>{t("Criado em")} {new Date(orc.criadoEm).toLocaleDateString("pt-BR")}</span>
          </span>
        }
        accentColor={accent}
        actions={
          <a
            href={linkWA}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ backgroundColor: "#25D366", color: "#fff" }}
          >
            <MessageCircle size={14} />
            {t("Enviar pelo WhatsApp")}
          </a>
        }
      />

      {/* Alerta de dados faltando — só se status NÃO for recusado */}
      {orc.status !== "recusado" && camposFaltantes.length > 0 && (
        <div
          className="card mb-6 flex items-start gap-3"
          style={{ borderColor: "var(--warning)", backgroundColor: "rgba(245,158,11,0.06)" }}
        >
          <AlertCircle size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-primary text-sm mb-1">
              {t("Dados pendentes para converter em venda")}
            </div>
            <div className="text-xs text-secondary">
              {camposFaltantes.join(" · ")}
            </div>
            <div className="text-xs text-muted mt-1">
              {t("Você pode aceitar e enviar pelo WhatsApp normalmente; esses dados serão necessários quando o orçamento virar venda fechada.")}
            </div>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-2 mb-6">
        {orc.status !== "recusado" && (
          <button
            onClick={() => onTransformarEmVenda(orc.id)}
            disabled={!podeConverter}
            title={!podeConverter ? semPermissao : undefined}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <CalendarCheck2 size={14} />
            {t("Transformar em Venda")}
          </button>
        )}
        {orc.status !== "aceito" && (
          <button
            onClick={() => {
              const msg = !orc.dataShow
                ? t("Aceitar este orçamento? Como não há data definida, nenhum show será criado na agenda automaticamente — adicione a data depois para isso.")
                : t("Aceitar este orçamento? Um show será criado automaticamente na agenda.");
              if (confirm(msg)) aceitarOrcamento(orc.id);
            }}
            disabled={!podeEditarOrc}
            title={!podeEditarOrc ? semPermissao : undefined}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "var(--success)" }}
          >
            <CheckCircle2 size={14} />
            {t("Marcar aceito")}
          </button>
        )}
        {orc.status !== "negociacao" && orc.status !== "aceito" && (
          <button
            onClick={() => marcarStatus(orc.id, "negociacao")}
            disabled={!podeEditarOrc}
            title={!podeEditarOrc ? semPermissao : undefined}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "var(--warning)" }}
          >
            <Clock size={14} />
            {t("Em negociação")}
          </button>
        )}
        {orc.status !== "recusado" && orc.status !== "aceito" && (
          <button
            onClick={() => marcarStatus(orc.id, "recusado")}
            disabled={!podeEditarOrc}
            title={!podeEditarOrc ? semPermissao : undefined}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "var(--danger)" }}
          >
            <XCircle size={14} />
            {t("Recusar")}
          </button>
        )}
        <button
          onClick={() => setConfirmaDuplicar(true)}
          disabled={!podeEditarOrc}
          title={!podeEditarOrc ? semPermissao : undefined}
          className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy size={14} />
          {t("Duplicar")}
        </button>
        <button
          onClick={() => {
            if (confirm(t("Remover este orçamento permanentemente?"))) {
              removeOrcamento(orc.id);
              onBack();
            }
          }}
          disabled={!podeExcluirOrc}
          title={!podeExcluirOrc ? semPermissao : undefined}
          className="btn btn-ghost ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 size={14} />
          {t("Remover")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* Coluna 1: Informações */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="section-title mb-4">{t("Dados do show")}</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoItem label={t("DJ")} value={dj?.name ?? "—"} />
              <InfoItem
                label={t("Valor do cachê")}
                value={formatBRL(orc.valorCache)}
                bold
                accent={accent}
              />
              {orc.taxaAgenciaValor !== undefined && orc.taxaAgenciaValor > 0 && (
                <>
                  <InfoItem
                    label={t("Taxa de agência")}
                    value={formatBRL(orc.taxaAgenciaValor)}
                  />
                  <InfoItem
                    label={t("Líquido do artista")}
                    value={formatBRL(liquidoArtista(orc.valorCache ?? 0, orc.taxaAgenciaValor))}
                    bold
                    accent={accent}
                  />
                </>
              )}
              <InfoItem
                label={t("Data")}
                value={
                  orc.dataShow
                    ? new Date(orc.dataShow + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "—"
                }
                missing={!orc.dataShow}
              />
              <InfoItem label={t("Horário")} value={orc.horario || "—"} missing={!orc.horario} />
              <InfoItem label={t("Duração")} value={formatarDuracao(orc.duracaoHoras, orc.duracaoMinutos ?? 0)} />
              <InfoItem
                label={t("Validade")}
                value={
                  orc.validade
                    ? new Date(orc.validade + "T12:00:00").toLocaleDateString("pt-BR")
                    : "—"
                }
                missing={!orc.validade}
              />
            </div>
          </div>

          <div className="card">
            <div className="section-title mb-4">{t("Contratante")}</div>
            <div className="flex flex-col gap-2 text-sm">
              <InfoItem label={t("Nome")} value={cont?.nome ?? "—"} />
              <InfoItem label={t("Telefone")} value={cont?.telefone ?? "—"} />
              <InfoItem label={t("E-mail")} value={cont?.email || "—"} missing={!cont?.email} />
              <InfoItem label={t("Documento")} value={mascararCpfCnpj(cont?.documento) || "—"} missing={!cont?.documento} />
            </div>
          </div>

          <div className="card">
            <div className="section-title mb-4">{t("Local")}</div>
            <div className="flex flex-col gap-2 text-sm">
              <InfoItem label={t("Tipo de evento")} value={t(LABELS_TIPO_EVENTO[orc.tipoEvento])} />
              <InfoItem
                label={t("Casa / Evento")}
                value={cs?.nome ?? "—"}
                missing={!cs}
              />
              <InfoItem label={t("Cidade")} value={cid ? `${cid.nome} — ${cid.estado}` : "—"} />
            </div>
          </div>

          {orc.observacoes && (
            <div className="card">
              <div className="section-title mb-3">{t("Observações internas")}</div>
              <p className="text-sm text-secondary whitespace-pre-wrap">{orc.observacoes}</p>
            </div>
          )}

          {/* Informações extras — texto que vai pro fim do orçamento.
              Sempre exibido (mesmo se vazio) com botão de editar. */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="section-title">{t("Informações extras")}</div>
                <div className="text-xs text-muted mt-0.5">
                  {t("Aparece no fim do texto enviado pelo WhatsApp.")}
                </div>
              </div>
              {!editandoInfoExtra && (
                <button
                  type="button"
                  onClick={() => {
                    setInfoExtraDraft(orc.infoExtra ?? "");
                    setEditandoInfoExtra(true);
                  }}
                  disabled={!podeEditarOrc}
                  title={!podeEditarOrc ? semPermissao : undefined}
                  className="btn-ghost text-xs inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pencil size={12} />
                  {t("Editar")}
                </button>
              )}
            </div>
            {editandoInfoExtra ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={infoExtraDraft}
                  onChange={(e) => setInfoExtraDraft(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={t("Ex: Promoção especial — desconto de 10% se confirmar até amanhã.")}
                  className="bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none focus:border-border-strong resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditandoInfoExtra(false);
                      setInfoExtraDraft("");
                    }}
                    disabled={salvandoInfoExtra}
                    className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
                  >
                    <X size={13} />
                    {t("Cancelar")}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setSalvandoInfoExtra(true);
                      try {
                        await updateOrcamento(orc.id, {
                          infoExtra: infoExtraDraft.trim() || undefined,
                        });
                        setEditandoInfoExtra(false);
                        setToast({ msg: t("Informações extras atualizadas."), tipo: "sucesso" });
                      } catch (e) {
                        setToast({ msg: (e as Error).message, tipo: "erro" });
                      } finally {
                        setSalvandoInfoExtra(false);
                      }
                    }}
                    disabled={salvandoInfoExtra}
                    className="btn btn-primary text-sm inline-flex items-center gap-1.5"
                  >
                    <Check size={13} />
                    {salvandoInfoExtra ? t("Salvando...") : t("Salvar")}
                  </button>
                </div>
              </div>
            ) : orc.infoExtra ? (
              <p className="text-sm text-secondary whitespace-pre-wrap">
                {orc.infoExtra}
              </p>
            ) : (
              <p className="text-sm text-muted italic">
                {t("Nenhuma informação extra. Clique em \"Editar\" pra adicionar.")}
              </p>
            )}
          </div>
        </div>

        {/* Coluna 2: Itens + preview */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="section-title mb-4">{t("Adicionais")}</div>
            <div className="flex flex-col gap-4 text-sm">
              <ItemsBlock title={t("Camarim / Consumação")} items={itensCamarim} />
              <ItemsBlock title={t("Efeitos")} items={itensEfeitos} />
              <ItemsBlock title={t("Hotel")} items={itensHotel} />
              <div>
                <div className="stat-label mb-1">{t("Logística")}</div>
                <div className="text-primary text-sm space-y-1">
                  {orc.logistica.aereaQtd === 0 && !orc.logistica.transladoTerrestre && (
                    <div>{t("Já inclusa do cachê")}</div>
                  )}
                  {orc.logistica.aereaQtd > 0 && (
                    <div>
                      {t("{n}× Logística Aérea (Ida e Volta)", { n: orc.logistica.aereaQtd })}
                    </div>
                  )}
                  {orc.logistica.transladoTerrestre && (
                    <div className="text-secondary">{t(TEXTO_TRANSLADO)}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title mb-3">{t("Pré-visualização do WhatsApp")}</div>
            <pre className="bg-elevated border border-border rounded-md p-3 text-xs text-primary whitespace-pre-wrap font-sans">
              {texto}
            </pre>
            <div className="text-xs text-muted mt-2">
              * {t("Asteriscos viram")} <strong>{t("negrito")}</strong> {t("no WhatsApp.")}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmação de duplicar */}
      <Modal
        isOpen={confirmaDuplicar}
        onClose={() => setConfirmaDuplicar(false)}
        title={t("Duplicar orçamento")}
        subtitle={t("Criar uma cópia de {num}?", { num: orc.numero })}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            {t("Vamos gerar um novo orçamento com os mesmos dados, em status")}{" "}
            <strong className="text-primary">{t("Pendente")}</strong>. {t("O número")}
            ({orc.numero}) {t("atual continua intacto.")}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setConfirmaDuplicar(false)}
              className="btn btn-secondary"
              disabled={duplicando}
            >
              {t("Cancelar")}
            </button>
            <button
              onClick={async () => {
                setDuplicando(true);
                try {
                  const novo = await duplicarOrcamento(orc.id);
                  setConfirmaDuplicar(false);
                  if (novo) {
                    setToast({
                      msg: t("Orçamento duplicado em {num}.", { num: novo.numero }),
                      tipo: "sucesso",
                      acaoLabel: t("Abrir"),
                      onAcao: () => {
                        setToast(null);
                        onAbrir?.(novo.id);
                      },
                    });
                  }
                } catch (e) {
                  setToast({ msg: (e as Error).message, tipo: "erro" });
                  setConfirmaDuplicar(false);
                } finally {
                  setDuplicando(false);
                }
              }}
              className="btn btn-primary"
              style={{ backgroundColor: accent, color: "#fff" }}
              disabled={duplicando}
            >
              {duplicando ? t("Duplicando...") : t("Duplicar")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast de feedback */}
      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        acaoLabel={toast?.acaoLabel}
        onAcao={toast?.onAcao}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

function InfoItem({
  label,
  value,
  bold,
  accent,
  missing,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
  missing?: boolean;
}) {
  const t = useT();
  return (
    <div>
      <div className="stat-label mb-0.5 flex items-center gap-1">
        {label}
        {missing && (
          <span className="text-warning" title={t("Será necessário para conversão em venda")}>
            ●
          </span>
        )}
      </div>
      <div
        className={`text-sm ${bold ? "font-bold text-base tabular-nums" : ""} ${missing ? "text-muted italic" : ""}`}
        style={bold && accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function ItemsBlock({
  title,
  items,
}: {
  title: string;
  items: { nome: string; qtd: number }[];
}) {
  const t = useT();
  return (
    <div>
      <div className="stat-label mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted italic">{t("Nenhum item selecionado")}</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((i) => (
            <li
              key={i.nome}
              className="flex items-center justify-between py-1.5 px-3 rounded-md bg-elevated border border-border text-sm"
            >
              <span className="text-primary truncate">{i.nome}</span>
              <span className="font-bold tabular-nums text-secondary">{i.qtd}×</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
