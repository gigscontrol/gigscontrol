"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { Plus, Search, Eye, Trash2, CalendarCheck2, FileText, Ban, Pencil } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import MiniLixeira from "./MiniLixeira";
import { useVendas } from "@/lib/vendas-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { formatBRL } from "@/lib/whatsapp";
import { MODULE_THEMES } from "@/types";

type Props = {
  selectedArtistas: string[];
  onNovaVenda: () => void;
  onAbrir: (id: string) => void;
  onEditar: (id: string) => void;
};

export default function HistoricoVendas({ selectedArtistas, onNovaVenda, onAbrir, onEditar }: Props) {
  const t = useT();
  const accent = MODULE_THEMES.vendas.color;
  const { vendas, removeVenda, recarregar } = useVendas();
  const { orcamentos } = useOrcamentos();
  const { cidades } = useContatos();
  const artistas = useArtistas();
  const { podeUI } = useAuth();

  const [search, setSearch] = useState("");
  const [filtroDJ, setFiltroDJ] = useState<string | "todos">("todos");

  // Respeita a seleção de artistas da sidebar (filtro de visualização, não de
  // permissão — D3). Venda sem artistaId nunca some (não tem checkbox pra
  // remarcar).
  const vendasVisiveis = useMemo(
    () => vendas.filter((v) => !v.artistaId || selectedArtistas.includes(v.artistaId)),
    [vendas, selectedArtistas]
  );

  // Se o artista da pill foi desmarcado na sidebar, volta pra "todos" — senão
  // o dono fica preso vendo zero resultado sem pill visível pra desfazer.
  useEffect(() => {
    if (filtroDJ !== "todos" && !selectedArtistas.includes(filtroDJ)) {
      setFiltroDJ("todos");
    }
  }, [selectedArtistas, filtroDJ]);

  const lista = useMemo(() => {
    return [...vendasVisiveis]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .filter((v) => {
        if (filtroDJ !== "todos" && v.artistaId !== filtroDJ) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const cid = cidades.find((c) => c.id === v.cidadeId);
          const artista = artistas.find((d) => d.id === v.artistaId);
          const orc = v.orcamentoId
            ? orcamentos.find((o) => o.id === v.orcamentoId)
            : null;
          const haystack = [
            v.numero,
            v.contratanteNome,
            v.contratanteTelefone,
            v.contratanteDocumento,
            v.nomeEvento,
            v.nomeLocal,
            cid?.nome ?? "",
            artista?.name ?? "",
            orc?.numero ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [vendasVisiveis, search, filtroDJ, cidades, orcamentos, artistas]);

  // Métricas do topo contam só as ATIVAS — as canceladas continuam listadas
  // (com badge) mas não entram no faturamento nem na contagem de concretizadas.
  // Derivam de vendasVisiveis (não da lista crua) pra ficar coerente com o
  // filtro de artista da sidebar.
  const ativas = useMemo(() => vendasVisiveis.filter((v) => v.status !== "cancelada"), [vendasVisiveis]);
  const totalCache = useMemo(
    () => ativas.reduce((acc, v) => acc + (v.cache ?? 0), 0),
    [ativas]
  );

  function handleRemover(id: string) {
    // (Etapa 6) — modal+toast injetado mais abaixo via state pra remover
    // sem popup nativo. Ver bloco no fim deste componente.
    setRemoveAlvo(id);
  }

  const [removeAlvo, setRemoveAlvo] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);

  // Cancelar venda (D5) — modal com motivo opcional.
  const [cancelAlvo, setCancelAlvo] = useState<string | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelando, setCancelando] = useState(false);

  async function confirmarCancelamento() {
    if (!cancelAlvo) return;
    setCancelando(true);
    try {
      const res = await fetch(`/api/vendas/${cancelAlvo}/cancelar`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: cancelMotivo.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { erro?: string };
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      await recarregar();
      setCancelAlvo(null);
      setCancelMotivo("");
      setToastMsg({ msg: t("Venda cancelada."), tipo: "sucesso" });
    } catch (e) {
      setToastMsg({ msg: (e as Error).message, tipo: "erro" });
      setCancelAlvo(null);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Histórico de Vendas"
        subtitle={`${ativas.length} ${ativas.length === 1 ? t("venda concretizada") : t("vendas concretizadas")} · ${t("Total")} ${formatBRL(totalCache)}`}
        accentColor={accent}
        actions={
          <button
            onClick={onNovaVenda}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Plus size={14} />
            {t("Nova venda direta")}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 flex-1 min-w-[240px] max-w-md focus-within:border-border-strong transition-colors">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar por nº, contratante, evento, local...")}
            className="input"
          />
        </div>

        <div className="pill-group">
          <button
            type="button"
            className={`pill ${filtroDJ === "todos" ? "active" : ""}`}
            onClick={() => setFiltroDJ("todos")}
          >
            {t("Todos artistas")}
          </button>
          {artistas
            .filter((d) => selectedArtistas.includes(d.id))
            .map((d) => (
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

      <div className="card p-0 overflow-hidden">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
              <CalendarCheck2 size={18} className="text-muted" />
            </div>
            <div className="section-title mb-1">
              {vendas.length === 0 ? t("Nenhuma venda concretizada ainda") : t("Nenhum resultado")}
            </div>
            <div className="section-subtitle mb-4">
              {vendas.length === 0
                ? t("Concretize um orçamento aceito ou crie uma venda direta")
                : t("Ajuste os filtros ou a busca")}
            </div>
            {vendas.length === 0 && (
              <button
                onClick={onNovaVenda}
                className="btn btn-primary"
                style={{ backgroundColor: accent, color: "#fff" }}
              >
                <Plus size={14} />
                {t("Nova venda direta")}
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
                  <Th>{t("Evento")}</Th>
                  <Th>{t("Artista")}</Th>
                  <Th>{t("Cidade")}</Th>
                  <Th>{t("Data show")}</Th>
                  <Th className="text-right">{t("Cachê")}</Th>
                  <Th>{t("Origem")}</Th>
                  <Th className="w-[1%]"></Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => {
                  const cid = cidades.find((c) => c.id === v.cidadeId);
                  const artista = artistas.find((d) => d.id === v.artistaId);
                  const orc = v.orcamentoId
                    ? orcamentos.find((o) => o.id === v.orcamentoId)
                    : null;
                  const cancelada = v.status === "cancelada";
                  const podeCancelar =
                    !cancelada && podeUI(v.artistaId || null, "vendas.cancelar_venda");
                  // Mesmo gate do VendaDetalhe.tsx:62-65 — permissão de VENDAS,
                  // não de agenda. Sem `!cancelada`: nem o VendaDetalhe nem o
                  // PATCH do servidor travam a edição de venda cancelada, e
                  // esconder só o atalho aqui daria a impressão falsa de trava
                  // (o ícone "Ver" ao lado leva à mesma edição).
                  const podeEditar =
                    podeUI(v.artistaId || null, "vendas.editar_venda") ||
                    podeUI(v.artistaId || null, "vendas.editar_todos");
                  return (
                    <tr
                      key={v.id}
                      className={`border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer ${cancelada ? "opacity-60" : ""}`}
                      onClick={() => onAbrir(v.id)}
                    >
                      <Td className="font-mono text-xs" style={{ color: accent }}>
                        <span className={cancelada ? "line-through" : ""}>{v.numero}</span>
                        {cancelada && (
                          <span className="badge badge-neutral inline-flex items-center gap-1 ml-2 no-underline">
                            <Ban size={10} />
                            {t("Cancelada")}
                          </span>
                        )}
                      </Td>
                      <Td className="font-medium text-primary truncate max-w-[200px]">
                        {v.contratanteNome}
                      </Td>
                      <Td className="text-secondary truncate max-w-[220px]">
                        {v.nomeEvento}
                        {v.nomeLocal && (
                          <span className="block text-xs text-muted truncate">
                            {v.nomeLocal}
                          </span>
                        )}
                      </Td>
                      <Td className="text-secondary">{artista?.name ?? "—"}</Td>
                      <Td className="text-secondary">
                        {cid ? `${cid.nome}/${cid.estado}` : "—"}
                      </Td>
                      <Td className="text-secondary tabular-nums">
                        {new Date(v.dataShow + "T12:00:00").toLocaleDateString("pt-BR")}
                      </Td>
                      <Td className="text-right tabular-nums font-semibold">
                        {formatBRL(v.cache)}
                      </Td>
                      <Td>
                        {orc ? (
                          <span className="badge badge-neutral inline-flex items-center gap-1">
                            <FileText size={10} />
                            {orc.numero}
                          </span>
                        ) : (
                          <span className="text-xs text-muted italic">{t("direta")}</span>
                        )}
                      </Td>
                      <Td>
                        <div
                          className="flex items-center gap-0.5 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onAbrir(v.id)}
                            className="btn-ghost p-1.5 rounded"
                            title={t("Ver")}
                          >
                            <Eye size={14} />
                          </button>
                          {podeEditar && (
                            <button
                              onClick={() => onEditar(v.id)}
                              className="btn-ghost p-1.5 rounded"
                              title={t("Editar venda")}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {podeCancelar && (
                            <button
                              onClick={() => {
                                setCancelMotivo("");
                                setCancelAlvo(v.id);
                              }}
                              className="btn-ghost p-1.5 rounded"
                              title={t("Cancelar venda")}
                            >
                              <Ban size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemover(v.id)}
                            className="btn-ghost p-1.5 rounded"
                            title={t("Remover")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MiniLixeira tipo="venda" />

      {/* Confirmação de remover */}
      <Modal
        isOpen={!!removeAlvo}
        onClose={() => setRemoveAlvo(null)}
        title={t("Remover venda")}
        subtitle={t("Esta ação pode ser desfeita até 30 dias na Lixeira.")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            {t("A venda e suas parcelas vão pra")} <strong className="text-primary">{t("Lixeira")}</strong>. {t("Você pode restaurar em até 30 dias. Depois disso, é apagado automaticamente.")}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setRemoveAlvo(null)}
              className="btn btn-secondary"
              disabled={removendo}
            >
              {t("Cancelar")}
            </button>
            <button
              onClick={async () => {
                if (!removeAlvo) return;
                setRemovendo(true);
                try {
                  await removeVenda(removeAlvo);
                  setRemoveAlvo(null);
                  setToastMsg({ msg: t("Venda removida."), tipo: "sucesso" });
                } catch (e) {
                  setToastMsg({ msg: (e as Error).message, tipo: "erro" });
                  setRemoveAlvo(null);
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

      {/* Confirmação de cancelar venda (D5) */}
      <Modal
        isOpen={!!cancelAlvo}
        onClose={() => setCancelAlvo(null)}
        title={t("Cancelar venda")}
        subtitle={t("A venda continua no histórico, marcada como cancelada.")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            {t("A venda sai dos dashboards e do \"a receber\". As parcelas não pagas são canceladas; as já pagas permanecem. A venda continua visível no histórico com o selo Cancelada.")}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="stat-label">{t("Motivo (opcional)")}</label>
            <textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder={t("Ex.: contratante desistiu, evento cancelado…")}
              rows={2}
              maxLength={1000}
              className="input resize-none bg-surface border border-border rounded-md px-3 py-2 focus:border-border-strong transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setCancelAlvo(null)}
              className="btn btn-secondary"
              disabled={cancelando}
            >
              {t("Voltar")}
            </button>
            <button
              onClick={confirmarCancelamento}
              className="btn btn-primary"
              style={{ backgroundColor: "var(--danger)", color: "#fff" }}
              disabled={cancelando}
            >
              {cancelando ? t("Cancelando...") : t("Confirmar cancelamento")}
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

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 stat-label font-semibold whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td className={`px-4 py-3 align-middle ${className}`} style={style}>
      {children}
    </td>
  );
}
