"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  podeConverterOrcamentoUI,
  podeEditarOrcamentoUI,
} from "@/lib/permissoes/gatesEquipeUI";
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
import { EstadoCarga } from "./EstadoCarga";
import MiniLixeira from "./MiniLixeira";
import { useConfirmar } from "./ConfirmarModal";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { gerarTextoWhatsApp, montarLinkWhatsApp } from "@/lib/whatsapp";
import { formatarMoeda, formatarDataBR } from "@/lib/formatters";
import TabelaDados, { type Coluna } from "./lista/TabelaDados";
import EstadoVazio from "./lista/EstadoVazio";
import { LABELS_STATUS_ORCAMENTO, LABELS_TIPO_EVENTO, MODULE_THEMES, type Orcamento, type OrcamentoStatus } from "@/types";

type Props = {
  selectedArtistas: string[];
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

export default function HistoricoOrcamentos({ selectedArtistas, onNovo, onAbrir, onTransformarEmVenda }: Props) {
  const t = useT();
  const { podeUI, sessao } = useAuth();
  const userId = sessao?.usuario.id;
  const accent = MODULE_THEMES.vendas.color;
  const { orcamentos, marcarStatus, aceitarOrcamento, removeOrcamento, duplicarOrcamento, carregando: carregandoOrcs, erro: erroOrcs, recarregar: recarregarOrcs } = useOrcamentos();
  const { contratantes, cidades, casas } = useContatos();
  const artistas = useArtistas();
  const { confirmar, confirmador } = useConfirmar();

  // Botão "Novo orçamento" não tem artista fixo (escolhido no wizard) →
  // habilita se o usuário puder criar orçamento em ALGUM artista.
  const podeCriarOrcamento = artistas.some((a) => podeUI(a.id, "vendas.criar"));

  const [filtroStatus, setFiltroStatus] = useState<OrcamentoStatus | "todos">("todos");
  const [search, setSearch] = useState("");

  // Respeita a seleção de artistas da sidebar (filtro de visualização, não de
  // permissão — D3). Orçamento sem artistaId nunca some (não tem checkbox pra
  // remarcar).
  const orcamentosVisiveis = useMemo(
    () => orcamentos.filter((o) => !o.artistaId || selectedArtistas.includes(o.artistaId)),
    [orcamentos, selectedArtistas]
  );

  const lista = useMemo(() => {
    return [...orcamentosVisiveis]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .filter((o) => {
        if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
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
  }, [orcamentosVisiveis, filtroStatus, search, contratantes, cidades, casas, artistas]);

  // Cards de status também derivam da lista visível, pra ficar coerente com
  // o filtro de artista da sidebar.
  const totalPorStatus = useMemo(() => {
    const acc: Record<OrcamentoStatus, number> = {
      pendente: 0,
      negociacao: 0,
      aceito: 0,
      recusado: 0,
    };
    orcamentosVisiveis.forEach((o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
    });
    return acc;
  }, [orcamentosVisiveis]);

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

  async function handleAceitar(id: string) {
    const orc = orcamentos.find((o) => o.id === id);
    if (!orc) return;
    const msg = !orc.dataShow
      ? t("Aceitar este orçamento? Como não há data definida, nenhum show será criado na agenda automaticamente — adicione a data depois para isso.")
      : t("Aceitar este orçamento? Um show será criado automaticamente na agenda.");
    if (await confirmar({ titulo: t("Aceitar orçamento"), mensagem: msg })) aceitarOrcamento(id);
  }

  async function handleRemover(id: string) {
    const ok = await confirmar({
      titulo: t("Remover orçamento"),
      mensagem: t("Remover este orçamento? Ele vai para a Lixeira e pode ser restaurado por 30 dias."),
      perigo: true,
    });
    if (ok) removeOrcamento(id);
  }

  // Colunas da lista padrão — as mesmas de antes, agora ordenáveis.
  const colunas = useMemo<Coluna<Orcamento>[]>(() => {
    const contratanteDe = (o: Orcamento) => contratantes.find((c) => c.id === o.contratanteId);
    const cidadeDe = (o: Orcamento) => cidades.find((c) => c.id === o.cidadeId);
    const artistaDe = (o: Orcamento) => artistas.find((d) => d.id === o.artistaId);
    return [
      {
        chave: "numero",
        titulo: "Nº",
        classe: "font-mono text-xs text-secondary",
        ordenarPor: (o) => o.numero,
        celula: (o) => o.numero,
      },
      {
        chave: "contratante",
        titulo: "Contratante",
        classe: "font-medium text-primary",
        ordenarPor: (o) => contratanteDe(o)?.nome,
        celula: (o) => contratanteDe(o)?.nome ?? "—",
      },
      {
        chave: "tipo",
        titulo: "Tipo",
        ordenarPor: (o) => t(LABELS_TIPO_EVENTO[o.tipoEvento]),
        celula: (o) => <span className="badge badge-neutral">{t(LABELS_TIPO_EVENTO[o.tipoEvento])}</span>,
      },
      {
        chave: "artista",
        titulo: "Artista",
        classe: "text-secondary",
        ordenarPor: (o) => artistaDe(o)?.name,
        celula: (o) => artistaDe(o)?.name ?? "—",
      },
      {
        chave: "cidade",
        titulo: "Cidade",
        classe: "text-secondary",
        ordenarPor: (o) => cidadeDe(o)?.nome,
        celula: (o) => {
          const cid = cidadeDe(o);
          return cid ? `${cid.nome}/${cid.estado}` : "—";
        },
      },
      {
        chave: "data",
        titulo: "Data show",
        classe: "text-secondary tabular-nums",
        decrescentePrimeiro: true,
        ordenarPor: (o) => o.dataShow,
        celula: (o) =>
          o.dataShow ? formatarDataBR(o.dataShow) : <span className="text-muted italic">{t("a definir")}</span>,
      },
      {
        chave: "valor",
        titulo: "Valor",
        alinhar: "direita",
        classe: "tabular-nums font-semibold",
        decrescentePrimeiro: true,
        ordenarPor: (o) => o.valorCache,
        celula: (o) => formatarMoeda(o.valorCache, o.moeda),
      },
      {
        chave: "status",
        titulo: "Status",
        ordenarPor: (o) => t(LABELS_STATUS_ORCAMENTO[o.status].label),
        celula: (o) => {
          const st = LABELS_STATUS_ORCAMENTO[o.status];
          return <span className={`badge ${st.badge}`}>{t(st.label)}</span>;
        },
      },
    ];
  }, [contratantes, cidades, artistas, t]);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Todos os orçamentos"
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

      {/* Falha de API deixa de parecer histórico vazio (auditoria 27/08/2026). */}
      <div className="mb-6 empty:hidden">
        <EstadoCarga
          carregando={carregandoOrcs && orcamentos.length === 0}
          erro={erroOrcs}
          aoTentar={recarregarOrcs}
          rotulo={t("orçamentos")}
        />
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatusCard
          label={t("Pendentes")}
          value={totalPorStatus.pendente}
          color="var(--warning)"
          icon={<Clock size={14} />}
          active={filtroStatus === "pendente"}
          onClick={() =>
            setFiltroStatus((s) => (s === "pendente" ? "todos" : "pendente"))
          }
        />
        <StatusCard
          label={t("Em negociação")}
          value={totalPorStatus.negociacao}
          color="var(--info)"
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
        <div className="flex items-center gap-2 bg-surface border border-border rounded-control px-3 py-2 flex-1 min-w-[240px] max-w-md focus-within:border-border-strong transition-colors">
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

        {/* Filtro de artista: SÓ o da barra lateral (havia um 2º aqui). */}
      </div>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        {lista.length === 0 ? (
          <EstadoVazio
            icone={<FileText size={18} />}
            titulo={orcamentos.length === 0 ? t("Nenhum orçamento criado ainda") : t("Nenhum resultado")}
            texto={
              orcamentos.length === 0
                ? t("Crie seu primeiro orçamento e envie pelo WhatsApp")
                : t("Ajuste os filtros ou a busca")
            }
            acao={
              orcamentos.length === 0 ? (
                <button
                  onClick={onNovo}
                  disabled={!podeCriarOrcamento}
                  title={!podeCriarOrcamento ? t("Você não tem permissão para isso.") : undefined}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  {t("Novo orçamento")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <TabelaDados
            itens={lista}
            colunas={colunas}
            chaveDe={(o) => o.id}
            onAbrir={(o) => onAbrir(o.id)}
            rotuloItens="orçamentos"
            acoes={(o) => (
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
                podeEditar={podeEditarOrcamentoUI(podeUI, o.artistaId || null, o.criadoPor, userId)}
                podeConverter={podeConverterOrcamentoUI(podeUI, o.artistaId || null, o.criadoPor, userId)}
                podeExcluir={podeUI(o.artistaId || null, "vendas.excluir_orcamento")}
              />
            )}
          />
        )}
      </div>

      <MiniLixeira tipo="orcamento" />
      {confirmador}
    </div>
  );
}

// ---------- Auxiliares ----------



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
      type="button"
      onClick={onClick}
      className="card flex flex-col gap-2 sm:gap-4 min-h-0 sm:min-h-[140px] p-3 sm:p-5 text-left cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
      style={{
        borderColor: active ? color : undefined,
        boxShadow: active ? `0 0 0 1px ${color}` : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <span className="stat-label">{label}</span>
        <div
          className="h-[30px] w-[30px] rounded-chip flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color, color: "var(--text-primary)" }}
        >
          {icon}
        </div>
      </div>
      <div className="stat-value max-sm:text-2xl max-sm:truncate">{value}</div>
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
        <ActionBtn label={t("Concretizar venda")} onClick={onTransformar} disabled={!podeConverter} disabledTitle={semPermissao}>
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
