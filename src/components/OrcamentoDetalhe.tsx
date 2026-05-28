"use client";

import { useState } from "react";
import { ArrowLeft, MessageCircle, CheckCircle2, XCircle, Clock, Trash2, Copy, AlertCircle, CalendarCheck2 } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { gerarTextoWhatsApp, montarLinkWhatsApp, formatBRL, formatarDuracao } from "@/lib/whatsapp";
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
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos, marcarStatus, aceitarOrcamento, removeOrcamento, duplicarOrcamento } = useOrcamentos();
  const { contratantes, casas, cidades } = useContatos();
  const artistas = useArtistas();

  // Estado dos diálogos de feedback (duplicar)
  const [confirmaDuplicar, setConfirmaDuplicar] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
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
          Voltar
        </button>
        <div className="card text-center py-12">
          <div className="section-title">Orçamento não encontrado</div>
        </div>
      </div>
    );
  }

  const cont = contratantes.find((c) => c.id === orc.contratanteId);
  const cs = orc.casaId ? casas.find((c) => c.id === orc.casaId) : undefined;
  const cid = cidades.find((c) => c.id === orc.cidadeId);
  const dj = artistas.find((d) => d.id === orc.djId);
  const st = LABELS_STATUS_ORCAMENTO[orc.status];

  const texto = gerarTextoWhatsApp(orc, { contratante: cont, casa: cs, cidade: cid, dj });
  const linkWA = montarLinkWhatsApp(cont?.telefone ?? "", texto);

  const itensCamarim = orc.camarim.filter((i) => i.qtd > 0);
  const itensEfeitos = orc.efeitos.filter((i) => i.qtd > 0);
  const itensHotel = orc.hotel.filter((i) => i.qtd > 0);

  // Quais dados faltam para virar venda?
  const camposFaltantes: string[] = [];
  if (!orc.dataShow) camposFaltantes.push("Data do show");
  if (!orc.horario) camposFaltantes.push("Horário");
  if (!orc.casaId) camposFaltantes.push("Casa / Local");
  if (!cont?.email) camposFaltantes.push("E-mail do contratante");
  if (!cont?.documento) camposFaltantes.push("CPF / CNPJ do contratante");

  return (
    <div className="max-w-[1100px] mx-auto w-full p-6 lg:p-8">
      <button onClick={onBack} className="btn-ghost mb-6 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft size={14} />
        Voltar para Histórico
      </button>

      <PageHeader
        title={`Orçamento ${orc.numero}`}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className={`badge ${st.badge}`}>{st.label}</span>
            <span className="badge badge-neutral">{LABELS_TIPO_EVENTO[orc.tipoEvento]}</span>
            <span className="text-muted">·</span>
            <span>Criado em {new Date(orc.criadoEm).toLocaleDateString("pt-BR")}</span>
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
            Enviar pelo WhatsApp
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
              Dados pendentes para converter em venda
            </div>
            <div className="text-xs text-secondary">
              {camposFaltantes.join(" · ")}
            </div>
            <div className="text-xs text-muted mt-1">
              Você pode aceitar e enviar pelo WhatsApp normalmente; esses dados serão
              necessários quando o orçamento virar venda fechada.
            </div>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-2 mb-6">
        {orc.status !== "recusado" && (
          <button
            onClick={() => onTransformarEmVenda(orc.id)}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <CalendarCheck2 size={14} />
            Transformar em Venda
          </button>
        )}
        {orc.status !== "aceito" && (
          <button
            onClick={() => {
              const msg = !orc.dataShow
                ? "Aceitar este orçamento? Como não há data definida, nenhum show será criado na agenda automaticamente — adicione a data depois para isso."
                : "Aceitar este orçamento? Um show será criado automaticamente na agenda.";
              if (confirm(msg)) aceitarOrcamento(orc.id);
            }}
            className="btn btn-secondary"
            style={{ color: "var(--success)" }}
          >
            <CheckCircle2 size={14} />
            Marcar aceito
          </button>
        )}
        {orc.status !== "negociacao" && orc.status !== "aceito" && (
          <button
            onClick={() => marcarStatus(orc.id, "negociacao")}
            className="btn btn-secondary"
            style={{ color: "var(--warning)" }}
          >
            <Clock size={14} />
            Em negociação
          </button>
        )}
        {orc.status !== "recusado" && orc.status !== "aceito" && (
          <button
            onClick={() => marcarStatus(orc.id, "recusado")}
            className="btn btn-secondary"
            style={{ color: "var(--danger)" }}
          >
            <XCircle size={14} />
            Recusar
          </button>
        )}
        <button
          onClick={() => setConfirmaDuplicar(true)}
          className="btn btn-secondary"
        >
          <Copy size={14} />
          Duplicar
        </button>
        <button
          onClick={() => {
            if (confirm("Remover este orçamento permanentemente?")) {
              removeOrcamento(orc.id);
              onBack();
            }
          }}
          className="btn btn-ghost ml-auto"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 size={14} />
          Remover
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* Coluna 1: Informações */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="section-title mb-4">Dados do show</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoItem label="DJ" value={dj?.name ?? "—"} />
              <InfoItem
                label="Valor do cachê"
                value={formatBRL(orc.valorCache)}
                bold
                accent={accent}
              />
              <InfoItem
                label="Data"
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
              <InfoItem label="Horário" value={orc.horario || "—"} missing={!orc.horario} />
              <InfoItem label="Duração" value={formatarDuracao(orc.duracaoHoras, orc.duracaoMinutos ?? 0)} />
              <InfoItem
                label="Validade"
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
            <div className="section-title mb-4">Contratante</div>
            <div className="flex flex-col gap-2 text-sm">
              <InfoItem label="Nome" value={cont?.nome ?? "—"} />
              <InfoItem label="Telefone" value={cont?.telefone ?? "—"} />
              <InfoItem label="E-mail" value={cont?.email || "—"} missing={!cont?.email} />
              <InfoItem label="Documento" value={cont?.documento || "—"} missing={!cont?.documento} />
            </div>
          </div>

          <div className="card">
            <div className="section-title mb-4">Local</div>
            <div className="flex flex-col gap-2 text-sm">
              <InfoItem label="Tipo de evento" value={LABELS_TIPO_EVENTO[orc.tipoEvento]} />
              <InfoItem
                label="Casa / Evento"
                value={cs?.nome ?? "—"}
                missing={!cs}
              />
              <InfoItem label="Cidade" value={cid ? `${cid.nome} — ${cid.estado}` : "—"} />
            </div>
          </div>

          {orc.observacoes && (
            <div className="card">
              <div className="section-title mb-3">Observações internas</div>
              <p className="text-sm text-secondary whitespace-pre-wrap">{orc.observacoes}</p>
            </div>
          )}
        </div>

        {/* Coluna 2: Itens + preview */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="section-title mb-4">Adicionais</div>
            <div className="flex flex-col gap-4 text-sm">
              <ItemsBlock title="Camarim / Consumação" items={itensCamarim} />
              <ItemsBlock title="Efeitos" items={itensEfeitos} />
              <ItemsBlock title="Hotel" items={itensHotel} />
              <div>
                <div className="stat-label mb-1">Logística</div>
                <div className="text-primary text-sm space-y-1">
                  {orc.logistica.aereaQtd === 0 && !orc.logistica.transladoTerrestre && (
                    <div>Já inclusa do cachê</div>
                  )}
                  {orc.logistica.aereaQtd > 0 && (
                    <div>
                      {orc.logistica.aereaQtd}× Logística Aérea (Ida e Volta)
                    </div>
                  )}
                  {orc.logistica.transladoTerrestre && (
                    <div className="text-secondary">{TEXTO_TRANSLADO}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title mb-3">Pré-visualização do WhatsApp</div>
            <pre className="bg-elevated border border-border rounded-md p-3 text-xs text-primary whitespace-pre-wrap font-sans">
              {texto}
            </pre>
            <div className="text-xs text-muted mt-2">
              * Asteriscos viram <strong>negrito</strong> no WhatsApp.
            </div>
          </div>
        </div>
      </div>

      {/* Confirmação de duplicar */}
      <Modal
        isOpen={confirmaDuplicar}
        onClose={() => setConfirmaDuplicar(false)}
        title="Duplicar orçamento"
        subtitle={`Criar uma cópia de ${orc.numero}?`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            Vamos gerar um novo orçamento com os mesmos dados, em status{" "}
            <strong className="text-primary">Pendente</strong>. O número
            ({orc.numero}) atual continua intacto.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setConfirmaDuplicar(false)}
              className="btn btn-secondary"
              disabled={duplicando}
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                setDuplicando(true);
                try {
                  const novo = await duplicarOrcamento(orc.id);
                  setConfirmaDuplicar(false);
                  if (novo) {
                    setToast({
                      msg: `Orçamento duplicado em ${novo.numero}.`,
                      tipo: "sucesso",
                      acaoLabel: "Abrir",
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
              {duplicando ? "Duplicando..." : "Duplicar"}
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
  return (
    <div>
      <div className="stat-label mb-0.5 flex items-center gap-1">
        {label}
        {missing && (
          <span className="text-warning" title="Será necessário para conversão em venda">
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
  return (
    <div>
      <div className="stat-label mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted italic">Nenhum item selecionado</div>
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
