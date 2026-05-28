"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Eye, Trash2, CalendarCheck2, FileText } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import MiniLixeira from "./MiniLixeira";
import { useVendas } from "@/lib/vendas-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { formatBRL } from "@/lib/whatsapp";
import { MODULE_THEMES } from "@/types";

type Props = {
  onNovaVenda: () => void;
  onAbrir: (id: string) => void;
};

export default function HistoricoVendas({ onNovaVenda, onAbrir }: Props) {
  const accent = MODULE_THEMES.vendas.color;
  const { vendas, removeVenda } = useVendas();
  const { orcamentos } = useOrcamentos();
  const { cidades } = useContatos();
  const artistas = useArtistas();

  const [search, setSearch] = useState("");
  const [filtroDJ, setFiltroDJ] = useState<string | "todos">("todos");

  const lista = useMemo(() => {
    return [...vendas]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .filter((v) => {
        if (filtroDJ !== "todos" && v.djId !== filtroDJ) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const cid = cidades.find((c) => c.id === v.cidadeId);
          const dj = artistas.find((d) => d.id === v.djId);
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
            dj?.name ?? "",
            orc?.numero ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [vendas, search, filtroDJ, cidades, orcamentos, artistas]);

  const totalCache = useMemo(
    () => vendas.reduce((acc, v) => acc + (v.cache ?? 0), 0),
    [vendas]
  );

  function handleRemover(id: string) {
    // (Etapa 6) — modal+toast injetado mais abaixo via state pra remover
    // sem popup nativo. Ver bloco no fim deste componente.
    setRemoveAlvo(id);
  }

  const [removeAlvo, setRemoveAlvo] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Histórico de Vendas"
        subtitle={`${vendas.length} ${vendas.length === 1 ? "venda concretizada" : "vendas concretizadas"} · Total ${formatBRL(totalCache)}`}
        accentColor={accent}
        actions={
          <button
            onClick={onNovaVenda}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Plus size={14} />
            Nova venda direta
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
            placeholder="Buscar por nº, contratante, evento, local..."
            className="input"
          />
        </div>

        <div className="pill-group">
          <button
            type="button"
            className={`pill ${filtroDJ === "todos" ? "active" : ""}`}
            onClick={() => setFiltroDJ("todos")}
          >
            Todos DJs
          </button>
          {artistas.map((d) => (
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
              {vendas.length === 0 ? "Nenhuma venda concretizada ainda" : "Nenhum resultado"}
            </div>
            <div className="section-subtitle mb-4">
              {vendas.length === 0
                ? "Concretize um orçamento aceito ou crie uma venda direta"
                : "Ajuste os filtros ou a busca"}
            </div>
            {vendas.length === 0 && (
              <button
                onClick={onNovaVenda}
                className="btn btn-primary"
                style={{ backgroundColor: accent, color: "#fff" }}
              >
                <Plus size={14} />
                Nova venda direta
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
                  <Th>Evento</Th>
                  <Th>DJ</Th>
                  <Th>Cidade</Th>
                  <Th>Data show</Th>
                  <Th className="text-right">Cachê</Th>
                  <Th>Origem</Th>
                  <Th className="w-[1%]"></Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => {
                  const cid = cidades.find((c) => c.id === v.cidadeId);
                  const dj = artistas.find((d) => d.id === v.djId);
                  const orc = v.orcamentoId
                    ? orcamentos.find((o) => o.id === v.orcamentoId)
                    : null;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
                      onClick={() => onAbrir(v.id)}
                    >
                      <Td className="font-mono text-xs" style={{ color: accent }}>
                        {v.numero}
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
                      <Td className="text-secondary">{dj?.name ?? "—"}</Td>
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
                          <span className="text-xs text-muted italic">direta</span>
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
                            title="Ver"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleRemover(v.id)}
                            className="btn-ghost p-1.5 rounded"
                            title="Remover"
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
        title="Remover venda"
        subtitle="Esta ação pode ser desfeita até 30 dias na Lixeira."
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            A venda e suas parcelas vão pra <strong className="text-primary">Lixeira</strong>. Você pode restaurar em até 30 dias. Depois disso, é apagado automaticamente.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setRemoveAlvo(null)}
              className="btn btn-secondary"
              disabled={removendo}
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (!removeAlvo) return;
                setRemovendo(true);
                try {
                  await removeVenda(removeAlvo);
                  setRemoveAlvo(null);
                  setToastMsg({ msg: "Venda removida.", tipo: "sucesso" });
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
