"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  Plus,
  Search,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Trash2,
  Eye,
  FileText,
  CalendarCheck2,
  Users,
  ChevronDown,
  Check,
} from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import MiniLixeira from "./MiniLixeira";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { gerarTextoWhatsApp, montarLinkWhatsApp, formatBRL } from "@/lib/whatsapp";
import { LABELS_STATUS_ORCAMENTO, LABELS_TIPO_EVENTO, MODULE_THEMES, type OrcamentoStatus } from "@/types";

type Props = {
  onNovo: () => void;
  onAbrir: (id: string) => void;
  onTransformarEmVenda: (orcamentoId: string) => void;
};

const STATUS_FILTROS: { value: OrcamentoStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "negociacao", label: "Em negociação" },
  { value: "aceito", label: "Aceitos" },
  { value: "recusado", label: "Recusados" },
];

export default function HistoricoOrcamentos({ onNovo, onAbrir, onTransformarEmVenda }: Props) {
  const t = useT();
  const { podeUI } = useAuth();
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos, marcarStatus, aceitarOrcamento, removeOrcamento, duplicarOrcamento } = useOrcamentos();
  const { contratantes, cidades, casas } = useContatos();
  const artistas = useArtistas();

  // Botão "Novo orçamento" não tem artista fixo (escolhido no wizard) →
  // habilita se o usuário puder criar orçamento em ALGUM artista.
  const podeCriarOrcamento = artistas.some((a) => podeUI(a.id, "vendas.criar_orcamento"));

  const [filtroStatus, setFiltroStatus] = useState<OrcamentoStatus | "todos">("todos");
  const [filtroDJ, setFiltroDJ] = useState<string | "todos">("todos");
  const [search, setSearch] = useState("");
  const [modalArtista, setModalArtista] = useState(false);

  const artistaSelecionado = artistas.find((d) => d.id === filtroDJ);

  const lista = useMemo(() => {
    return [...orcamentos]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .filter((o) => {
        if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
        if (filtroDJ !== "todos" && o.artistaId !== filtroDJ) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const cont = contratantes.find((c) => c.id === o.contratanteId);
          const cid = cidades.find((c) => c.id === o.cidadeId);
          const cs = casas.find((c) => c.id === o.casaId);
          const haystack = [
            o.numero,
            cont?.nome ?? "",
            cont?.telefone ?? "",
            cid?.nome ?? "",
            cs?.nome ?? "",
            artistas.find((d) => d.id === o.artistaId)?.name ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [orcamentos, filtroStatus, filtroDJ, search, contratantes, cidades, casas, artistas]);

  const totalPorStatus = useMemo(() => {
    const acc: Record<OrcamentoStatus, number> = {
      pendente: 0,
      negociacao: 0,
      aceito: 0,
      recusado: 0,
    };
    orcamentos.forEach((o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
    });
    return acc;
  }, [orcamentos]);

  function handleEnviarWA(id: string) {
    const orc = orcamentos.find((o) => o.id === id);
    if (!orc) return;
    const cont = contratantes.find((c) => c.id === orc.contratanteId);
    const cid = cidades.find((c) => c.id === orc.cidadeId);
    const artista = artistas.find((d) => d.id === orc.artistaId);
    const texto = gerarTextoWhatsApp(orc, { contratante: cont, cidade: cid, artista });
    const link = montarLinkWhatsApp(cont?.telefone ?? "", texto);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function handleAceitar(id: string) {
    const orc = orcamentos.find((o) => o.id === id);
    if (!orc) return;
    const msg = !orc.dataShow
      ? t("Aceitar este orçamento? Como não há data definida, nenhum show será criado na agenda automaticamente — adicione a data depois para isso.")
      : t("Aceitar este orçamento? Um show será criado automaticamente na agenda.");
    if (confirm(msg)) aceitarOrcamento(id);
  }

  function handleRemover(id: string) {
    if (confirm(t("Remover este orçamento? Esta ação não pode ser desfeita."))) {
      removeOrcamento(id);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Histórico de Orçamentos"
        subtitle={`${orcamentos.length} ${orcamentos.length === 1 ? t("orçamento no total") : t("orçamentos no total")}`}
        accentColor={accent}
        actions={
          <button
            onClick={onNovo}
            disabled={!podeCriarOrcamento}
            title={!podeCriarOrcamento ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Plus size={14} />
            {t("Novo orçamento")}
          </button>
        }
      />

      {/* Cards de status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatusCard
          label={t("Pendentes")}
          value={totalPorStatus.pendente}
          color="var(--text-secondary)"
          icon={<Clock size={14} />}
          active={filtroStatus === "pendente"}
          onClick={() =>
            setFiltroStatus((s) => (s === "pendente" ? "todos" : "pendente"))
          }
        />
        <StatusCard
          label={t("Em negociação")}
          value={totalPorStatus.negociacao}
          color="var(--warning)"
          icon={<MessageCircle size={14} />}
          active={filtroStatus === "negociacao"}
          onClick={() =>
            setFiltroStatus((s) => (s === "negociacao" ? "todos" : "negociacao"))
          }
        />
        <StatusCard
          label={t("Aceitos")}
          value={totalPorStatus.aceito}
          color="var(--success)"
          icon={<CheckCircle2 size={14} />}
          active={filtroStatus === "aceito"}
          onClick={() => setFiltroStatus((s) => (s === "aceito" ? "todos" : "aceito"))}
        />
        <StatusCard
          label={t("Recusados")}
          value={totalPorStatus.recusado}
          color="var(--danger)"
          icon={<XCircle size={14} />}
          active={filtroStatus === "recusado"}
          onClick={() =>
            setFiltroStatus((s) => (s === "recusado" ? "todos" : "recusado"))
          }
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 flex-1 min-w-[240px] max-w-md focus-within:border-border-strong transition-colors">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar por número, contratante, cidade...")}
            className="input"
          />
        </div>

        <div className="pill-group flex-wrap">
          {STATUS_FILTROS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`pill ${filtroStatus === s.value ? "active" : ""}`}
              onClick={() => setFiltroStatus(s.value)}
            >
              {t(s.label)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setModalArtista(true)}
          className="btn btn-secondary"
        >
          <Users size={14} />
          {filtroDJ === "todos" ? t("Todos artistas") : (artistaSelecionado?.name ?? t("Todos artistas"))}
          <ChevronDown size={14} />
        </button>
      </div>

      <Modal
        isOpen={modalArtista}
        onClose={() => setModalArtista(false)}
        title={t("Filtrar por artista")}
        maxWidth={440}
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setFiltroDJ("todos");
              setModalArtista(false);
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
          >
            <span className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 bg-surface border border-border text-muted">
              <Users size={16} />
            </span>
            <span className="flex-1 text-sm font-semibold text-primary">
              {t("Todos artistas")}
            </span>
            {filtroDJ === "todos" && (
              <Check size={16} style={{ color: "var(--brand)" }} />
            )}
          </button>
          {artistas.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setFiltroDJ(d.id);
                setModalArtista(false);
              }}
              className="flex items-center gap-3 px-3 py-3 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
            >
              <span
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: d.color,
                  color: "#fff",
                  boxShadow: `0 0 0 2px color-mix(in srgb, ${d.color} 20%, transparent)`,
                }}
              >
                {d.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 text-sm font-semibold text-primary">
                {d.name}
              </span>
              {filtroDJ === d.id && (
                <Check size={16} style={{ color: "var(--brand)" }} />
              )}
            </button>
          ))}
        </div>
      </Modal>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
              <FileText size={18} className="text-muted" />
            </div>
            <div className="section-title mb-1">
              {orcamentos.length === 0 ? t("Nenhum orçamento criado ainda") : t("Nenhum resultado")}
            </div>
            <div className="section-subtitle mb-4">
              {orcamentos.length === 0
                ? t("Crie seu primeiro orçamento e envie pelo WhatsApp")
                : t("Ajuste os filtros ou a busca")}
            </div>
            {orcamentos.length === 0 && (
              <button
                onClick={onNovo}
                disabled={!podeCriarOrcamento}
                title={!podeCriarOrcamento ? t("Você não tem permissão para isso.") : undefined}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: accent, color: "#fff" }}
              >
                <Plus size={14} />
                {t("Novo orçamento")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/40">
                  <Th>{t("Nº")}</Th>
                  <Th>{t("Contratante")}</Th>
                  <Th>{t("Tipo")}</Th>
                  <Th>{t("Artista")}</Th>
                  <Th>{t("Cidade")}</Th>
                  <Th>{t("Data show")}</Th>
                  <Th className="text-right">{t("Valor")}</Th>
                  <Th>{t("Status")}</Th>
                  <Th className="w-[1%]"></Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((o) => {
                  const cont = contratantes.find((c) => c.id === o.contratanteId);
                  const cid = cidades.find((c) => c.id === o.cidadeId);
                  const artista = artistas.find((d) => d.id === o.artistaId);
                  const st = LABELS_STATUS_ORCAMENTO[o.status];
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
                      onClick={() => onAbrir(o.id)}
                    >
                      <Td className="font-mono text-xs text-secondary">{o.numero}</Td>
                      <Td className="font-medium text-primary">{cont?.nome ?? "—"}</Td>
                      <Td>
                        <span className="badge badge-neutral">{t(LABELS_TIPO_EVENTO[o.tipoEvento])}</span>
                      </Td>
                      <Td className="text-secondary">{artista?.name ?? "—"}</Td>
                      <Td className="text-secondary">
                        {cid ? `${cid.nome}/${cid.estado}` : "—"}
                      </Td>
                      <Td className="text-secondary tabular-nums">
                        {o.dataShow
                          ? new Date(o.dataShow + "T12:00:00").toLocaleDateString("pt-BR")
                          : <span className="text-muted italic">{t("a definir")}</span>}
                      </Td>
                      <Td className="text-right tabular-nums font-semibold">
                        {formatBRL(o.valorCache)}
                      </Td>
                      <Td>
                        <span className={`badge ${st.badge}`}>{t(st.label)}</span>
                      </Td>
                      <Td>
                        <RowActions
                          onView={() => onAbrir(o.id)}
                          onWA={() => handleEnviarWA(o.id)}
                          onAccept={() => handleAceitar(o.id)}
                          onReject={() => marcarStatus(o.id, "recusado")}
                          onNegotiate={() => marcarStatus(o.id, "negociacao")}
                          onDuplicate={async () => {
                            const novo = await duplicarOrcamento(o.id);
                            if (novo) onAbrir(novo.id);
                          }}
                          onDelete={() => handleRemover(o.id)}
                          onTransformar={() => onTransformarEmVenda(o.id)}
                          status={o.status}
                          podeEditar={podeUI(o.artistaId || null, "vendas.editar_orcamento")}
                          podeConverter={podeUI(o.artistaId || null, "vendas.converter")}
                          podeExcluir={podeUI(o.artistaId || null, "vendas.excluir_orcamento")}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MiniLixeira tipo="orcamento" />
    </div>
  );
}

// ---------- Auxiliares ----------

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 stat-label font-semibold whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function StatusCard({
  label,
  value,
  color,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-interactive flex items-center justify-between gap-3 text-left"
      style={{
        borderColor: active ? color : undefined,
        boxShadow: active ? `0 0 0 1px ${color}` : undefined,
      }}
    >
      <div>
        <div className="stat-label">{label}</div>
        <div className="text-2xl font-bold tabular-nums mt-0.5">{value}</div>
      </div>
      <div
        className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: active ? `${color}20` : "var(--bg-elevated)",
          color,
        }}
      >
        {icon}
      </div>
    </button>
  );
}

function RowActions({
  onView,
  onWA,
  onAccept,
  onReject,
  onNegotiate,
  onDuplicate,
  onDelete,
  onTransformar,
  status,
  podeEditar,
  podeConverter,
  podeExcluir,
}: {
  onView: () => void;
  onWA: () => void;
  onAccept: () => void;
  onReject: () => void;
  onNegotiate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTransformar: () => void;
  status: OrcamentoStatus;
  podeEditar: boolean;
  podeConverter: boolean;
  podeExcluir: boolean;
}) {
  const t = useT();
  const semPermissao = t("Você não tem permissão para isso.");
  return (
    <div className="flex items-center gap-0.5 justify-end" onClick={(e) => e.stopPropagation()}>
      <ActionBtn label={t("Ver")} onClick={onView}>
        <Eye size={14} />
      </ActionBtn>
      <ActionBtn label={t("Enviar WhatsApp")} onClick={onWA}>
        <MessageCircle size={14} />
      </ActionBtn>
      {status !== "aceito" && (
        <ActionBtn label={t("Marcar aceito")} onClick={onAccept} disabled={!podeEditar} disabledTitle={semPermissao}>
          <CheckCircle2 size={14} className="text-success" />
        </ActionBtn>
      )}
      {status !== "recusado" && (
        <ActionBtn label={t("Transformar em venda")} onClick={onTransformar} disabled={!podeConverter} disabledTitle={semPermissao}>
          <CalendarCheck2 size={14} style={{ color: "var(--brand)" }} />
        </ActionBtn>
      )}
      {status !== "negociacao" && status !== "aceito" && (
        <ActionBtn label={t("Em negociação")} onClick={onNegotiate} disabled={!podeEditar} disabledTitle={semPermissao}>
          <Clock size={14} className="text-warning" />
        </ActionBtn>
      )}
      {status !== "recusado" && status !== "aceito" && (
        <ActionBtn label={t("Marcar recusado")} onClick={onReject} disabled={!podeEditar} disabledTitle={semPermissao}>
          <XCircle size={14} className="text-danger" />
        </ActionBtn>
      )}
      <ActionBtn label={t("Duplicar")} onClick={onDuplicate} disabled={!podeEditar} disabledTitle={semPermissao}>
        <Copy size={14} />
      </ActionBtn>
      <ActionBtn label={t("Remover")} onClick={onDelete} disabled={!podeExcluir} disabledTitle={semPermissao}>
        <Trash2 size={14} />
      </ActionBtn>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  children,
  disabled = false,
  disabledTitle,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? (disabledTitle ?? label) : label}
      aria-label={label}
      className="btn-ghost p-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
