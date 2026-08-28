"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  podeConverterOrcamentoUI,
  podeEditarOrcamentoUI,
} from "@/lib/permissoes/gatesEquipeUI";
import {
  ArrowLeft,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Copy,
  AlertCircle,
  CalendarCheck2,
  Pencil,
  Check,
  X,
  User,
  Phone,
  Mail,
  Hash,
  Building2,
  MapPin,
  Music,
  CreditCard,
  DollarSign,
  GlassWater,
  Sparkles,
  Hotel,
  Plane,
  Car,
  StickyNote,
  Eye,
} from "lucide-react";
import Modal from "./Modal";
import Toast from "./Toast";
import { FichaHeroPagina, Bloco, Linha, ItensGrid } from "./detalhes/FichaUI";
import { useConfirmar } from "./ConfirmarModal";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { linhasLogistica } from "@/lib/logisticaTexto";
import { gerarTextoWhatsApp, montarLinkWhatsApp, formatarDuracao } from "@/lib/whatsapp";
import { formatarMoeda } from "@/lib/formatters";
import { liquidoArtista } from "@/lib/taxaAgencia";
import { nomeCidadeFuso } from "./TimezoneSelect";
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

/**
 * Detalhe do orçamento na LINGUAGEM DA FICHA, em escala de PÁGINA (redesign
 * 28/08/2026): herói largo com a cor do artista (FichaHeroPagina) + grid de
 * duas colunas com cards na gramática do popup do show (Bloco/Linha/
 * ItensGrid). Toda ação/permissão preservada.
 */
export default function OrcamentoDetalhe({ orcamentoId, onBack, onTransformarEmVenda, onAbrir }: Props) {
  const t = useT();
  const { podeUI, sessao } = useAuth();
  const userId = sessao?.usuario.id;
  const { confirmar, confirmador } = useConfirmar();
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos, marcarStatus, aceitarOrcamento, removeOrcamento, duplicarOrcamento, updateOrcamento } = useOrcamentos();
  const { contratantes, casas, cidades } = useContatos();
  const artistas = useArtistas();

  const [confirmaDuplicar, setConfirmaDuplicar] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  // Edição inline do campo "Informações extras" (aberta sob demanda).
  const [editandoInfoExtra, setEditandoInfoExtra] = useState(false);
  const [infoExtraDraft, setInfoExtraDraft] = useState("");
  const [salvandoInfoExtra, setSalvandoInfoExtra] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);
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

  const fmtM = (val: number) => formatarMoeda(val, orc.moeda);
  const cont = contratantes.find((c) => c.id === orc.contratanteId);
  const cs = orc.casaId ? casas.find((c) => c.id === orc.casaId) : undefined;
  const cid = cidades.find((c) => c.id === orc.cidadeId);
  const artista = artistas.find((d) => d.id === orc.artistaId);
  const st = LABELS_STATUS_ORCAMENTO[orc.status];

  // Permissões por artista (podeUI já libera admin/legado).
  const podeConverter = podeConverterOrcamentoUI(podeUI, orc.artistaId || null, orc.criadoPor, userId);
  const podeEditarOrc = podeEditarOrcamentoUI(podeUI, orc.artistaId || null, orc.criadoPor, userId);
  const podeExcluirOrc = podeUI(orc.artistaId || null, "vendas.excluir_orcamento");
  const semPermissao = t("Você não tem permissão para isso.");

  const texto = gerarTextoWhatsApp(orc, { contratante: cont, casa: cs, cidade: cid, artista });
  const linkWA = montarLinkWhatsApp(cont?.telefone ?? "", texto);

  const itensCamarim = orc.camarim.filter((i) => i.qtd > 0);
  const itensEfeitos = orc.efeitos.filter((i) => i.qtd > 0);
  const itensTecnico = orc.tecnico.filter((i) => i.qtd > 0);
  const itensHotel = orc.hotel.filter((i) => i.qtd > 0);
  const linhasLog = linhasLogistica(orc.logistica);

  // Quais dados faltam para virar venda?
  const camposFaltantes: string[] = [];
  if (!orc.dataShow) camposFaltantes.push(t("Data do show"));
  if (!orc.horario) camposFaltantes.push(t("Horário"));
  if (!orc.casaId) camposFaltantes.push(t("Casa / Local"));
  if (!cont?.email) camposFaltantes.push(t("E-mail do contratante"));
  if (!cont?.documento) camposFaltantes.push(t("CPF / CNPJ do contratante"));

  const dataLegivel = orc.dataShow
    ? new Date(orc.dataShow + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  /** "●" âmbar da ficha: campo que falta pra conversão em venda. */
  const Falta = () => (
    <span className="text-warning" title={t("Será necessário para conversão em venda")}>●</span>
  );

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <button onClick={onBack} className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft size={14} />
        {t("Voltar para Histórico")}
      </button>

      {/* ===== Herói de página ===== */}
      <FichaHeroPagina
        artistaNome={artista?.name}
        artistaCor={artista?.color}
        linhaSuperior={
          dataLegivel || (
            <span className="text-warning normal-case">{t("Data não definida")}</span>
          )
        }
        titulo={
          <>
            {cs?.nome ?? (cid ? `${cid.nome}, ${cid.estado}` : t("Orçamento"))}
            <span className="text-secondary font-normal">
              {" "}· {t("Orçamento")}{" "}
              <span className="font-mono tabular-nums" style={{ color: accent }}>
                {orc.numero}
              </span>
            </span>
          </>
        }
        badges={
          <>
            <span className={`badge ${st.badge}`}>{t(st.label)}</span>
            <span className="badge badge-neutral">{t(LABELS_TIPO_EVENTO[orc.tipoEvento])}</span>
            <span className="text-xs text-muted">
              {t("Criado em")} {new Date(orc.criadoEm).toLocaleDateString("pt-BR")}
            </span>
          </>
        }
        acoes={
          <>
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
          </>
        }
        rodape={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {orc.status !== "aceito" && (
              <button
                onClick={async () => {
                  const msg = !orc.dataShow
                    ? t("Aceitar este orçamento? Como não há data definida, nenhum show será criado na agenda automaticamente — adicione a data depois para isso.")
                    : t("Aceitar este orçamento? Um show será criado automaticamente na agenda.");
                  if (await confirmar({ titulo: t("Aceitar orçamento"), mensagem: msg })) aceitarOrcamento(orc.id);
                }}
                disabled={!podeEditarOrc}
                title={!podeEditarOrc ? semPermissao : undefined}
                className="text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ color: "var(--success)" }}
              >
                <CheckCircle2 size={12} />
                {t("Marcar aceito")}
              </button>
            )}
            {orc.status !== "negociacao" && orc.status !== "aceito" && (
              <button
                onClick={() => marcarStatus(orc.id, "negociacao")}
                disabled={!podeEditarOrc}
                title={!podeEditarOrc ? semPermissao : undefined}
                className="text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ color: "var(--warning)" }}
              >
                <Clock size={12} />
                {t("Em negociação")}
              </button>
            )}
            {orc.status !== "recusado" && orc.status !== "aceito" && (
              <button
                onClick={() => marcarStatus(orc.id, "recusado")}
                disabled={!podeEditarOrc}
                title={!podeEditarOrc ? semPermissao : undefined}
                className="text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ color: "var(--danger)" }}
              >
                <XCircle size={12} />
                {t("Recusar")}
              </button>
            )}
            <button
              onClick={() => setConfirmaDuplicar(true)}
              disabled={!podeEditarOrc}
              title={!podeEditarOrc ? semPermissao : undefined}
              className="text-xs font-semibold inline-flex items-center gap-1.5 text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Copy size={12} />
              {t("Duplicar")}
            </button>
            <button
              onClick={async () => {
                const ok = await confirmar({
                  titulo: t("Remover orçamento"),
                  mensagem: t("Remover este orçamento? Esta ação não pode ser desfeita."),
                  perigo: true,
                });
                if (ok) {
                  removeOrcamento(orc.id);
                  onBack();
                }
              }}
              disabled={!podeExcluirOrc}
              title={!podeExcluirOrc ? semPermissao : undefined}
              className="ml-auto text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={12} />
              {t("Remover")}
            </button>
          </div>
        }
      />

      {/* Alerta de dados faltando — só se status NÃO for recusado */}
      {orc.status !== "recusado" && camposFaltantes.length > 0 && (
        <div
          className="mb-4 flex items-start gap-3 rounded-md border p-3"
          style={{ borderColor: "var(--warning)", backgroundColor: "rgba(245,158,11,0.06)" }}
        >
          <AlertCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 text-xs">
            <span className="font-semibold text-primary text-sm block mb-0.5">
              {t("Dados pendentes para converter em venda")}
            </span>
            <span className="text-secondary">{camposFaltantes.join(" · ")}</span>
            <span className="block text-muted mt-1">
              {t("Você pode aceitar e enviar pelo WhatsApp normalmente; esses dados serão necessários quando o orçamento virar venda fechada.")}
            </span>
          </div>
        </div>
      )}

      {/* ===== Grid: 2 colunas de cards na linguagem da ficha ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 items-start">
        {/* ---- Coluna A ---- */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <Bloco icon={<Music size={14} />} title={t("Detalhes do show")}>
              {orc.horario ? (
                <Linha icon={<Clock size={13} />} bold>
                  {orc.horario}
                  {orc.fusoHorario && (
                    <span className="text-xs text-muted font-normal"> · {nomeCidadeFuso(orc.fusoHorario)}</span>
                  )}
                  <span className="ml-2 text-xs text-muted font-normal">
                    ({formatarDuracao(orc.duracaoHoras, orc.duracaoMinutos ?? 0)})
                  </span>
                </Linha>
              ) : (
                <Linha icon={<Clock size={13} />}>
                  <span className="text-warning font-medium">{t("A definir")}</span> <Falta />
                  <span className="ml-2 text-xs text-muted font-normal">
                    · {t("Duração:")} {formatarDuracao(orc.duracaoHoras, orc.duracaoMinutos ?? 0)}
                  </span>
                </Linha>
              )}
              <Linha icon={<CalendarCheck2 size={13} />} subtle={!orc.validade}>
                {t("Validade")}:{" "}
                {orc.validade
                  ? new Date(orc.validade + "T12:00:00").toLocaleDateString("pt-BR")
                  : <>— <Falta /></>}
              </Linha>
            </Bloco>
          </div>

          <div className="card">
            <Bloco icon={<User size={14} />} title={t("Contratante")}>
              <Linha icon={<User size={13} />} bold>{cont?.nome ?? "—"}</Linha>
              {cont?.telefone && <Linha icon={<Phone size={13} />}>+{cont.telefone.replace(/\D/g, "")}</Linha>}
              <Linha icon={<Mail size={13} />} subtle={!cont?.email}>
                {cont?.email || <>— <Falta /></>}
              </Linha>
              <Linha icon={<Hash size={13} />} subtle={!cont?.documento}>
                {mascararCpfCnpj(cont?.documento) || <>— <Falta /></>}
              </Linha>
            </Bloco>
          </div>

          <div className="card">
            <Bloco icon={<Building2 size={14} />} title={t("Local do evento")}>
              <Linha icon={<Building2 size={13} />} bold subtle={!cs}>
                {cs?.nome ?? <>— <Falta /></>}
              </Linha>
              {cid && (
                <Linha icon={<MapPin size={13} />}>
                  {cid.nome}, {cid.estado}
                  {cid.regiao && <span className="text-muted"> · {cid.regiao}</span>}
                </Linha>
              )}
            </Bloco>
          </div>

          {orc.observacoes && (
            <div className="card">
              <Bloco icon={<StickyNote size={14} />} title={t("Observações internas")}>
                <p className="text-sm text-secondary whitespace-pre-wrap">{orc.observacoes}</p>
              </Bloco>
            </div>
          )}

          <div className="card">
            <Bloco icon={<StickyNote size={14} />} title={t("Informações extras")}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs text-muted -mt-1 mb-1">
                  {t("Aparece no fim do texto enviado pelo WhatsApp.")}
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
                    className="btn-ghost text-xs inline-flex items-center gap-1 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p className="text-sm text-secondary whitespace-pre-wrap">{orc.infoExtra}</p>
              ) : (
                <p className="text-sm text-muted italic">
                  {t("Nenhuma informação extra. Clique em \"Editar\" pra adicionar.")}
                </p>
              )}
            </Bloco>
          </div>

          <div className="card">
            <Bloco icon={<MessageCircle size={14} />} title={t("Pré-visualização do WhatsApp")}>
              {previewAberto ? (
                <>
                  <pre className="bg-elevated border border-border rounded-md p-3 text-xs text-primary whitespace-pre-wrap font-sans">
                    {texto}
                  </pre>
                  <div className="text-xs text-muted mt-1">
                    * {t("Asteriscos viram")} <strong>{t("negrito")}</strong> {t("no WhatsApp.")}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreviewAberto(true)}
                  className="btn-ghost text-xs inline-flex items-center gap-1.5 self-start"
                >
                  <Eye size={12} />
                  {t("Ver a mensagem que será enviada")}
                </button>
              )}
            </Bloco>
          </div>
        </div>

        {/* ---- Coluna B ---- */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <Bloco icon={<CreditCard size={14} />} title={t("Pagamento")}>
              <Linha icon={<DollarSign size={13} />} bold>
                <span className="tabular-nums">{fmtM(orc.valorCache)}</span>
                <span className="text-xs text-muted font-normal"> {t("de cachê")}</span>
              </Linha>
              {orc.taxaAgenciaValor !== undefined && orc.taxaAgenciaValor > 0 && (
                <>
                  <Linha icon={<DollarSign size={13} />}>
                    {t("Taxa de agência")}: <span className="tabular-nums">{fmtM(orc.taxaAgenciaValor)}</span>
                  </Linha>
                  <Linha icon={<DollarSign size={13} />}>
                    {t("Líquido do artista")}:{" "}
                    <span className="font-semibold text-primary tabular-nums">
                      {fmtM(liquidoArtista(orc.valorCache ?? 0, orc.taxaAgenciaValor))}
                    </span>
                  </Linha>
                </>
              )}
            </Bloco>
          </div>

          {(itensCamarim.length > 0 ||
            itensEfeitos.length > 0 ||
            itensTecnico.length > 0 ||
            itensHotel.length > 0) && (
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

      {confirmador}
    </div>
  );
}
