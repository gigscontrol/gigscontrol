"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, User, MapPin, Music, Trash2, Instagram, CalendarCheck2, CreditCard, Pencil, Check, X } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import { useVendas } from "@/lib/vendas-context";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useArtistas } from "@/lib/workspace-context";
import { mascararCpfCnpj } from "@/lib/formatters";
import { formatBRL, formatarDuracao } from "@/lib/whatsapp";
import { MODULE_THEMES, TEXTO_TRANSLADO, LABELS_STATUS_PARCELA, statusEfetivoParcela } from "@/types";

type Props = {
  vendaId: string;
  onBack: () => void;
};

export default function VendaDetalhe({ vendaId, onBack }: Props) {
  const t = useT();
  const { podeUI } = useAuth();
  const accent = MODULE_THEMES.vendas.color;
  const { vendas, removeVenda, updateVenda } = useVendas();
  const { shows, updateShow } = useShows();
  const { orcamentos } = useOrcamentos();
  const artistas = useArtistas();
  const [confirmaRemover, setConfirmaRemover] = useState(false);
  const [processandoShow, setProcessandoShow] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  // Edição inline de "Informações extras" — herdado do orçamento mas
  // editável de novo aqui se o admin quiser ajustar pra venda.
  const [editandoInfoExtra, setEditandoInfoExtra] = useState(false);
  const [infoExtraDraft, setInfoExtraDraft] = useState("");
  const [salvandoInfoExtra, setSalvandoInfoExtra] = useState(false);

  const venda = vendas.find((v) => v.id === vendaId);

  if (!venda) {
    return (
      <div className="max-w-[800px] mx-auto w-full p-6 lg:p-8">
        <button onClick={onBack} className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} />
          {t("Voltar")}
        </button>
        <div className="card text-center py-12">
          <div className="section-title">{t("Venda não encontrada")}</div>
        </div>
      </div>
    );
  }

  const dj = artistas.find((d) => d.id === venda.djId);
  // Permissões por artista (podeUI já libera admin/legado).
  const podeEditarVenda =
    podeUI(venda.djId || null, "vendas.editar_venda") ||
    podeUI(venda.djId || null, "vendas.editar_todos");
  const podeExcluirVenda = podeUI(venda.djId || null, "vendas.excluir_venda");
  const semPermissao = t("Você não tem permissão para isso.");
  const show = venda.showId ? shows.find((s) => s.id === venda.showId) : null;
  const cancelado = show?.status === "cancelado";
  const showIdLigado = venda.showId;

  async function cancelarOuReativarShow() {
    if (processandoShow || !showIdLigado) return;
    if (
      !cancelado &&
      !window.confirm(
        t("Cancelar este show? O evento no Google Agenda fica VERMELHO (não é apagado — você apaga manualmente se quiser).")
      )
    ) {
      return;
    }
    setProcessandoShow(true);
    try {
      await updateShow(showIdLigado, {
        status: cancelado ? "confirmado" : "cancelado",
      });
      setToastMsg({
        msg: cancelado
          ? t("Show reativado.")
          : t("Show cancelado — evento marcado em vermelho no Google."),
        tipo: "sucesso",
      });
    } catch (e) {
      setToastMsg({
        msg: (e as Error).message ?? t("Falha ao atualizar o show."),
        tipo: "erro",
      });
    } finally {
      setProcessandoShow(false);
    }
  }

  const orc = venda.orcamentoId ? orcamentos.find((o) => o.id === venda.orcamentoId) : null;
  const itensCamarim = venda.camarim.filter((i) => i.qtd > 0);
  const itensEfeitos = venda.efeitos.filter((i) => i.qtd > 0);
  const itensHotel = venda.hotel.filter((i) => i.qtd > 0);

  return (
    <div className="max-w-[1100px] mx-auto w-full p-6 lg:p-8">
      <button onClick={onBack} className="btn-ghost mb-6 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft size={14} />
        {t("Voltar para Vendas")}
      </button>

      <PageHeader
        title={`Venda ${venda.numero}`}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="badge badge-success">
              <CalendarCheck2 size={11} />
              {t("Concretizada")}
            </span>
            {orc && (
              <>
                <span className="text-muted">·</span>
                <span className="text-secondary">
                  {t("Originada do orçamento")}{" "}
                  <span className="font-mono" style={{ color: accent }}>
                    {orc.numero}
                  </span>
                </span>
              </>
            )}
            <span className="text-muted">·</span>
            <span>{new Date(venda.criadoEm).toLocaleDateString("pt-BR")}</span>
          </span>
        }
        accentColor={accent}
      />

      {/* Cancelar / reativar o show ligado (reflete a cor no Google Agenda) */}
      {venda.showId && (
        <div className="bg-surface border border-border rounded flex flex-wrap items-center justify-between gap-3 mb-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Music size={14} style={{ color: cancelado ? "var(--danger)" : accent }} />
            <span className="text-sm text-secondary">
              {cancelado ? t("Show cancelado") : t("Show na agenda")}
            </span>
            {cancelado && <span className="badge badge-danger">{t("Cancelado")}</span>}
          </div>
          <button
            type="button"
            onClick={cancelarOuReativarShow}
            disabled={processandoShow}
            className="text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            style={{ color: cancelado ? "var(--success)" : "var(--danger)" }}
          >
            {processandoShow
              ? t("Salvando…")
              : cancelado
              ? t("Reativar show")
              : t("Cancelar show")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* Coluna 1 */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <SectionTitle icon={<User size={14} />} title={t("Contratante")} accent={accent} />
            <InfoLine label={t("Nome")} value={venda.contratanteNome} />
            <InfoLine label={t("E-mail")} value={venda.contratanteEmail || "—"} />
            <InfoLine
              label={t("Telefone")}
              value={venda.contratanteTelefone ? `+${venda.contratanteTelefone}` : "—"}
            />
            <InfoLine label={t("CPF/CNPJ")} value={mascararCpfCnpj(venda.contratanteDocumento) || "—"} />
            <InfoLine label={t("Endereço")} value={venda.contratanteEndereco || "—"} />
          </div>

          <div className="card">
            <SectionTitle icon={<MapPin size={14} />} title={t("Evento")} accent={accent} />
            <InfoLine label={t("Nome")} value={venda.nomeEvento} bold />
            {venda.eventoInstagram && (
              <InfoLine
                label={t("Instagram")}
                value={
                  <span className="inline-flex items-center gap-1">
                    <Instagram size={11} />
                    {venda.eventoInstagram}
                  </span>
                }
              />
            )}
            <InfoLine label={t("Local")} value={venda.nomeLocal} />
            {venda.capacidadePublico && (
              <InfoLine
                label={t("Capacidade")}
                value={`${venda.capacidadePublico.toLocaleString("pt-BR")} ${t("pessoas")}`}
              />
            )}
            <InfoLine label={t("Endereço")} value={venda.enderecoLocal} />
            <InfoLine
              label={t("Data")}
              value={new Date(venda.dataShow + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              bold
            />
            <InfoLine
              label={t("Horário")}
              value={
                venda.horarioFim
                  ? `${venda.horario} — ${venda.horarioFim}`
                  : venda.horario
              }
              bold
            />
          </div>

          {/* Pagamento / Parcelas */}
          <div className="card">
            <SectionTitle icon={<CreditCard size={14} />} title={t("Pagamento")} accent={accent} />
            <div className="flex flex-col gap-2">
              {venda.parcelas.map((p, idx) => {
                const st = statusEfetivoParcela(p);
                const label = LABELS_STATUS_PARCELA[st];
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-primary">
                        {t("Parcela")} {idx + 1}/{venda.parcelas.length}
                        <span className="text-muted text-xs ml-1.5">
                          ({p.percentual.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        {t("Vence")}{" "}
                        {new Date(p.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                        {p.dataPagamento && (
                          <span className="text-success">
                            {" "}
                            · {t("pago em")}{" "}
                            {new Date(
                              p.dataPagamento + "T12:00:00"
                            ).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {formatBRL(p.valor)}
                      </span>
                      <span className={`badge ${label.badge}`}>{t(label.label)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-3">
              {t("Gerencie os pagamentos em Financeiro → Controle de Pagamentos.")}
            </p>
          </div>

          {venda.observacoes && (
            <div className="card">
              <div className="section-title mb-2">{t("Observações internas")}</div>
              <p className="text-sm text-secondary whitespace-pre-wrap">{venda.observacoes}</p>
            </div>
          )}

          {/* Informações extras — herdadas do orçamento + editáveis */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="section-title">{t("Informações extras")}</div>
              {!editandoInfoExtra && (
                <button
                  type="button"
                  onClick={() => {
                    setInfoExtraDraft(venda.infoExtra ?? "");
                    setEditandoInfoExtra(true);
                  }}
                  disabled={!podeEditarVenda}
                  title={!podeEditarVenda ? semPermissao : undefined}
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
                  placeholder={t("Algo extra que apareceu no orçamento ou queira anotar.")}
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
                        await updateVenda(venda.id, {
                          infoExtra: infoExtraDraft.trim() || undefined,
                        });
                        setEditandoInfoExtra(false);
                        setToastMsg({ msg: t("Informações extras atualizadas."), tipo: "sucesso" });
                      } catch (e) {
                        setToastMsg({ msg: (e as Error).message, tipo: "erro" });
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
            ) : venda.infoExtra ? (
              <p className="text-sm text-secondary whitespace-pre-wrap">{venda.infoExtra}</p>
            ) : (
              <p className="text-sm text-muted italic">
                {t("Nenhuma informação extra. Clique em \"Editar\" pra adicionar.")}
              </p>
            )}
          </div>
        </div>

        {/* Coluna 2 */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <SectionTitle icon={<Music size={14} />} title={t("Show")} accent={accent} />
            <InfoLine label={t("Artista da agência")} value={dj?.name ?? "—"} bold />
            <InfoLine
              label={t("Cachê")}
              value={
                <span className="font-bold text-base tabular-nums" style={{ color: accent }}>
                  {formatBRL(venda.cache)}
                </span>
              }
            />
            <InfoLine
              label={t("Duração")}
              value={formatarDuracao(venda.duracaoHoras, venda.duracaoMinutos ?? 0)}
            />
            {venda.lineUp && venda.lineUp.length > 0 && (
              <InfoLine
                label={t("Line-Up")}
                value={
                  <div className="flex flex-wrap gap-1">
                    {venda.lineUp.map((nome, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center bg-elevated border border-border rounded-md px-2 py-0.5 text-xs"
                      >
                        {nome}
                      </span>
                    ))}
                  </div>
                }
              />
            )}
          </div>

          <div className="card">
            <div className="section-title mb-3">{t("Adicionais")}</div>
            <ItemsList title={t("Camarim / Consumação")} items={itensCamarim} />
            <ItemsList title={t("Efeitos")} items={itensEfeitos} />
            <ItemsList title={t("Hotel")} items={itensHotel} />
            <div className="mt-3">
              <div className="stat-label mb-1">{t("Logística")}</div>
              <div className="text-sm text-primary space-y-1">
                {venda.logistica.aereaQtd === 0 && !venda.logistica.transladoTerrestre && (
                  <div>{t("Já inclusa do cachê")}</div>
                )}
                {venda.logistica.aereaQtd > 0 && (
                  <div>{t("{n}× Logística Aérea (Ida e Volta)", { n: venda.logistica.aereaQtd })}</div>
                )}
                {venda.logistica.transladoTerrestre && (
                  <div className="text-secondary">{t(TEXTO_TRANSLADO)}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={() => setConfirmaRemover(true)}
          disabled={!podeExcluirVenda}
          title={!podeExcluirVenda ? semPermissao : undefined}
          className="btn btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 size={14} />
          {t("Remover venda")}
        </button>
      </div>

      {/* Confirmação de remover */}
      <Modal
        isOpen={confirmaRemover}
        onClose={() => setConfirmaRemover(false)}
        title={t("Remover venda")}
        subtitle={t("Esta ação não pode ser desfeita.")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            {t("A venda")} <strong className="text-primary">{venda.numero}</strong> {t("e suas parcelas serão apagadas. O")} <strong className="text-primary">{t("show vinculado")}</strong> {t("também será removido da agenda.")}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setConfirmaRemover(false)}
              className="btn btn-secondary"
              disabled={removendo}
            >
              {t("Cancelar")}
            </button>
            <button
              onClick={async () => {
                setRemovendo(true);
                try {
                  await removeVenda(venda.id);
                  onBack();
                } catch (e) {
                  setToastMsg({ msg: (e as Error).message, tipo: "erro" });
                  setConfirmaRemover(false);
                } finally {
                  setRemovendo(false);
                }
              }}
              className="btn btn-primary"
              style={{ backgroundColor: "var(--danger)", color: "#fff" }}
              disabled={removendo}
            >
              {removendo ? t("Removendo...") : t("Remover")}
            </button>
          </div>
        </div>
      </Modal>

      <Toast
        open={!!toastMsg}
        mensagem={toastMsg?.msg ?? ""}
        tipo={toastMsg?.tipo ?? "sucesso"}
        onClose={() => setToastMsg(null)}
      />
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}20`, color: accent }}
      >
        {icon}
      </div>
      <div className="section-title">{title}</div>
    </div>
  );
}

function InfoLine({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex flex-col py-1.5 sm:flex-row sm:gap-3">
      <div className="stat-label sm:w-28 flex-shrink-0">{label}</div>
      <div className={`text-sm flex-1 min-w-0 ${bold ? "font-semibold text-primary" : "text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

function ItemsList({ title, items }: { title: string; items: { nome: string; qtd: number }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="stat-label mb-1.5">{title}</div>
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
    </div>
  );
}
