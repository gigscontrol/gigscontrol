"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { podeEditarVendaUI } from "@/lib/permissoes/gatesEquipeUI";
import { podeCancelarShowUI, podeEditarShowUI } from "@/lib/permissoes/gatesShow";
import { chaveDoSetor } from "@/lib/permissoes/setoresAgenda";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Hash,
  MapPin,
  Building2,
  Music,
  Trash2,
  Instagram,
  CalendarCheck2,
  CreditCard,
  DollarSign,
  Users,
  Clock,
  Pencil,
  Check,
  CheckCircle2,
  X,
  Hotel,
  Plane,
  Car,
  GlassWater,
  Sparkles,
  StickyNote,
  History,
  AlertTriangle,
  FileText,
} from "lucide-react";
import Modal from "./Modal";
import Toast from "./Toast";
import { FichaHeroPagina, Bloco, Linha, ItensGrid } from "./detalhes/FichaUI";
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
import { linhasLogistica } from "@/lib/logisticaTexto";
import { formatarMoeda } from "@/lib/formatters";
import { liquidoArtista } from "@/lib/taxaAgencia";
import { nomeCidadeFuso } from "./TimezoneSelect";
import {
  MODULE_THEMES,
  TEXTO_TRANSLADO,
  LABELS_STATUS_PARCELA,
  statusEfetivoParcela,
} from "@/types";

type Props = {
  vendaId: string;
  onBack: () => void;
  onEditar: (id: string) => void;
  /** D5 — a edição salvou sem recalcular as parcelas (alguma tem histórico). */
  avisoParcelasPreservadas?: boolean;
  onDispensarAvisoParcelas?: () => void;
};

/**
 * Detalhe da venda na LINGUAGEM DA FICHA, em escala de PÁGINA (redesign
 * 28/08/2026): herói largo com a cor do artista (FichaHeroPagina) + MALHA
 * ALINHADA — um único grid de 2 colunas onde cada linha de cards compartilha
 * a mesma altura (bordas e respiros alinhados "em #", pedido do Bruno), com
 * os cards intercalados: info à esquerda, dinheiro/operacional à direita.
 * Toda ação/permissão (editar, cancelar show, booking, rastro D6, remover)
 * mantida.
 */
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
  // /api/historico é admin-only (403 pros outros). Pra não-admin a seção nem existe.
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
        // DECRESCENTE, então a ação `criar` — o "Vendida por" — é sempre a
        // PRIMEIRA a cair fora da página; sem paginação aqui, 200 cabe.
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
    podeEditarVendaUI(podeUI, venda.artistaId || null, venda.criadoPor, sessao?.usuario.id);
  const podeExcluirVenda = podeUI(venda.artistaId || null, "vendas.excluir_venda");
  // REGRA L5b: mexer no SHOW é permissão de VENDAS, não de agenda. `show`
  // resolvido ANTES dos gates: o eixo de autoria depende de show.criadoPor.
  const show = venda.showId ? shows.find((s) => s.id === venda.showId) : null;
  const donoDoShow = { criadoPor: show?.criadoPor, meuUserId: sessao?.usuario.id };
  // Booking exige TAMBÉM o setor HOTEL (PII) — a chave viva é o setor.
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
  const itensTecnico = venda.tecnico.filter((i) => i.qtd > 0);
  const itensHotel = venda.hotel.filter((i) => i.qtd > 0);
  const linhasLog = linhasLogistica(venda.logistica);
  const temAdicionais =
    itensCamarim.length > 0 ||
    itensEfeitos.length > 0 ||
    itensTecnico.length > 0 ||
    itensHotel.length > 0;

  const dataLegivel = new Date(venda.dataShow + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Resumo do pagamento (mesma matemática do popup do show).
  const totalParcelas = venda.parcelas.reduce((a, p) => a + p.valor, 0);
  const pagoParcelas = venda.parcelas
    .filter((p) => statusEfetivoParcela(p) === "pago")
    .reduce((a, p) => a + p.valor, 0);
  const atrasadoParcelas = venda.parcelas
    .filter((p) => statusEfetivoParcela(p) === "atrasado")
    .reduce((a, p) => a + p.valor, 0);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <button onClick={onBack} className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft size={14} />
        {t("Voltar para Vendas")}
      </button>

      {/* ===== Herói de página (identidade da ficha, em escala de página) ===== */}
      <FichaHeroPagina
        artistaNome={artista?.name}
        artistaCor={artista?.color}
        linhaSuperior={dataLegivel}
        titulo={
          <>
            {venda.nomeEvento}
            <span className="text-secondary font-normal">
              {" "}· {t("Venda")}{" "}
              <span className="font-mono tabular-nums" style={{ color: accent }}>
                {venda.numero}
              </span>
            </span>
          </>
        }
        badges={
          <>
            <span className="badge badge-success">
              <CalendarCheck2 size={11} />
              {t("Concretizada")}
            </span>
            {cancelado && <span className="badge badge-danger">{t("Show cancelado")}</span>}
            {orc && (
              <span className="badge badge-neutral">
                <FileText size={11} />
                {t("Origem")} {orc.numero}
              </span>
            )}
            <span className="text-xs text-muted">
              {new Date(venda.criadoEm).toLocaleDateString("pt-BR")}
            </span>
          </>
        }
        acoes={
          podeEditarVenda ? (
            <button
              type="button"
              onClick={() => onEditar(venda.id)}
              className="btn btn-primary"
              style={{ backgroundColor: accent, color: "#fff" }}
            >
              <Pencil size={14} />
              {t("Editar venda")}
            </button>
          ) : undefined
        }
        rodape={
          venda.showId || podeEditarVenda ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Music size={14} style={{ color: cancelado ? "var(--danger)" : accent }} />
                {venda.showId
                  ? cancelado
                    ? t("Show cancelado")
                    : t("Show na agenda")
                  : t("Venda sem show na agenda")}
              </div>
              {venda.showId && (
                <button
                  type="button"
                  onClick={cancelarOuReativarShow}
                  disabled={processandoShow || !podeCancelarShow}
                  title={!podeCancelarShow ? semPermissao : undefined}
                  className="text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          ) : undefined
        }
      />

      {/* ===== MALHA ALINHADA: um grid só, 2 colunas — cada linha de cards
          compartilha a altura, então as bordas horizontais se alinham "em #".
          Os cards fluem intercalados: info à esquerda, dinheiro/operacional à
          direita. Condicionais ausentes só puxam o fluxo — o alinhamento
          por linha nunca quebra. ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <Bloco icon={<User size={14} />} title={t("Contratante")}>
            <Linha icon={<User size={13} />} bold>{venda.contratanteNome}</Linha>
            {venda.contratanteRazaoSocial && (
              <Linha icon={<Building2 size={13} />}>{venda.contratanteRazaoSocial}</Linha>
            )}
            {venda.contratanteTelefone && (
              <Linha icon={<Phone size={13} />}>+{venda.contratanteTelefone.replace(/\D/g, "")}</Linha>
            )}
            {venda.contratanteEmail && (
              <Linha icon={<Mail size={13} />}>{venda.contratanteEmail}</Linha>
            )}
            {venda.contratanteDocumento && (
              <Linha icon={<Hash size={13} />}>{mascararCpfCnpj(venda.contratanteDocumento)}</Linha>
            )}
            {venda.contratanteEndereco && (
              <Linha icon={<MapPin size={13} />}>{venda.contratanteEndereco}</Linha>
            )}
          </Bloco>
        </div>

        <div className="card">
          <Bloco icon={<CreditCard size={14} />} title={t("Pagamento")}>
            {/* D5 — a edição que acabou de salvar NÃO recalculou as parcelas.
                Banner (e não Toast no form) porque o form desmonta ao navegar
                pra cá. Só o usuário dispensa. */}
            {avisoParcelasPreservadas && (
              <div
                className="mb-2 flex items-start gap-3 rounded-md p-3"
                style={{ border: "1px solid var(--warning)", backgroundColor: "var(--warning-weak)" }}
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
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

            <Linha icon={<DollarSign size={13} />} bold>
              <span className="tabular-nums">{formatarMoeda2(venda.cache)}</span>
              <span className="text-xs text-muted font-normal"> {t("de cachê")}</span>
            </Linha>
            {venda.taxaAgenciaValor !== undefined && venda.taxaAgenciaValor > 0 && (
              <>
                <Linha icon={<DollarSign size={13} />}>
                  {t("Taxa de agência")}:{" "}
                  <span className="tabular-nums">{formatarMoeda2(venda.taxaAgenciaValor)}</span>
                </Linha>
                <Linha icon={<DollarSign size={13} />}>
                  {t("Líquido do artista")}:{" "}
                  <span className="font-semibold text-primary tabular-nums">
                    {formatarMoeda2(liquidoArtista(venda.cache, venda.taxaAgenciaValor))}
                  </span>
                </Linha>
              </>
            )}

            {venda.parcelas.length > 0 && (
              <>
                {/* Resumo — igual ao popup do show */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 mb-1 text-sm">
                  <span className="text-secondary">
                    {t("Recebido:")}{" "}
                    <span className="font-semibold" style={{ color: "var(--success)" }}>
                      {formatarMoeda2(pagoParcelas)}
                    </span>
                  </span>
                  <span className="text-secondary">
                    {t("A receber:")}{" "}
                    <span className="font-semibold text-primary">
                      {formatarMoeda2(totalParcelas - pagoParcelas)}
                    </span>
                  </span>
                  {atrasadoParcelas > 0 && (
                    <span className="text-secondary">
                      {t("Atrasado:")}{" "}
                      <span className="font-semibold" style={{ color: "var(--danger)" }}>
                        {formatarMoeda2(atrasadoParcelas)}
                      </span>
                    </span>
                  )}
                </div>

                {venda.parcelas.map((p, idx) => {
                  const st = statusEfetivoParcela(p);
                  const label = LABELS_STATUS_PARCELA[st];
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-border/50 last:border-0"
                    >
                      <div className="min-w-0">
                        <span className="text-primary font-medium">
                          {t("Parcela")} {idx + 1}/{venda.parcelas.length}
                        </span>
                        <span className="text-muted text-xs ml-1.5">({p.percentual.toFixed(0)}%)</span>
                        <div className="text-xs text-muted">
                          {t("Vence")}{" "}
                          {new Date(p.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                          {p.dataPagamento && (
                            <span style={{ color: "var(--success)" }}>
                              {" "}· {t("pago em")}{" "}
                              {new Date(p.dataPagamento + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold tabular-nums text-primary">
                          {formatarMoeda2(p.valor)}
                        </span>
                        <span className={`badge ${label.badge}`}>
                          {st === "pago" && <CheckCircle2 size={10} />}
                          {st === "pendente" && <Clock size={10} />}
                          {st === "atrasado" && <AlertTriangle size={10} />}
                          {t(label.label)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted mt-1">
                  {t("Gerencie os pagamentos em Financeiro → Controle de Pagamentos.")}
                </p>
              </>
            )}
          </Bloco>
        </div>

        <div className="card">
          <Bloco icon={<Building2 size={14} />} title={t("Local do evento")}>
            <Linha icon={<Building2 size={13} />} bold>{venda.nomeLocal}</Linha>
            {venda.eventoInstagram && (
              <Linha icon={<Instagram size={13} />}>{venda.eventoInstagram}</Linha>
            )}
            {venda.enderecoLocal && (
              <Linha icon={<MapPin size={13} />}>{venda.enderecoLocal}</Linha>
            )}
            {venda.capacidadePublico && (
              <Linha icon={<Users size={13} />}>
                {t("Capacidade:")} {venda.capacidadePublico.toLocaleString("pt-BR")} {t("pessoas")}
              </Linha>
            )}
          </Bloco>
        </div>

        {show && (podeEditarBooking || show.booking) && (
          <div className="card">
            <Bloco icon={<Hotel size={14} />} title={t("Hospedagem / Booking")}>
              <BookingSection
                showId={show.id}
                booking={show.booking}
                podeEditar={podeEditarBooking}
                onSave={async (booking) => {
                  await updateShow(show.id, { booking });
                }}
              />
            </Bloco>
          </div>
        )}

        <div className="card">
          <Bloco icon={<Music size={14} />} title={t("Detalhes do show")}>
            {venda.horario ? (
              <Linha icon={<Clock size={13} />} bold>
                {venda.horarioFim ? `${venda.horario} — ${venda.horarioFim}` : venda.horario}
                {venda.fusoHorario && (
                  <span className="text-xs text-muted font-normal"> · {nomeCidadeFuso(venda.fusoHorario)}</span>
                )}
                <span className="ml-2 text-xs text-muted font-normal">
                  ({formatarDuracao(venda.duracaoHoras, venda.duracaoMinutos ?? 0)})
                </span>
              </Linha>
            ) : (
              <Linha icon={<Clock size={13} />}>
                <span className="text-warning font-medium">{t("A definir")}</span>
                <span className="ml-2 text-xs text-muted font-normal">
                  · {t("Duração:")} {formatarDuracao(venda.duracaoHoras, venda.duracaoMinutos ?? 0)}
                </span>
              </Linha>
            )}
            {venda.lineUp && venda.lineUp.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {venda.lineUp.map((nome, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center bg-elevated border border-border rounded-md px-2.5 py-1 text-sm text-primary"
                  >
                    {nome}
                  </span>
                ))}
              </div>
            )}
          </Bloco>
        </div>

        {temAdicionais && (
          <div className="card">
            <div className="flex flex-col gap-5">
              {itensCamarim.length > 0 && (
                <Bloco icon={<GlassWater size={14} />} title={t("Camarim / Consumação")}>
                  <ItensGrid items={itensCamarim} />
                </Bloco>
              )}
              {itensEfeitos.length > 0 && (
                <Bloco icon={<Sparkles size={14} />} title={t("Efeitos")}>
                  <ItensGrid items={itensEfeitos} />
                </Bloco>
              )}
              {itensTecnico.length > 0 && (
                <Bloco icon={<Music size={14} />} title={t("Rider Técnico")}>
                  <ItensGrid items={itensTecnico} />
                </Bloco>
              )}
              {itensHotel.length > 0 && (
                <Bloco icon={<Hotel size={14} />} title={t("Hotel")}>
                  <ItensGrid items={itensHotel} />
                </Bloco>
              )}
            </div>
          </div>
        )}

        {venda.observacoes && (
          <div className="card">
            <Bloco icon={<StickyNote size={14} />} title={t("Observações internas")}>
              <p className="text-sm text-secondary whitespace-pre-wrap">{venda.observacoes}</p>
            </Bloco>
          </div>
        )}

        <div className="card">
          <Bloco icon={<Plane size={14} />} title={t("Logística")}>
            {linhasLog.length === 0 && (
              <Linha icon={<Plane size={13} />} subtle>{t("Já inclusa do cachê")}</Linha>
            )}
            {linhasLog.map((l, i) => (
              <Linha
                key={i}
                icon={l === TEXTO_TRANSLADO ? <Car size={13} /> : <Plane size={13} />}
                subtle={l === TEXTO_TRANSLADO}
              >
                {l}
              </Linha>
            ))}
          </Bloco>
        </div>

        <div className="card">
          <Bloco icon={<StickyNote size={14} />} title={t("Informações extras")}>
            {!editandoInfoExtra && (
              <div className="flex items-start justify-between gap-3 -mt-1">
                <span />
                <button
                  type="button"
                  onClick={() => {
                    setInfoExtraDraft(venda.infoExtra ?? "");
                    setEditandoInfoExtra(true);
                  }}
                  disabled={!podeEditarVenda}
                  title={!podeEditarVenda ? semPermissao : undefined}
                  className="btn-ghost text-xs inline-flex items-center gap-1 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pencil size={12} />
                  {t("Editar")}
                </button>
              </div>
            )}
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
          </Bloco>
        </div>

        {/* Rastro ocupa a linha inteira — conteúdo largo (nome+cargo+data+diff). */}
        {isAdmin && acoes.length > 0 && (
          <div className="card lg:col-span-2">
            <Bloco icon={<History size={14} />} title={t("Histórico de alterações")}>
              <div className="flex flex-col gap-3">
                {acoes.map((a) => (
                  <RastroItem key={a.id} acao={a} />
                ))}
              </div>
            </Bloco>
          </div>
        )}
      </div>

      {/* ===== Remover ===== */}
      <div className="flex justify-end mt-6">
        <button
          onClick={() => setConfirmaRemover(true)}
          disabled={!podeExcluirVenda}
          title={!podeExcluirVenda ? semPermissao : undefined}
          className="text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 size={12} />
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
  // Cargo derivado do profile ATUAL (cargo de HOJE). Ex-membro (soft delete)
  // continua aparecendo com cargo até o purge físico do profile.
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
