"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import PageHeader from "./PageHeader";
import MiniLixeira from "./MiniLixeira";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { DJS } from "@/lib/djs";
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
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos, marcarStatus, aceitarOrcamento, removeOrcamento, duplicarOrcamento } = useOrcamentos();
  const { contratantes, cidades, casas } = useContatos();

  const [filtroStatus, setFiltroStatus] = useState<OrcamentoStatus | "todos">("todos");
  const [filtroDJ, setFiltroDJ] = useState<string | "todos">("todos");
  const [search, setSearch] = useState("");

  const lista = useMemo(() => {
    return [...orcamentos]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .filter((o) => {
        if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
        if (filtroDJ !== "todos" && o.djId !== filtroDJ) return false;
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
            DJS.find((d) => d.id === o.djId)?.name ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [orcamentos, filtroStatus, filtroDJ, search, contratantes, cidades, casas]);

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
    const dj = DJS.find((d) => d.id === orc.djId);
    const texto = gerarTextoWhatsApp(orc, { contratante: cont, cidade: cid, dj });
    const link = montarLinkWhatsApp(cont?.telefone ?? "", texto);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function handleAceitar(id: string) {
    const orc = orcamentos.find((o) => o.id === id);
    if (!orc) return;
    const msg = !orc.dataShow
      ? "Aceitar este orçamento? Como não há data definida, nenhum show será criado na agenda automaticamente — adicione a data depois para isso."
      : "Aceitar este orçamento? Um show será criado automaticamente na agenda.";
    if (confirm(msg)) aceitarOrcamento(id);
  }

  function handleRemover(id: string) {
    if (confirm("Remover este orçamento? Esta ação não pode ser desfeita.")) {
      removeOrcamento(id);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Histórico de Orçamentos"
        subtitle={`${orcamentos.length} orçamentos no total`}
        accentColor={accent}
        actions={
          <button
            onClick={onNovo}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Plus size={14} />
            Novo orçamento
          </button>
        }
      />

      {/* Cards de status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatusCard
          label="Pendentes"
          value={totalPorStatus.pendente}
          color="var(--text-secondary)"
          icon={<Clock size={14} />}
          active={filtroStatus === "pendente"}
          onClick={() =>
            setFiltroStatus((s) => (s === "pendente" ? "todos" : "pendente"))
          }
        />
        <StatusCard
          label="Em negociação"
          value={totalPorStatus.negociacao}
          color="var(--warning)"
          icon={<MessageCircle size={14} />}
          active={filtroStatus === "negociacao"}
          onClick={() =>
            setFiltroStatus((s) => (s === "negociacao" ? "todos" : "negociacao"))
          }
        />
        <StatusCard
          label="Aceitos"
          value={totalPorStatus.aceito}
          color="var(--success)"
          icon={<CheckCircle2 size={14} />}
          active={filtroStatus === "aceito"}
          onClick={() => setFiltroStatus((s) => (s === "aceito" ? "todos" : "aceito"))}
        />
        <StatusCard
          label="Recusados"
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
            placeholder="Buscar por número, contratante, cidade..."
            className="input"
          />
        </div>

        <div className="pill-group">
          {STATUS_FILTROS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`pill ${filtroStatus === s.value ? "active" : ""}`}
              onClick={() => setFiltroStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="pill-group">
          <button
            type="button"
            className={`pill ${filtroDJ === "todos" ? "active" : ""}`}
            onClick={() => setFiltroDJ("todos")}
          >
            Todos DJs
          </button>
          {DJS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`pill ${filtroDJ === d.id ? "active" : ""}`}
              onClick={() => setFiltroDJ(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
              <FileText size={18} className="text-muted" />
            </div>
            <div className="section-title mb-1">
              {orcamentos.length === 0 ? "Nenhum orçamento criado ainda" : "Nenhum resultado"}
            </div>
            <div className="section-subtitle mb-4">
              {orcamentos.length === 0
                ? "Crie seu primeiro orçamento e envie pelo WhatsApp"
                : "Ajuste os filtros ou a busca"}
            </div>
            {orcamentos.length === 0 && (
              <button
                onClick={onNovo}
                className="btn btn-primary"
                style={{ backgroundColor: accent, color: "#fff" }}
              >
                <Plus size={14} />
                Novo orçamento
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/40">
                  <Th>Nº</Th>
                  <Th>Contratante</Th>
                  <Th>Tipo</Th>
                  <Th>DJ</Th>
                  <Th>Cidade</Th>
                  <Th>Data show</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Status</Th>
                  <Th className="w-[1%]"></Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((o) => {
                  const cont = contratantes.find((c) => c.id === o.contratanteId);
                  const cid = cidades.find((c) => c.id === o.cidadeId);
                  const dj = DJS.find((d) => d.id === o.djId);
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
                        <span className="badge badge-neutral">{LABELS_TIPO_EVENTO[o.tipoEvento]}</span>
                      </Td>
                      <Td className="text-secondary">{dj?.name ?? "—"}</Td>
                      <Td className="text-secondary">
                        {cid ? `${cid.nome}/${cid.estado}` : "—"}
                      </Td>
                      <Td className="text-secondary tabular-nums">
                        {o.dataShow
                          ? new Date(o.dataShow + "T12:00:00").toLocaleDateString("pt-BR")
                          : <span className="text-muted italic">a definir</span>}
                      </Td>
                      <Td className="text-right tabular-nums font-semibold">
                        {formatBRL(o.valorCache)}
                      </Td>
                      <Td>
                        <span className={`badge ${st.badge}`}>{st.label}</span>
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
}) {
  return (
    <div className="flex items-center gap-0.5 justify-end" onClick={(e) => e.stopPropagation()}>
      <ActionBtn label="Ver" onClick={onView}>
        <Eye size={14} />
      </ActionBtn>
      <ActionBtn label="Enviar WhatsApp" onClick={onWA}>
        <MessageCircle size={14} />
      </ActionBtn>
      {status !== "aceito" && (
        <ActionBtn label="Marcar aceito" onClick={onAccept}>
          <CheckCircle2 size={14} className="text-success" />
        </ActionBtn>
      )}
      {status !== "recusado" && (
        <ActionBtn label="Transformar em venda" onClick={onTransformar}>
          <CalendarCheck2 size={14} style={{ color: "var(--module-vendas)" }} />
        </ActionBtn>
      )}
      {status !== "negociacao" && status !== "aceito" && (
        <ActionBtn label="Em negociação" onClick={onNegotiate}>
          <Clock size={14} className="text-warning" />
        </ActionBtn>
      )}
      {status !== "recusado" && status !== "aceito" && (
        <ActionBtn label="Marcar recusado" onClick={onReject}>
          <XCircle size={14} className="text-danger" />
        </ActionBtn>
      )}
      <ActionBtn label="Duplicar" onClick={onDuplicate}>
        <Copy size={14} />
      </ActionBtn>
      <ActionBtn label="Remover" onClick={onDelete}>
        <Trash2 size={14} />
      </ActionBtn>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="btn-ghost p-1.5 rounded"
    >
      {children}
    </button>
  );
}
