"use client";

import {
  Building2,
  MapPin,
  Users,
  Clock,
  DollarSign,
  User,
  Mail,
  Phone,
  FileText,
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
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Modal from "./Modal";
import { useShows } from "@/lib/shows-context";
import { useContatos } from "@/lib/contatos-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { formatBRL, formatarDuracao } from "@/lib/whatsapp";
import { mascararCpfCnpj } from "@/lib/formatters";
import {
  LABELS_STATUS_ORCAMENTO,
  LABELS_TIPO_EVENTO,
  LABELS_STATUS_PARCELA,
  TEXTO_TRANSLADO,
  statusEfetivoParcela,
  type ItemQuantidade,
  type LogisticaSelecao,
} from "@/types";

type Props = {
  showId: string | null;
  onClose: () => void;
  onAbrirOrcamento?: (id: string) => void;
  onAbrirVenda?: (id: string) => void;
};

export default function ShowDetalheModal({
  showId,
  onClose,
  onAbrirOrcamento,
  onAbrirVenda,
}: Props) {
  const { shows } = useShows();
  const { contratantes, casas, cidades } = useContatos();
  const { orcamentos } = useOrcamentos();
  const { vendas } = useVendas();
  const artistas = useArtistas();

  const show = showId !== null ? shows.find((s) => s.id === showId) : null;
  if (!show) {
    return (
      <Modal isOpen={false} onClose={onClose} title="">
        <></>
      </Modal>
    );
  }

  const dj = artistas.find((d) => d.id === show.djId);
  const contratante = show.contratanteId
    ? contratantes.find((c) => String(c.id) === show.contratanteId)
    : null;
  const casa = show.casaId ? casas.find((c) => String(c.id) === show.casaId) : null;
  const cidade = show.cidadeId ? cidades.find((c) => String(c.id) === show.cidadeId) : null;
  const orcamento = show.orcamentoId
    ? orcamentos.find((o) => String(o.id) === show.orcamentoId)
    : null;
  const venda = show.vendaId ? vendas.find((v) => String(v.id) === show.vendaId) : null;

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

  const cache = venda?.cache ?? orcamento?.valorCache ?? show.valor;
  const lineUp = venda?.lineUp;
  const tipoEvento = venda
    ? undefined
    : orcamento
    ? orcamento.tipoEvento
    : undefined;

  // Contratante — snapshot da venda (mais completo) ou registro de contatos
  const contNome = venda?.contratanteNome || contratante?.nome || "";
  const contEmail = venda?.contratanteEmail || contratante?.email || "";
  const contTelefone = venda?.contratanteTelefone || contratante?.telefone || "";
  const contDocumento = venda?.contratanteDocumento || contratante?.documento || "";
  const contEndereco = venda?.contratanteEndereco || "";

  // Itens (venda > orçamento)
  const camarim = (venda?.camarim || orcamento?.camarim || []).filter((i) => i.qtd > 0);
  const efeitos = (venda?.efeitos || orcamento?.efeitos || []).filter((i) => i.qtd > 0);
  const hotelItens = (venda?.hotel || orcamento?.hotel || []).filter((i) => i.qtd > 0);
  const logistica: LogisticaSelecao | undefined = venda?.logistica || orcamento?.logistica;

  const observacoes = venda?.observacoes || orcamento?.observacoes;

  // Data legível
  const dataISO = venda?.dataShow || orcamento?.dataShow;
  let dataLegivel = "";
  if (dataISO) {
    dataLegivel = new Date(dataISO + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } else if (show.dayId) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), show.dayId);
    dataLegivel = d.toLocaleDateString("pt-BR", {
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
    <Modal isOpen onClose={onClose} title="" maxWidth={580}>
      {/* Cabeçalho com a cor do DJ */}
      <div
        className="-mx-5 -mt-5 mb-5 px-5 pt-5 pb-4 border-b border-border"
        style={{
          background: dj
            ? `linear-gradient(135deg, ${dj.color}26 0%, transparent 75%)`
            : "transparent",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              backgroundColor: dj?.color ?? "var(--bg-elevated)",
              color: "#fff",
              boxShadow: `0 0 0 3px ${dj?.color ?? "#888"}33`,
            }}
          >
            {dj?.name.slice(0, 2).toUpperCase() ?? "—"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-primary truncate">
              {dj?.name ?? "Sem DJ"}
            </div>
            <div className="text-xs text-secondary capitalize">{dataLegivel || "Data não definida"}</div>
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
              Venda concretizada
            </span>
          )}
          {!venda && orcamento && (
            <span className={`badge ${LABELS_STATUS_ORCAMENTO[orcamento.status].badge}`}>
              <FileText size={11} />
              Orçamento {LABELS_STATUS_ORCAMENTO[orcamento.status].label}
            </span>
          )}
          {tipoEvento && (
            <span className="badge badge-neutral">{LABELS_TIPO_EVENTO[tipoEvento]}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* ===== CONTRATANTE ===== */}
        {(contNome || contTelefone) && (
          <Bloco icon={<User size={14} />} title="Contratante">
            {contNome && (
              <Linha icon={<User size={13} />} bold>
                {contNome}
              </Linha>
            )}
            {contTelefone && (
              <Linha icon={<Phone size={13} />}>
                +{contTelefone.replace(/\D/g, "")}
              </Linha>
            )}
            {contEmail && (
              <Linha icon={<Mail size={13} />}>{contEmail}</Linha>
            )}
            {contDocumento && (
              <Linha icon={<Hash size={13} />}>{mascararCpfCnpj(contDocumento)}</Linha>
            )}
            {contEndereco && (
              <Linha icon={<MapPin size={13} />}>{contEndereco}</Linha>
            )}
          </Bloco>
        )}

        {/* ===== LOCAL / EVENTO ===== */}
        {(nomeLocal || cidadeNome || enderecoLocal || nomeEvento) && (
          <Bloco icon={<Building2 size={14} />} title="Local do evento">
            {nomeEvento && (
              <Linha icon={<Sparkles size={13} />} bold>
                {nomeEvento}
              </Linha>
            )}
            {instagram && (
              <Linha icon={<Instagram size={13} />}>{instagram}</Linha>
            )}
            {nomeLocal && (
              <Linha icon={<Building2 size={13} />} bold={!nomeEvento}>
                {nomeLocal}
              </Linha>
            )}
            {enderecoLocal && (
              <Linha icon={<MapPin size={13} />}>{enderecoLocal}</Linha>
            )}
            {cidadeNome && (
              <Linha icon={<MapPin size={13} />} subtle={!!enderecoLocal}>
                {cidadeNome}
                {regiao && <span className="text-muted"> · {regiao}</span>}
              </Linha>
            )}
            {capacidade !== undefined && (
              <Linha icon={<Users size={13} />}>
                Capacidade: {capacidade.toLocaleString("pt-BR")} pessoas
              </Linha>
            )}
          </Bloco>
        )}

        {/* ===== SHOW: horário, duração, cachê ===== */}
        <Bloco icon={<Music size={14} />} title="Detalhes do show">
          {horarioInicio && (
            <Linha icon={<Clock size={13} />} bold>
              {horarioFim ? `${horarioInicio} — ${horarioFim}` : horarioInicio}
              {duracao && (
                <span className="ml-2 text-xs text-muted font-normal">({duracao})</span>
              )}
            </Linha>
          )}
          {!horarioInicio && duracao && (
            <Linha icon={<Clock size={13} />}>Duração: {duracao}</Linha>
          )}
          {cache !== undefined && cache > 0 && (
            <Linha icon={<DollarSign size={13} />} bold>
              <span className="tabular-nums">{formatBRL(cache)}</span>
              <span className="text-xs text-muted font-normal"> de cachê</span>
            </Linha>
          )}
        </Bloco>

        {/* ===== LINE-UP ===== */}
        {lineUp && lineUp.length > 0 && (
          <Bloco icon={<Music size={14} />} title="Line-Up (outros artistas)">
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
        {camarim.length > 0 && (
          <Bloco icon={<GlassWater size={14} />} title="Camarim / Consumação">
            <ItensGrid items={camarim} />
          </Bloco>
        )}

        {/* ===== EFEITOS ===== */}
        {efeitos.length > 0 && (
          <Bloco icon={<Sparkles size={14} />} title="Efeitos">
            <ItensGrid items={efeitos} />
          </Bloco>
        )}

        {/* ===== HOTEL ===== */}
        {hotelItens.length > 0 && (
          <Bloco icon={<Hotel size={14} />} title="Hotel">
            <ItensGrid items={hotelItens} />
          </Bloco>
        )}

        {/* ===== LOGÍSTICA ===== */}
        {logistica && (
          <Bloco icon={<Plane size={14} />} title="Logística">
            {logistica.aereaQtd === 0 && !logistica.transladoTerrestre && (
              <Linha icon={<Plane size={13} />} subtle>
                Já inclusa do cachê
              </Linha>
            )}
            {logistica.aereaQtd > 0 && (
              <Linha icon={<Plane size={13} />}>
                {logistica.aereaQtd}× Logística Aérea (Ida e Volta)
              </Linha>
            )}
            {logistica.transladoTerrestre && (
              <Linha icon={<Car size={13} />}>{TEXTO_TRANSLADO}</Linha>
            )}
          </Bloco>
        )}

        {/* ===== PAGAMENTO ===== */}
        {venda && venda.parcelas.length > 0 && (
          <Bloco icon={<CreditCard size={14} />} title="Pagamento">
            {(() => {
              const total = venda.parcelas.reduce((a, p) => a + p.valor, 0);
              const pago = venda.parcelas
                .filter((p) => statusEfetivoParcela(p) === "pago")
                .reduce((a, p) => a + p.valor, 0);
              const atrasado = venda.parcelas
                .filter((p) => statusEfetivoParcela(p) === "atrasado")
                .reduce((a, p) => a + p.valor, 0);
              const restante = total - pago;
              return (
                <>
                  {/* Resumo */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-sm">
                    <span className="text-secondary">
                      Recebido:{" "}
                      <span className="font-semibold" style={{ color: "var(--success)" }}>
                        {formatBRL(pago)}
                      </span>
                    </span>
                    <span className="text-secondary">
                      A receber:{" "}
                      <span className="font-semibold text-primary">
                        {formatBRL(restante)}
                      </span>
                    </span>
                    {atrasado > 0 && (
                      <span className="text-secondary">
                        Atrasado:{" "}
                        <span className="font-semibold" style={{ color: "var(--danger)" }}>
                          {formatBRL(atrasado)}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Lista de parcelas */}
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
                            Parcela {idx + 1}/{venda.parcelas.length}
                          </span>
                          <span className="text-muted text-xs ml-1.5">
                            ({p.percentual.toFixed(0)}%)
                          </span>
                          <div className="text-xs text-muted">
                            Vence{" "}
                            {new Date(
                              p.dataVencimento + "T12:00:00"
                            ).toLocaleDateString("pt-BR")}
                            {p.dataPagamento && (
                              <span style={{ color: "var(--success)" }}>
                                {" "}
                                · pago em{" "}
                                {new Date(
                                  p.dataPagamento + "T12:00:00"
                                ).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-semibold tabular-nums text-primary">
                            {formatBRL(p.valor)}
                          </span>
                          <span className={`badge ${label.badge}`}>
                            {st === "pago" && <CheckCircle2 size={10} />}
                            {st === "pendente" && <Clock size={10} />}
                            {st === "atrasado" && <AlertTriangle size={10} />}
                            {label.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </Bloco>
        )}

        {/* ===== OBSERVAÇÕES ===== */}
        {observacoes && (
          <Bloco icon={<StickyNote size={14} />} title="Observações internas">
            <p className="text-sm text-secondary whitespace-pre-wrap">{observacoes}</p>
          </Bloco>
        )}

        {/* ===== ORIGEM (links) ===== */}
        {(orcamento || venda) && (
          <Bloco icon={<Hash size={14} />} title="Documentos vinculados">
            {venda && (
              <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-elevated border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="badge badge-success">
                    <CalendarCheck2 size={11} />
                    Venda
                  </span>
                  <span
                    className="font-mono text-sm font-bold tabular-nums"
                    style={{ color: "var(--module-vendas)" }}
                  >
                    {venda.numero}
                  </span>
                </div>
                {onAbrirVenda && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAbrirVenda(venda.id);
                    }}
                    className="btn-ghost text-xs inline-flex items-center gap-1 flex-shrink-0"
                  >
                    Abrir
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>
            )}
            {orcamento && (
              <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-elevated border border-border mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="badge badge-neutral">
                    <FileText size={11} />
                    Orçamento
                  </span>
                  <span
                    className="font-mono text-sm font-bold tabular-nums"
                    style={{ color: "var(--module-vendas)" }}
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
                    Abrir
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>
            )}
          </Bloco>
        )}

        {!temAlgumDado && (
          <div className="text-sm text-muted italic text-center py-4">
            Este show ainda não tem informações detalhadas cadastradas.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------- Auxiliares ----------

function Bloco({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
        <span style={{ color: "var(--module-vendas)" }}>{icon}</span>
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

function ItensGrid({ items }: { items: ItemQuantidade[] }) {
  return (
    <div className="flex flex-col">
      {items.map((i) => (
        <div
          key={i.nome}
          className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-border/50 last:border-0"
        >
          <span className="text-secondary truncate">{i.nome}</span>
          <span className="font-semibold tabular-nums text-primary flex-shrink-0">
            {i.qtd}×
          </span>
        </div>
      ))}
    </div>
  );
}
