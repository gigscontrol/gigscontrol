"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { podeEditarVendaUI } from "@/lib/permissoes/gatesEquipeUI";
import { podeCancelarShowUI, podeEditarShowUI } from "@/lib/permissoes/gatesShow";
import Avatar from "./Avatar";
import type { FichaShow } from "@/lib/agenda/ficha";
import { chaveDoSetor, type SetorAgenda } from "@/lib/permissoes/setoresAgenda";
import {
  Building2,
  MapPin,
  Users,
  Clock,
  DollarSign,
  User,
  Mail,
  MessageCircle,
  Phone,
  FileText,
  FileSignature,
  CalendarCheck2,
  ExternalLink,
  Instagram,
  Music,
  Hash,
  Hotel,
  Sparkles,
  Plane,
  Car,
  GlassWater,
  StickyNote,
  CreditCard,
  AlertTriangle,
  Pencil,
  Ban,
  RotateCcw,
} from "lucide-react";
import Modal from "./Modal";
import { Bloco, Linha, ItensGrid } from "./detalhes/FichaUI";
import { useConfirmar, useAviso } from "./ConfirmarModal";
import BookingSection from "./agenda/BookingSection";
import NotasDoShow from "./anotacoes/NotasDoShow";
import { useAnotacoes } from "@/lib/anotacoes-context";
import { useShows } from "@/lib/shows-context";
import { useContatos } from "@/lib/contatos-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useContratos } from "@/lib/contratos-context";
import { useArtistas } from "@/lib/workspace-context";
import { formatarDuracao } from "@/lib/whatsapp";
import { formatarMoeda, formatarDataExtenso, formatarDataHora, formatarNumero } from "@/lib/formatters";
import { numeroQtd } from "@/lib/quantidades";
import { mascararCpfCnpj, primeiraMaiuscula } from "@/lib/formatters";
import { resumoContratoDoShow, rotuloContratoShow } from "@/lib/contratoDoShow";
import { linkMapa, linkTelefone, linkWhatsApp } from "@/lib/contatoLinks";

// Link de contato: sublinhado discreto e área de toque maior (o -my compensa
// o py, sem mexer no espaçamento das linhas da ficha).
const LINK_CONTATO =
  "text-primary underline decoration-border-strong underline-offset-2 transition-colors hover:text-brand py-1.5 -my-1.5";
import Vinculos from "./detalhes/Vinculos";
import ListaParcelas from "./detalhes/ListaParcelas";
import {
  LABELS_STATUS_ORCAMENTO,
  LABELS_TIPO_EVENTO,
  TEXTO_TRANSLADO,
  type ItemQuantidade,
  type LogisticaSelecao,
} from "@/types";

type Props = {
  showId: string | null;
  onClose: () => void;
  onAbrirOrcamento?: (id: string) => void;
  /** Abre a venda ligada no form de edição (D3 — ao lado do cancelar). */
  onEditarVenda?: (id: string) => void;
};

export default function ShowDetalheModal({
  showId,
  onClose,
  onAbrirOrcamento,
  onEditarVenda,
}: Props) {
  const t = useT();
  const { confirmar, confirmador } = useConfirmar();
  const { avisar, avisador } = useAviso();
  const { shows, updateShow } = useShows();
  const { contratantes, casas, cidades } = useContatos();
  const { orcamentos } = useOrcamentos();
  const { vendas, recarregar: recarregarVendas } = useVendas();
  const { contratos, assinantesPorContrato } = useContratos();
  const artistas = useArtistas();
  const { podeUI, sessao } = useAuth();
  const { notas } = useAnotacoes();
  const [processando, setProcessando] = useState(false);
  const [mostrarFormCancel, setMostrarFormCancel] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState("");
  const [notasAbertas, setNotasAbertas] = useState(false);

  // Reseta o formulário de cancelamento (e fecha as anotações) ao trocar de show.
  useEffect(() => {
    setMostrarFormCancel(false);
    setMotivoCancel("");
    setNotasAbertas(false);
  }, [showId]);

  const show = showId !== null ? shows.find((s) => s.id === showId) : null;
  const [ficha, setFicha] = useState<FichaShow | null>(null);
  useEffect(() => {
    let ativo = true;
    setFicha(null);
    if (!show?.id) return;
    fetch(`/api/shows/${show.id}/ficha`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (ativo && body?.ficha) setFicha(body.ficha as FichaShow);
      })
      .catch(() => {
        /* silencioso: sem ficha, cai no que a venda do contexto oferecer */
      });
    return () => {
      ativo = false;
    };
  }, [show?.id]);

  if (!show) {
    return (
      <Modal isOpen={false} onClose={onClose} title="">
        <></>
      </Modal>
    );
  }

  const artista = artistas.find((d) => d.id === show.artistaId);
  const notasDoShow = notas.filter((n) => n.showId === show.id);
  const cancelado = show.status === "cancelado";
  // Grey-out (UX; servidor é a autoridade). REGRA NOVA (L5b): mexer no SHOW é
  // permissão de VENDAS, não de agenda — a agenda virou só visualização.
  // Cancelar/reativar → vendas.cancelar_proprios|cancelar_outros; editar
  // (booking) → vendas.editar_proprios|editar_outros. Quem tinha só
  // agenda.editar_todos PERDE estes botões. Ver src/lib/permissoes/gatesShow.ts.
  // O DONO do show entra no cálculo: o eixo de autoria (próprios × outros)
  // segue `show.criadoPor`, e o servidor (podePorAutoria) nega o de outra pessoa.
  const donoDoShow = { criadoPor: show.criadoPor, meuUserId: sessao?.usuario.id };
  const podeCancelarShow = podeCancelarShowUI(podeUI, show.artistaId || null, donoDoShow);
  const podeEditarShow = podeEditarShowUI(podeUI, show.artistaId || null, donoDoShow);

  async function confirmarCancelamento() {
    const m = motivoCancel.trim();
    if (!m || processando || !show) return;
    setProcessando(true);
    try {
      await updateShow(show.id, { status: "cancelado", cancelamentoMotivo: m });
      // O servidor baixou o cachê pendente da venda junto (cascata) — o
      // Financeiro local precisa acompanhar sem F5.
      void recarregarVendas().catch(() => {});
      setMostrarFormCancel(false);
      setMotivoCancel("");
    } catch (e) {
      avisar((e as Error).message ?? t("Falha ao atualizar o show."));
    } finally {
      setProcessando(false);
    }
  }

  async function reverterCancelamento() {
    if (processando || !show) return;
    if (!(await confirmar({ titulo: t("Reverter o cancelamento e reativar o show?") }))) return;
    setProcessando(true);
    try {
      await updateShow(show.id, { status: "confirmado" });
      // Reativar o show reativa o cachê que a cascata baixou — sincroniza.
      void recarregarVendas().catch(() => {});
    } catch (e) {
      avisar((e as Error).message ?? t("Falha ao atualizar o show."));
    } finally {
      setProcessando(false);
    }
  }

  const contratante = show.contratanteId
    ? contratantes.find((c) => String(c.id) === show.contratanteId)
    : null;
  const casa = show.casaId ? casas.find((c) => String(c.id) === show.casaId) : null;
  const cidade = show.cidadeId ? cidades.find((c) => String(c.id) === show.cidadeId) : null;
  const orcamento = show.orcamentoId
    ? orcamentos.find((o) => String(o.id) === show.orcamentoId)
    : null;
  const venda = show.vendaId ? vendas.find((v) => String(v.id) === show.vendaId) : null;
  // Mesmo gate do VendaDetalhe.tsx:62-65 — permissão de VENDAS (não agenda.*).
  const podeEditarVendaLigada = venda
    ? podeEditarVendaUI(podeUI, venda.artistaId || null, venda.criadoPor, sessao?.usuario.id)
    : false;

  // A barra de ações só existe se houver ALGUMA ação. Sem isto, quem só
  // visualiza via um `mb-5` vazio no lugar dos botões escondidos.
  const mostrarBarraAcoes =
    podeCancelarShow || Boolean(onEditarVenda && venda && podeEditarVendaLigada);

  // Status contratual do show (Fase 3) — derivado da venda vinculada.
  const resumoContrato = resumoContratoDoShow(show.vendaId, contratos, assinantesPorContrato);
  const rotuloContrato = rotuloContratoShow(resumoContrato, t);

  // -------- Dados consolidados (venda > orçamento > casa > show) --------
  const nomeEvento = venda?.nomeEvento;
  const instagram = venda?.eventoInstagram;
  const nomeLocal = venda?.nomeLocal || show.venue || casa?.nome || "";
  const enderecoLocal = venda?.enderecoLocal || casa?.endereco || "";
  const capacidade = venda?.capacidadePublico ?? casa?.capacidade;
  const cidadeNome = cidade ? `${cidade.nome}, ${cidade.estado}` : show.location || "";
  const regiao = cidade?.regiao;

  const horarioInicio = venda?.horario || show.time || "";
  const horarioFim = venda?.horarioFim;

  // Duração: venda primeiro, senão orçamento
  let duracao: string | undefined;
  if (venda) {
    duracao = formatarDuracao(venda.duracaoHoras, venda.duracaoMinutos ?? 0);
  } else if (orcamento) {
    duracao = formatarDuracao(orcamento.duracaoHoras, orcamento.duracaoMinutos ?? 0);
  }

  const cache = ficha?.pagamento?.cache ?? venda?.cache ?? orcamento?.valorCache ?? show.valor;
  const moedaShow = ficha?.pagamento?.moeda ?? venda?.moeda ?? orcamento?.moeda ?? "BRL";
  // Parcelas do bloco Pagamento: a VENDA do contexto (admin/vendedor) manda;
  // pra quem só tem agenda (venda=undefined, /api/vendas dá 403) caímos na
  // ficha — que o servidor já redigiu por setor/financeiro. Sem isto, o setor
  // `pagamento` mostrava só o cachê e nunca as parcelas.
  const parcelasPag = venda?.parcelas ?? ficha?.pagamento?.parcelas ?? [];
  const fmtM = (val: number) => formatarMoeda(val, moedaShow);
  const tipoEvento = venda
    ? undefined
    : orcamento
    ? orcamento.tipoEvento
    : undefined;

  // FICHA SERVIDA PELO SERVIDOR, redigida setor a setor.
  //
  // A ficha era montada AQUI, juntando a venda do contexto (`vendas.find`). Só
  // que /api/vendas responde 403 pra quem não tem chave de VENDAS: quem tinha
  // "Acesso total" na AGENDA recebia lista vazia e via Contratante, Pagamento,
  // Camarim, Efeitos, Logística e Documentos em branco — não por permissão de
  // agenda, mas porque o dado nunca chegava. A ficha resolve isso e ainda tira
  // do cliente a decisão do que esconder (redigir na pintura é teatro: o valor
  // viaja no JSON).
  //
  // A venda do contexto continua sendo usada quando existe (admin/vendedor):
  // as AÇÕES (editar venda, salvar booking) precisam do objeto inteiro.


  /** Este setor é visível pra este usuário? Enquanto a ficha não chega, o
   *  espelho do cliente decide — nunca mostra mais que o servidor mandaria. */
  const verSetor = (setor: SetorAgenda): boolean =>
    ficha
      ? ficha.setoresVisiveis.includes(setor)
      : podeUI(show.artistaId || null, chaveDoSetor(setor));

  // Contratante — ficha (servidor) > snapshot da venda > registro de contatos
  const contNome = ficha?.contratante?.nome || venda?.contratanteNome || contratante?.nome || "";
  const contEmail = ficha?.contratante?.email || venda?.contratanteEmail || contratante?.email || "";
  const contTelefone = ficha?.contratante?.telefone || venda?.contratanteTelefone || contratante?.telefone || "";
  const contDocumento = ficha?.contratante?.documento || venda?.contratanteDocumento || contratante?.documento || "";
  const contEndereco = ficha?.contratante?.endereco || venda?.contratanteEndereco || "";

  // Itens — ficha > venda > orçamento. A ficha já vem filtrada (qtd > 0).
  const camarim = ficha?.camarim ?? (venda?.camarim || orcamento?.camarim || []).filter((i) => i.qtd > 0);
  const efeitos = ficha?.efeitos ?? (venda?.efeitos || orcamento?.efeitos || []).filter((i) => i.qtd > 0);
  const hotelItens = ficha?.hotel?.itens ?? (venda?.hotel || orcamento?.hotel || []).filter((i) => i.qtd > 0);
  const tecnico = ficha?.tecnico ?? (venda?.tecnico || orcamento?.tecnico || []).filter((i) => i.qtd > 0);
  const logistica: LogisticaSelecao | undefined =
    ficha?.logistica ?? venda?.logistica ?? orcamento?.logistica;

  const observacoes = ficha?.observacoes ?? (venda?.observacoes || orcamento?.observacoes);
  const lineUp = ficha?.lineup ?? venda?.lineUp;

  // Data legível — usa a data real do show (ISO completo) antes de recorrer
  // ao dia-do-mês, senão um show de dezembro aberto em julho mostrava "julho".
  const dataISO = venda?.dataShow || orcamento?.dataShow || show.data;
  let dataLegivel = "";
  if (dataISO) {
    dataLegivel = formatarDataExtenso(dataISO, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } else if (show.dayId) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), show.dayId);
    dataLegivel = formatarDataExtenso(d, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  const tituloDoEvento = nomeEvento || nomeLocal || cidadeNome || "Show";
  const temAlgumDado =
    contratante || venda || orcamento || nomeLocal || casa || cache !== undefined;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title=""
      ariaLabel={[artista?.name, tituloDoEvento].filter(Boolean).join(" · ")}
      maxWidth={580}
    >
      {/* Cabeçalho com a cor do DJ */}
      <div
        className="-mx-5 -mt-5 mb-5 px-5 pt-5 pb-4 border-b border-border"
        style={{
          background: artista
            ? `linear-gradient(135deg, color-mix(in srgb, ${artista.color} 15%, transparent) 0%, transparent 75%)`
            : "transparent",
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar nome={artista?.name} cor={artista?.color} size="lg" anel />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-primary truncate">
              {artista?.name ?? t("Sem artista")}
            </div>
            <div className="text-xs text-secondary">
              {dataLegivel ? primeiraMaiuscula(dataLegivel) : t("Data não definida")}
            </div>
          </div>
        </div>

        {nomeEvento && (
          <div className="mt-3 text-sm font-semibold text-primary">{tituloDoEvento}</div>
        )}

        {/* Badges de origem/tipo */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {venda && (
            <span className="badge badge-success">
              <CalendarCheck2 size={11} />
              {t("Venda concretizada")}
            </span>
          )}
          {!venda && orcamento && (
            <span className={`badge ${LABELS_STATUS_ORCAMENTO[orcamento.status].badge}`}>
              <FileText size={11} />
              {t("Orçamento")} {t(LABELS_STATUS_ORCAMENTO[orcamento.status].label)}
            </span>
          )}
          {tipoEvento && (
            <span className="badge badge-neutral">{t(LABELS_TIPO_EVENTO[tipoEvento])}</span>
          )}
          {!cancelado && !horarioInicio && (
            <span className="badge badge-warning inline-flex items-center gap-1">
              <Clock size={11} />
              {t("Horário a definir")}
            </span>
          )}
          {show.vendaId && (
            <span className={`badge ${rotuloContrato.badgeClass} inline-flex items-center gap-1`}>
              <FileSignature size={11} />
              {rotuloContrato.texto}
            </span>
          )}
        </div>
      </div>

      {/* Cancelamento — o evento PERMANECE na agenda; só muda a aparência
          (vermelho/riscado) e a cor no Google. O servidor carimba quem/quando;
          o motivo é obrigatório. Reverter empilha no histórico (nada se perde). */}
      {cancelado ? (
        <div
          className="mb-5 rounded-md border p-3"
          style={{ borderColor: "var(--danger)", background: "var(--danger-weak)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="badge badge-danger inline-flex items-center gap-1">
              <AlertTriangle size={11} /> {t("Show cancelado")}
            </span>
            {/* Mesma regra do cancelar: quem só visualiza não vê a ação. */}
            {podeCancelarShow && (
              <button
                type="button"
                onClick={reverterCancelamento}
                disabled={processando}
                className="btn btn-secondary px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw size={13} />
                {processando ? t("Salvando…") : t("Reverter cancelamento")}
              </button>
            )}
          </div>
          {show.cancelamento && (
            <div className="mt-2.5 flex flex-col gap-1 text-xs">
              <div className="text-secondary">
                {t("Cancelado por")}{" "}
                <span className="font-semibold text-primary">
                  {show.cancelamento.porNome}
                </span>
                {show.cancelamento.em && (
                  <span className="text-muted"> · {formatarDataHora(show.cancelamento.em)}</span>
                )}
              </div>
              <div className="text-secondary">
                <span className="text-muted">{t("Motivo:")}</span> {show.cancelamento.motivo}
              </div>
            </div>
          )}
        </div>
      ) : mostrarFormCancel ? (
        <div className="mb-5 rounded-md border border-border bg-elevated p-3">
          <label className="stat-label block mb-1.5">
            {t("Motivo do cancelamento")} *
          </label>
          <textarea aria-label={t("Motivo do cancelamento")}
            value={motivoCancel}
            onChange={(e) => setMotivoCancel(e.target.value)}
            rows={2}
            maxLength={300}
            autoFocus
            placeholder={t("Ex.: contratante desistiu, conflito de agenda…")}
            className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary resize-none outline-none foco-campo"
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-[0.6875rem] text-muted">
              {t("O evento não é apagado — fica vermelho na agenda e no Google.")}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMostrarFormCancel(false);
                  setMotivoCancel("");
                }}
                disabled={processando}
                className="btn btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {t("Voltar")}
              </button>
              <button
                type="button"
                onClick={confirmarCancelamento}
                disabled={processando || !motivoCancel.trim()}
                className="btn btn-danger px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processando ? t("Salvando…") : t("Confirmar cancelamento")}
              </button>
            </div>
          </div>
        </div>
      ) : mostrarBarraAcoes ? (
        // As duas ações como botões IGUAIS (mesma altura, lado a lado, dividindo
        // a largura) — antes era um link azul solto ao lado de um botão.
        <div className="flex items-center gap-2 mb-5">
          {/* D3 — editar a venda ligada fica ao lado do cancelar. Gate de
              VENDAS (o mesmo do VendaDetalhe), não de agenda. */}
          {onEditarVenda && venda && podeEditarVendaLigada && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditarVenda(venda.id);
              }}
              className="btn btn-secondary flex-1 px-3 py-2 text-xs"
            >
              <Pencil size={13} />
              {t("Editar venda")}
            </button>
          )}
          {/* Quem só VISUALIZA não vê o botão — nem apagado. Cancelar show é
              função de VENDAS; oferecer e negar no clique ensina que a pessoa
              tem um poder que ela não tem. */}
          {podeCancelarShow && (
            <button
              type="button"
              onClick={() => setMostrarFormCancel(true)}
              className="btn btn-danger-outline flex-1 px-3 py-2 text-xs"
            >
              <Ban size={13} />
              {t("Cancelar show")}
            </button>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        {/* ===== CONTRATANTE ===== */}
        {verSetor("contratante") && (contNome || contTelefone) && (
          <Bloco icon={<User size={14} />} title={t("Contratante")}>
            {contNome && (
              <Linha icon={<User size={13} />} bold>
                {contNome}
              </Linha>
            )}
            {contTelefone && (
              <Linha icon={<Phone size={13} />}>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <a href={linkTelefone(contTelefone)} className={LINK_CONTATO}>
                    +{contTelefone.replace(/\D/g, "")}
                  </a>
                  <a
                    href={linkWhatsApp(contTelefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${LINK_CONTATO} inline-flex items-center gap-1`}
                  >
                    <MessageCircle size={12} />
                    WhatsApp
                  </a>
                </span>
              </Linha>
            )}
            {contEmail && (
              <Linha icon={<Mail size={13} />}>
                <a href={`mailto:${contEmail}`} className={`${LINK_CONTATO} break-all`}>
                  {contEmail}
                </a>
              </Linha>
            )}
            {contDocumento && (
              <Linha icon={<Hash size={13} />}>{mascararCpfCnpj(contDocumento)}</Linha>
            )}
            {contEndereco && (
              <Linha icon={<MapPin size={13} />}>
                <a href={linkMapa(contEndereco)} target="_blank" rel="noopener noreferrer" className={LINK_CONTATO}>
                  {contEndereco}
                </a>
              </Linha>
            )}
          </Bloco>
        )}

        {/* ===== LOCAL / EVENTO ===== */}
        {verSetor("local") && (nomeLocal || cidadeNome || enderecoLocal) && (
          <Bloco icon={<Building2 size={14} />} title={t("Local do evento")}>
            {nomeLocal && (
              <Linha icon={<Building2 size={13} />} bold>
                {nomeLocal}
              </Linha>
            )}
            {instagram && (
              <Linha icon={<Instagram size={13} />}>{instagram}</Linha>
            )}
            {enderecoLocal && (
              <Linha icon={<MapPin size={13} />}>
                <a
                  href={linkMapa(enderecoLocal, cidadeNome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CONTATO}
                >
                  {enderecoLocal}
                </a>
              </Linha>
            )}
            {cidadeNome && (
              <Linha icon={<MapPin size={13} />} subtle={!!enderecoLocal}>
                {cidadeNome}
                {regiao && <span className="text-muted"> · {regiao}</span>}
              </Linha>
            )}
            {capacidade !== undefined && (
              <Linha icon={<Users size={13} />}>
                {t("Capacidade:")} {formatarNumero(capacidade)} {t("pessoas")}
              </Linha>
            )}
          </Bloco>
        )}

        {/* ===== SHOW: horário e duração. O CACHÊ mudou pra Pagamento —
            é lá que valor mora, e isso libera 'Detalhes do show' inteiro
            pro nível Básico sem vazar dinheiro. ===== */}
        {verSetor("detalhes") && (
        <Bloco icon={<Music size={14} />} title={t("Detalhes do show")}>
          {horarioInicio ? (
            <Linha icon={<Clock size={13} />} bold>
              {horarioFim ? `${horarioInicio} — ${horarioFim}` : horarioInicio}
              {duracao && (
                <span className="ml-2 text-xs text-muted font-normal">({duracao})</span>
              )}
            </Linha>
          ) : (
            <Linha icon={<Clock size={13} />}>
              <span className="text-warning font-medium">{t("A definir")}</span>
              {duracao && (
                <span className="ml-2 text-xs text-muted font-normal">
                  · {t("Duração:")} {duracao}
                </span>
              )}
            </Linha>
          )}
        </Bloco>
        )}

        {/* ===== LINE-UP ===== */}
        {verSetor("lineup") && lineUp && lineUp.length > 0 && (
          <Bloco icon={<Music size={14} />} title={t("Line-Up (outros artistas)")}>
            <div className="flex flex-wrap gap-1.5">
              {lineUp.map((nome, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center bg-elevated border border-border rounded-md px-2.5 py-1 text-sm text-primary"
                >
                  {nome}
                </span>
              ))}
            </div>
          </Bloco>
        )}

        {/* ===== CAMARIM ===== */}
        {verSetor("camarim") && camarim.length > 0 && (
          <Bloco icon={<GlassWater size={14} />} title={t("Rider de Camarim")}>
            <ItensGrid items={camarim} />
          </Bloco>
        )}

        {/* ===== EFEITOS ===== */}
        {verSetor("efeitos") && efeitos.length > 0 && (
          <Bloco icon={<Sparkles size={14} />} title={t("Rider de Efeitos")}>
            <ItensGrid items={efeitos} />
          </Bloco>
        )}

        {/* ===== RIDER TÉCNICO (migração 93) — vinha do cadastro do artista e
            morria ali: nao era lido no orcamento nem tinha onde ser guardado. ===== */}
        {verSetor("tecnico") && tecnico.length > 0 && (
          <Bloco icon={<Music size={14} />} title={t("Rider Técnico")}>
            <ItensGrid items={tecnico} />
          </Bloco>
        )}

        {/* ===== HOTEL — rider (chips) + hospedagem/booking, bloco único.
            Só aparece se o rider pede hotel OU já existe booking; a EDIÇÃO
            é gated por podeEditarShow — chave de VENDAS (visão básica não chega aqui:
            venda/orçamento/booking vêm redigidos → hotelItens=[] e sem booking). ===== */}
        {verSetor("hotel") && (hotelItens.length > 0 || show.booking) && (
          <Bloco icon={<Hotel size={14} />} title={t("Hotel")}>
            {hotelItens.length > 0 && <ItensGrid items={hotelItens} />}
            <div className={hotelItens.length > 0 ? "mt-2" : undefined}>
              <BookingSection
                showId={show.id}
                booking={show.booking}
                podeEditar={podeEditarShow}
                onSave={async (booking) => {
                  await updateShow(show.id, { booking });
                }}
              />
            </div>
          </Bloco>
        )}

        {/* ===== LOGÍSTICA ===== */}
        {verSetor("logistica") && logistica && (
          <Bloco icon={<Plane size={14} />} title={t("Logística")}>
            {logistica.aereaQtd === 0 && !logistica.transladoTerrestre && (
              <Linha icon={<Plane size={13} />} subtle>
                {t("Já inclusa no cachê")}
              </Linha>
            )}
            {logistica.aereaQtd > 0 && (
              <Linha icon={<Plane size={13} />}>
                {t("{n} Logística Aérea (Ida e Volta)", {
                  n: numeroQtd(logistica.aereaQtd),
                })}
              </Linha>
            )}
            {logistica.transladoTerrestre && (
              <Linha icon={<Car size={13} />}>{t(TEXTO_TRANSLADO)}</Linha>
            )}
          </Bloco>
        )}


        {/* ===== PAGAMENTO — o CACHÊ mora aqui (veio de "Detalhes do show").
            O bloco aparece com cachê OU com parcelas: um show sem parcelas
            lançadas ainda tem valor combinado, e escondê-lo era perder o
            número mais consultado da ficha. ===== */}
        {((cache !== undefined && cache > 0) ||
          parcelasPag.length > 0) && (
          <Bloco icon={<CreditCard size={14} />} title={t("Pagamento")}>
            {cache !== undefined && cache > 0 && (
              <Linha icon={<DollarSign size={13} />} bold>
                <span className="tabular-nums">{fmtM(cache)}</span>
                <span className="text-xs text-muted font-normal"> {t("de cachê")}</span>
              </Linha>
            )}
            {/* Parcelas: clicáveis quando o show tem venda (abre o modal da
                parcela); ficha legada sem venda fica só leitura. */}
            <ListaParcelas
              parcelas={parcelasPag}
              moeda={venda?.moeda ?? "BRL"}
              clicavel={!!venda}
            />
          </Bloco>
        )}

        {/* ===== OBSERVAÇÕES ===== */}
        {verSetor("observacoes") && observacoes && (
          <Bloco icon={<StickyNote size={14} />} title={t("Observações internas")}>
            <p className="text-sm text-secondary whitespace-pre-wrap">{observacoes}</p>
          </Bloco>
        )}

        {/* ===== ANOTAÇÕES DO SHOW — linha-resumo (estética dos Documentos
            vinculados); a escrita/thread abre num modal próprio. ===== */}
        {verSetor("anotacoes") && (
        <Bloco icon={<StickyNote size={14} />} title={t("Anotações")}>
          <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-elevated border border-border">
            <div className="flex items-center gap-2 min-w-0">
              {notasDoShow.length === 0 ? (
                <span className="text-sm text-muted">{t("Sem nenhuma anotação")}</span>
              ) : (
                <>
                  <span className="badge badge-neutral inline-flex items-center gap-1">
                    <StickyNote size={11} />
                    {notasDoShow.length === 1 ? t("Anotação") : t("Anotações")}
                  </span>
                  <span
                    className="font-mono text-sm font-bold tabular-nums"
                    style={{ color: "var(--brand)" }}
                  >
                    {notasDoShow.length}/4
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNotasAbertas(true)}
              className="btn-ghost text-xs inline-flex items-center gap-1 flex-shrink-0"
            >
              {notasDoShow.length === 0 ? t("Fazer anotação") : t("Ver anotações")}
              <ExternalLink size={11} />
            </button>
          </div>
        </Bloco>
        )}

        {/* Modal — thread de anotações do show (campo de texto vive aqui) */}
        <Modal
          isOpen={notasAbertas}
          onClose={() => setNotasAbertas(false)}
          title={t("Anotações")}
          subtitle={show.venue || show.location || undefined}
          maxWidth={560}
        >
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <NotasDoShow showId={show.id} />
          </div>
        </Modal>

        {/* ===== LIGAÇÕES — venda, contrato (abre ou "Fazer contrato"),
            orçamento de origem e contratante: o mesmo bloco da venda. Show sem
            venda (orçamento marcado aceito) mostra só o orçamento. ===== */}
        {verSetor("documentos") && venda && (
          <Bloco icon={<Hash size={14} />} title={t("Ligado a este show")}>
            <Vinculos vendaId={venda.id} ocultar={["show"]} embutido />
          </Bloco>
        )}
        {verSetor("documentos") && !venda && orcamento && (
          <Bloco icon={<Hash size={14} />} title={t("Ligado a este show")}>
            <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-elevated border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="badge badge-neutral">
                  <FileText size={11} />
                  {t("Orçamento")}
                </span>
                <span
                  className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: "var(--brand)" }}
                >
                  {orcamento.numero}
                </span>
              </div>
              {onAbrirOrcamento && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAbrirOrcamento(orcamento.id);
                  }}
                  className="btn-ghost text-xs inline-flex items-center gap-1 flex-shrink-0"
                >
                  {t("Abrir")}
                  <ExternalLink size={11} />
                </button>
              )}
            </div>
          </Bloco>
        )}

        {!temAlgumDado && (
          <div className="text-sm text-muted italic text-center py-4">
            {t("Este show ainda não tem informações detalhadas cadastradas.")}
          </div>
        )}
      </div>
      {confirmador}
      {avisador}
    </Modal>
  );
}

// ---------- Auxiliares ----------



// Bloco/Linha/ItensGrid moraram aqui até 28/08/2026 — hoje vivem em
// detalhes/FichaUI.tsx, compartilhados com OrcamentoDetalhe e VendaDetalhe.
