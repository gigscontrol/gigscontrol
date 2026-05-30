"use client";

import { useState } from "react";
import { ArrowLeft, User, MapPin, Music, Trash2, Instagram, CalendarCheck2, CreditCard, Pencil, Check, X } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import { useVendas } from "@/lib/vendas-context";
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
  const accent = MODULE_THEMES.vendas.color;
  const { vendas, removeVenda, updateVenda } = useVendas();
  const { orcamentos } = useOrcamentos();
  const artistas = useArtistas();
  const [confirmaRemover, setConfirmaRemover] = useState(false);
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
          Voltar
        </button>
        <div className="card text-center py-12">
          <div className="section-title">Venda não encontrada</div>
        </div>
      </div>
    );
  }

  const dj = artistas.find((d) => d.id === venda.djId);
  const orc = venda.orcamentoId ? orcamentos.find((o) => o.id === venda.orcamentoId) : null;
  const itensCamarim = venda.camarim.filter((i) => i.qtd > 0);
  const itensEfeitos = venda.efeitos.filter((i) => i.qtd > 0);
  const itensHotel = venda.hotel.filter((i) => i.qtd > 0);

  return (
    <div className="max-w-[1100px] mx-auto w-full p-6 lg:p-8">
      <button onClick={onBack} className="btn-ghost mb-6 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft size={14} />
        Voltar para Vendas
      </button>

      <PageHeader
        title={`Venda ${venda.numero}`}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="badge badge-success">
              <CalendarCheck2 size={11} />
              Concretizada
            </span>
            {orc && (
              <>
                <span className="text-muted">·</span>
                <span className="text-secondary">
                  Originada do orçamento{" "}
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* Coluna 1 */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <SectionTitle icon={<User size={14} />} title="Contratante" accent={accent} />
            <InfoLine label="Nome" value={venda.contratanteNome} />
            <InfoLine label="E-mail" value={venda.contratanteEmail || "—"} />
            <InfoLine
              label="Telefone"
              value={venda.contratanteTelefone ? `+${venda.contratanteTelefone}` : "—"}
            />
            <InfoLine label="CPF/CNPJ" value={mascararCpfCnpj(venda.contratanteDocumento) || "—"} />
            <InfoLine label="Endereço" value={venda.contratanteEndereco || "—"} />
          </div>

          <div className="card">
            <SectionTitle icon={<MapPin size={14} />} title="Evento" accent={accent} />
            <InfoLine label="Nome" value={venda.nomeEvento} bold />
            {venda.eventoInstagram && (
              <InfoLine
                label="Instagram"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Instagram size={11} />
                    {venda.eventoInstagram}
                  </span>
                }
              />
            )}
            <InfoLine label="Local" value={venda.nomeLocal} />
            {venda.capacidadePublico && (
              <InfoLine
                label="Capacidade"
                value={`${venda.capacidadePublico.toLocaleString("pt-BR")} pessoas`}
              />
            )}
            <InfoLine label="Endereço" value={venda.enderecoLocal} />
            <InfoLine
              label="Data"
              value={new Date(venda.dataShow + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              bold
            />
            <InfoLine
              label="Horário"
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
            <SectionTitle icon={<CreditCard size={14} />} title="Pagamento" accent={accent} />
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
                        Parcela {idx + 1}/{venda.parcelas.length}
                        <span className="text-muted text-xs ml-1.5">
                          ({p.percentual.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        Vence{" "}
                        {new Date(p.dataVencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                        {p.dataPagamento && (
                          <span className="text-success">
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
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {formatBRL(p.valor)}
                      </span>
                      <span className={`badge ${label.badge}`}>{label.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-3">
              Gerencie os pagamentos em Financeiro → Controle de Pagamentos.
            </p>
          </div>

          {venda.observacoes && (
            <div className="card">
              <div className="section-title mb-2">Observações internas</div>
              <p className="text-sm text-secondary whitespace-pre-wrap">{venda.observacoes}</p>
            </div>
          )}

          {/* Informações extras — herdadas do orçamento + editáveis */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="section-title">Informações extras</div>
              {!editandoInfoExtra && (
                <button
                  type="button"
                  onClick={() => {
                    setInfoExtraDraft(venda.infoExtra ?? "");
                    setEditandoInfoExtra(true);
                  }}
                  className="btn-ghost text-xs inline-flex items-center gap-1"
                >
                  <Pencil size={12} />
                  Editar
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
                  placeholder="Algo extra que apareceu no orçamento ou queira anotar."
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
                    Cancelar
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
                        setToastMsg({ msg: "Informações extras atualizadas.", tipo: "sucesso" });
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
                    {salvandoInfoExtra ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            ) : venda.infoExtra ? (
              <p className="text-sm text-secondary whitespace-pre-wrap">{venda.infoExtra}</p>
            ) : (
              <p className="text-sm text-muted italic">
                Nenhuma informação extra. Clique em &quot;Editar&quot; pra adicionar.
              </p>
            )}
          </div>
        </div>

        {/* Coluna 2 */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <SectionTitle icon={<Music size={14} />} title="Show" accent={accent} />
            <InfoLine label="Artista da agência" value={dj?.name ?? "—"} bold />
            <InfoLine
              label="Cachê"
              value={
                <span className="font-bold text-base tabular-nums" style={{ color: accent }}>
                  {formatBRL(venda.cache)}
                </span>
              }
            />
            <InfoLine
              label="Duração"
              value={formatarDuracao(venda.duracaoHoras, venda.duracaoMinutos ?? 0)}
            />
            {venda.lineUp && venda.lineUp.length > 0 && (
              <InfoLine
                label="Line-Up"
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
            <div className="section-title mb-3">Adicionais</div>
            <ItemsList title="Camarim / Consumação" items={itensCamarim} />
            <ItemsList title="Efeitos" items={itensEfeitos} />
            <ItemsList title="Hotel" items={itensHotel} />
            <div className="mt-3">
              <div className="stat-label mb-1">Logística</div>
              <div className="text-sm text-primary space-y-1">
                {venda.logistica.aereaQtd === 0 && !venda.logistica.transladoTerrestre && (
                  <div>Já inclusa do cachê</div>
                )}
                {venda.logistica.aereaQtd > 0 && (
                  <div>{venda.logistica.aereaQtd}× Logística Aérea (Ida e Volta)</div>
                )}
                {venda.logistica.transladoTerrestre && (
                  <div className="text-secondary">{TEXTO_TRANSLADO}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={() => setConfirmaRemover(true)}
          className="btn btn-ghost"
          style={{ color: "var(--danger)" }}
        >
          <Trash2 size={14} />
          Remover venda
        </button>
      </div>

      {/* Confirmação de remover */}
      <Modal
        isOpen={confirmaRemover}
        onClose={() => setConfirmaRemover(false)}
        title="Remover venda"
        subtitle="Esta ação não pode ser desfeita."
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            A venda <strong className="text-primary">{venda.numero}</strong> e suas parcelas serão apagadas. O <strong className="text-primary">show vinculado</strong> também será removido da agenda.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setConfirmaRemover(false)}
              className="btn btn-secondary"
              disabled={removendo}
            >
              Cancelar
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
              {removendo ? "Removendo..." : "Remover"}
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
