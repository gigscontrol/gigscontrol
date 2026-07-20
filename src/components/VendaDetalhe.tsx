"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { podeCancelarShowUI, podeEditarShowUI } from "@/lib/permissoes/gatesShow";
import { chaveDoSetor } from "@/lib/permissoes/setoresAgenda";
import { ArrowLeft, User, MapPin, Music, Trash2, Instagram, CalendarCheck2, CreditCard, Pencil, Check, X, Hotel, History, AlertTriangle } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import { useConfirmar } from "./ConfirmarModal";
import AlteracoesModal, { temDetalhe } from "./AlteracoesModal";
import type { HistoricoAcao } from "@/lib/mappers/historico";
import { LABELS_PAPEL } from "@/lib/permissoes";
import BookingSection from "./agenda/BookingSection";
import { useVendas } from "@/lib/vendas-context";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useArtistas } from "@/lib/workspace-context";
import { mascararCpfCnpj } from "@/lib/formatters";
import { formatarDuracao } from "@/lib/whatsapp";
import { formatarMoeda } from "@/lib/formatters";
import { liquidoArtista } from "@/lib/taxaAgencia";
import { nomeCidadeFuso } from "./TimezoneSelect";
import { MODULE_THEMES, TEXTO_TRANSLADO, LABELS_STATUS_PARCELA, statusEfetivoParcela } from "@/types";

type Props = {
  vendaId: string;
  onBack: () => void;
  onEditar: (id: string) => void;
  /** D5 — a edição salvou sem recalcular as parcelas (alguma tem histórico). */
  avisoParcelasPreservadas?: boolean;
  onDispensarAvisoParcelas?: () => void;
};

export default function VendaDetalhe({
  vendaId,
  onBack,
  onEditar,
  avisoParcelasPreservadas,
  onDispensarAvisoParcelas,
}: Props) {
  const t = useT();
  const { podeUI, sessao } = useAuth();
  const { confirmar, confirmador } = useConfirmar();
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

  // ---- Rastro de alterações (D6 — antifraude) ----
  // /api/historico é admin-only (403 pros outros) — mesmo gate do
  // AgenciaDashboard.tsx:102. Pra não-admin a seção nem existe.
  const isAdmin = sessao?.usuario.papel === "admin";
  const [acoes, setAcoes] = useState<HistoricoAcao[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      setAcoes([]);
      return;
    }
    let ativo = true;
    (async () => {
      try {
        // limit no teto da rota (clampInt 1..200): o rastro vem em ordem
        // DECRESCENTE, então a ação `criar` — o "Vendida por", o dado que D4
        // nomeia primeiro — é sempre a PRIMEIRA a cair fora da página. Como não
        // há paginação aqui, cortar em 20 sumiria com ela numa venda muito
        // editada. É rastro de UMA venda, não a trilha do workspace: cabe.
        const res = await fetch(
          `/api/historico?modulo=venda&entidade=${encodeURIComponent(vendaId)}&limit=200`,
          { credentials: "include" }
        );
        if (!res.ok) {
          if (ativo) setAcoes([]);
          return;
        }
        const body = (await res.json()) as { historico?: HistoricoAcao[] };
        if (ativo) setAcoes(Array.isArray(body.historico) ? body.historico : []);
      } catch {
        // Best-effort: sem rastro a tela segue inteira (a seção só some).
        if (ativo) setAcoes([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [vendaId, isAdmin]);

  const venda = vendas.find((v) => v.id === vendaId);
  const formatarMoeda2 = (val: number) => formatarMoeda(val, venda?.moeda ?? "BRL");

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

  const artista = artistas.find((d) => d.id === venda.artistaId);
  // Permissões por artista (podeUI já libera admin/legado).
  const podeEditarVenda =
    podeUI(venda.artistaId || null, "vendas.editar_venda") ||
    podeUI(venda.artistaId || null, "vendas.editar_todos");
  const podeExcluirVenda = podeUI(venda.artistaId || null, "vendas.excluir_venda");
  // REGRA NOVA (L5b): mexer no SHOW é permissão de VENDAS, não de agenda.
  // Booking edita o show → vendas.editar_venda|editar_todos (o servidor exige
  // a mesma); cancelar/reativar o show → vendas.cancelar_venda. Quem tinha só
  // agenda.editar_todos PERDE estes botões de propósito.
  // `show` tem que ser resolvido ANTES dos gates: as chaves sem "_todos" são de
  // escopo "próprios" e dependem de `show.criadoPor` (espelha podeMutar).
  const show = venda.showId ? shows.find((s) => s.id === venda.showId) : null;
  const donoDoShow = { criadoPor: show?.criadoPor, meuUserId: sessao?.usuario.id };
  // Booking exige MAIS que editar o show: o servidor ([id]/route.ts) também
  // pede o setor HOTEL, porque hospedagem carrega PII. A chave era
  // `agenda.ver_detalhado`, mas ela virou LEGADO — `expandirLegadoAgenda` a
  // apaga de TODA sessão no cliente, então checá-la aqui era sempre `false` e
  // o Hotel virava só-leitura pra qualquer não-admin. A chave viva é o setor.
  const podeEditarBooking =
    podeEditarShowUI(podeUI, venda.artistaId || null, donoDoShow) &&
    podeUI(venda.artistaId || null, chaveDoSetor("hotel"));
  const podeCancelarShow = podeCancelarShowUI(podeUI, venda.artistaId || null, donoDoShow);
  const semPermissao = t("Você não tem permissão para isso.");
  const cancelado = show?.status === "cancelado";
  const showIdLigado = venda.showId;

  async function cancelarOuReativarShow() {
    if (processandoShow || !showIdLigado) return;
    if (
      !cancelado &&
      !(await confirmar({
        titulo: t("Cancelar este show?"),
        mensagem: t(
          "O evento no Google Agenda fica VERMELHO (não é apagado — você apaga manualmente se quiser)."
        ),
        confirmarLabel: t("Cancelar show"),
        perigo: true,
      }))
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

      {/* Editar a venda + cancelar/reativar o show ligado (D3: os dois lado a
          lado). A barra também aparece na venda SEM show, só com o editar. */}
      {(venda.showId || podeEditarVenda) && (
        <div className="bg-surface border border-border rounded flex flex-wrap items-center justify-between gap-3 mb-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Music size={14} style={{ color: cancelado ? "var(--danger)" : accent }} />
            <span className="text-sm text-secondary">
              {venda.showId
                ? cancelado
                  ? t("Show cancelado")
                  : t("Show na agenda")
                : t("Venda sem show na agenda")}
            </span>
            {cancelado && <span className="badge badge-danger">{t("Cancelado")}</span>}
          </div>
          <div className="flex items-center gap-4">
            {podeEditarVenda && (
              <button
                type="button"
                onClick={() => onEditar(venda.id)}
                className="text-sm font-semibold inline-flex items-center gap-1.5"
                style={{ color: accent }}
              >
                <Pencil size={14} />
                {t("Editar venda")}
              </button>
            )}
            {venda.showId && (
              <button
                type="button"
                onClick={cancelarOuReativarShow}
                disabled={processandoShow || !podeCancelarShow}
                title={!podeCancelarShow ? semPermissao : undefined}
                className="text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: cancelado ? "var(--success)" : "var(--danger)" }}
              >
                {processandoShow
                  ? t("Salvando…")
                  : cancelado
                  ? t("Reativar show")
                  : t("Cancelar show")}
              </button>
            )}
          </div>
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
            {venda.contratanteRazaoSocial && (
              <InfoLine label={t("Razão Social")} value={venda.contratanteRazaoSocial} />
            )}
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
                (venda.horario
                  ? venda.horarioFim
                    ? `${venda.horario} — ${venda.horarioFim}`
                    : venda.horario
                  : t("A definir")) +
                (venda.fusoHorario ? ` · ${nomeCidadeFuso(venda.fusoHorario)}` : "")
              }
              bold
            />
          </div>

          {/* Pagamento / Parcelas */}
          <div className="card">
            <SectionTitle icon={<CreditCard size={14} />} title={t("Pagamento")} accent={accent} />
            {/* D5 — a edição que acabou de salvar NÃO recalculou as parcelas.
                Banner (e não Toast no form) porque o form desmonta ao navegar
                pra cá: o aviso tem que sobreviver e ficar onde dá pra agir. Só
                o usuário dispensa — some sozinho seria o bug de novo. */}
            {avisoParcelasPreservadas && (
              <div
                className="mb-3 flex items-start gap-3 rounded-md p-3"
                style={{
                  border: "1px solid var(--warning)",
                  backgroundColor: "var(--warning-weak)",
                }}
              >
                <AlertTriangle
                  size={16}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: "var(--warning)" }}
                />
                <div className="text-sm text-secondary">
                  {t("Parcelas não recalculadas: alguma tem histórico financeiro (paga, cancelada, cobrada ou fixada) e foi preservada. Se o cachê mudou, revise em Financeiro → Controle de Pagamentos.")}
                </div>
                <button
                  onClick={onDispensarAvisoParcelas}
                  className="btn-ghost flex-shrink-0 p-1"
                  aria-label={t("Dispensar aviso")}
                >
                  <X size={14} />
                </button>
              </div>
            )}
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
                        {formatarMoeda2(p.valor)}
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
            <InfoLine label={t("Artista da agência")} value={artista?.name ?? "—"} bold />
            <InfoLine
              label={t("Cachê")}
              value={
                <span className="font-bold text-base tabular-nums" style={{ color: accent }}>
                  {formatarMoeda2(venda.cache)}
                </span>
              }
            />
            {venda.taxaAgenciaValor !== undefined && venda.taxaAgenciaValor > 0 && (
              <>
                <InfoLine
                  label={t("Taxa de agência")}
                  value={formatarMoeda2(venda.taxaAgenciaValor)}
                />
                <InfoLine
                  label={t("Líquido do artista")}
                  value={
                    <span className="font-bold text-base tabular-nums" style={{ color: accent }}>
                      {formatarMoeda2(liquidoArtista(venda.cache, venda.taxaAgenciaValor))}
                    </span>
                  }
                />
              </>
            )}
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

          {show && (podeEditarBooking || show.booking) && (
            <div className="card">
              <SectionTitle icon={<Hotel size={14} />} title={t("Hospedagem / Booking")} accent={accent} />
              <BookingSection
                showId={show.id}
                booking={show.booking}
                podeEditar={podeEditarBooking}
                onSave={async (booking) => {
                  await updateShow(show.id, { booking });
                }}
              />
            </div>
          )}

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

      {/* Rastro de alterações (D6) — admin-only, best-effort: sem dados, some. */}
      {isAdmin && acoes.length > 0 && (
        <div className="card mt-4">
          <SectionTitle
            icon={<History size={14} />}
            title={t("Histórico de alterações")}
            accent={accent}
          />
          <div className="flex flex-col gap-3">
            {acoes.map((a) => (
              <RastroItem key={a.id} acao={a} />
            ))}
          </div>
        </div>
      )}

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

      {confirmador}
    </div>
  );
}

/**
 * Verbo da linha do rastro (D4). Tipos fora da lista (remover/restaurar…) caem
 * no genérico — a linha aparece mesmo assim, sem inventar rótulo errado.
 */
const VERBO_RASTRO: Partial<Record<HistoricoAcao["tipo"], string>> = {
  criar: "Vendida por",
  editar: "Editada por",
  cancelar: "Cancelada por",
};

/** Uma linha do rastro: "Vendida por — Nome — Cargo — Data" + popup do diff. */
function RastroItem({ acao }: { acao: HistoricoAcao }) {
  const t = useT();
  const [verDetalhe, setVerDetalhe] = useState(false);
  const quando = new Date(acao.criadoEm);
  const verbo = VERBO_RASTRO[acao.tipo] ?? "Ação de";
  const nome = acao.actorNome ?? acao.actorEmail ?? t("Alguém");
  // Cargo é derivado do profile ATUAL (cargo de HOJE, não o da época). Sair da
  // equipe é SOFT delete, então ex-membro CONTINUA aparecendo com cargo: o
  // segmento só some depois do purge físico do profile (ou se a RLS esconder) —
  // e aí é nome+data sem "—" órfão.
  const cargo = acao.actorPapel ? LABELS_PAPEL[acao.actorPapel]?.nome : null;
  const data = `${quando.toLocaleDateString("pt-BR")} ${t("às")} ${quando.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" }
  )}`;

  return (
    <div className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-muted">{t(verbo)}</span>
        <span className="font-semibold text-primary">{nome}</span>
        {cargo && (
          <>
            <span className="text-muted">—</span>
            <span className="text-secondary">{t(cargo)}</span>
          </>
        )}
        <span className="text-muted">—</span>
        <span className="text-muted">{data}</span>
        {temDetalhe(acao) && (
          <button
            onClick={() => setVerDetalhe(true)}
            className="btn btn-ghost text-xs py-0.5 px-2"
          >
            {t("Ver alterações")}
          </button>
        )}
      </div>
      <div className="text-sm text-secondary mt-0.5">{acao.descricao}</div>
      {verDetalhe && (
        <AlteracoesModal aberto onFechar={() => setVerDetalhe(false)} acao={acao} />
      )}
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
