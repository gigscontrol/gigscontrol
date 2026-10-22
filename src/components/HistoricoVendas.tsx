"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { Plus, Search, Eye, Trash2, CalendarCheck2, Ban, Pencil } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Toast from "./Toast";
import MiniLixeira from "./MiniLixeira";
import { useVendas } from "@/lib/vendas-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContratos } from "@/lib/contratos-context";
import { STATUS_CONTRATO } from "@/lib/statusUI";
import { useContatos } from "@/lib/contatos-context";
import { useArtistas } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { podeEditarVendaUI, podeCancelarVendaUI } from "@/lib/permissoes/gatesEquipeUI";
import { formatarMoeda, formatarDataBR, totaisPorMoeda } from "@/lib/formatters";
import TabelaDados, { type Coluna } from "./lista/TabelaDados";
import EstadoVazio from "./lista/EstadoVazio";
import { MODULE_THEMES, statusEfetivoParcela, type Venda } from "@/types";
import { urls } from "@/lib/navegacao/rotas";

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
  const { contratos } = useContratos();
  const { cidades } = useContatos();
  const artistas = useArtistas();
  const { podeUI, sessao } = useAuth();
  const userId = sessao?.usuario.id;

  const [search, setSearch] = useState("");

  // Respeita a seleção de artistas da sidebar (filtro de visualização, não de
  // permissão — D3). Venda sem artistaId nunca some (não tem checkbox pra
  // remarcar).
  const vendasVisiveis = useMemo(
    () => vendas.filter((v) => !v.artistaId || selectedArtistas.includes(v.artistaId)),
    [vendas, selectedArtistas]
  );

  const lista = useMemo(() => {
    return [...vendasVisiveis]
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .filter((v) => {
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
  }, [vendasVisiveis, search, cidades, orcamentos, artistas]);

  // Métricas do topo contam só as ATIVAS — as canceladas continuam listadas
  // (com badge) mas não entram no faturamento nem na contagem de concretizadas.
  // Derivam de vendasVisiveis (não da lista crua) pra ficar coerente com o
  // filtro de artista da sidebar.
  const ativas = useMemo(() => vendasVisiveis.filter((v) => v.status !== "cancelada"), [vendasVisiveis]);

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

  // Colunas da lista padrão — as mesmas de antes, agora ordenáveis.
  // Contrato vivo da venda (o mais recente que não foi cancelado).
  const contratoDe = (v: Venda) =>
    contratos
      .filter((c) => c.vendaId === v.id && c.status !== "cancelado")
      .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))[0];
  // Resumo do pagamento pelas parcelas (as canceladas não contam).
  const pagamentoDe = (v: Venda): { rotulo: string; badge?: string; ordem: number } => {
    const ps = v.parcelas.map((p) => statusEfetivoParcela(p)).filter((st) => st !== "cancelado");
    if (ps.length === 0) return { rotulo: "—", ordem: 0 };
    if (ps.includes("atrasado")) return { rotulo: "Atrasado", badge: "badge-danger", ordem: 4 };
    const pagas = ps.filter((st) => st === "pago").length;
    if (pagas === ps.length) return { rotulo: "Pago", badge: "badge-success", ordem: 1 };
    return { rotulo: t("{a} de {n} pagas", { a: pagas, n: ps.length }), ordem: pagas === 0 ? 3 : 2 };
  };

  const colunas = useMemo<Coluna<Venda>[]>(() => {
    const cidadeDe = (v: Venda) => cidades.find((c) => c.id === v.cidadeId);
    const artistaDe = (v: Venda) => artistas.find((d) => d.id === v.artistaId);
    return [
      {
        chave: "numero",
        titulo: "Nº",
        classe: "font-mono text-xs",
        estilo: () => ({ color: accent }),
        ordenarPor: (v) => v.numero,
        celula: (v) => (
          <>
            <span className={v.status === "cancelada" ? "line-through" : ""}>{v.numero}</span>
            {v.status === "cancelada" && (
              <span className="badge badge-neutral inline-flex items-center gap-1 ml-2 no-underline">
                <Ban size={10} />
                {t("Cancelada")}
              </span>
            )}
          </>
        ),
      },
      {
        chave: "contratante",
        titulo: "Contratante",
        classe: "font-medium text-primary truncate max-w-[200px]",
        ordenarPor: (v) => v.contratanteNome,
        celula: (v) => v.contratanteNome,
      },
      {
        chave: "evento",
        titulo: "Evento",
        classe: "text-secondary truncate max-w-[220px]",
        ordenarPor: (v) => v.nomeEvento,
        celula: (v) => (
          <>
            {v.nomeEvento}
            {v.nomeLocal && <span className="block text-xs text-muted truncate">{v.nomeLocal}</span>}
          </>
        ),
      },
      {
        chave: "artista",
        titulo: "Artista",
        classe: "text-secondary",
        ordenarPor: (v) => artistaDe(v)?.name,
        celula: (v) => artistaDe(v)?.name ?? "—",
      },
      {
        chave: "cidade",
        titulo: "Cidade",
        classe: "text-secondary",
        ordenarPor: (v) => cidadeDe(v)?.nome,
        celula: (v) => {
          const cid = cidadeDe(v);
          return cid ? `${cid.nome}/${cid.estado}` : "—";
        },
      },
      {
        chave: "data",
        titulo: "Data show",
        classe: "text-secondary tabular-nums",
        decrescentePrimeiro: true,
        ordenarPor: (v) => v.dataShow,
        celula: (v) => formatarDataBR(v.dataShow),
      },
      {
        chave: "cache",
        titulo: "Cachê",
        alinhar: "direita",
        classe: "tabular-nums font-semibold",
        decrescentePrimeiro: true,
        ordenarPor: (v) => v.cache,
        celula: (v) => formatarMoeda(v.cache, v.moeda),
      },
      // "Origem" (quase sempre "direta") saiu; no lugar, as duas perguntas
      // que a lista de vendas precisa responder: tem contrato? já pagaram?
      {
        chave: "contrato",
        titulo: "Contrato",
        ordenarPor: (v) => contratoDe(v)?.status ?? "",
        celula: (v) => {
          if (v.status === "cancelada") return <span className="text-muted">—</span>;
          const c = contratoDe(v);
          if (!c) {
            return (
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--warning)" }}>
                {t("Sem contrato")}
              </span>
            );
          }
          const st = STATUS_CONTRATO[c.status];
          return <span className={`badge ${st.badge}`}>{t(st.label)}</span>;
        },
      },
      {
        chave: "pagamento",
        titulo: "Pagamento",
        ordenarPor: (v) => pagamentoDe(v).ordem,
        celula: (v) => {
          if (v.status === "cancelada") return <span className="text-muted">—</span>;
          const p = pagamentoDe(v);
          return p.badge ? (
            <span className={`badge ${p.badge}`}>{t(p.rotulo)}</span>
          ) : (
            <span className="text-xs text-secondary whitespace-nowrap">{p.rotulo}</span>
          );
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidades, artistas, contratos, accent, t]);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Todas as vendas"
        subtitle={`${ativas.length} ${ativas.length === 1 ? t("venda concretizada") : t("vendas concretizadas")} · ${t("Total")} ${totaisPorMoeda(ativas.map((v) => ({ valor: v.cache, moeda: v.moeda })))}`}
        accentColor={accent}
        actions={
          <button
            onClick={onNovaVenda}
            className="btn btn-primary"
            style={{ backgroundColor: "var(--brand-solid)", color: "#fff" }}
          >
            <Plus size={14} />
            {t("Nova venda")}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 flex-1 min-w-[240px] max-w-md foco-campo-dentro transition-colors">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input aria-label={t("Buscar vendas")}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar por nº, contratante, evento, local...")}
            className="input"
          />
        </div>

        {/* Filtro de artista: SÓ o da barra lateral (havia um 2º aqui). */}
      </div>

      <div className="card p-0 overflow-hidden">
        {lista.length === 0 ? (
          <EstadoVazio
            icone={<CalendarCheck2 size={18} />}
            titulo={vendas.length === 0 ? t("Nenhuma venda concretizada ainda") : t("Nenhum resultado")}
            texto={
              vendas.length === 0
                ? t("Concretize um orçamento aceito ou crie uma nova venda")
                : t("Ajuste os filtros ou a busca")
            }
            acao={
              vendas.length === 0 ? (
                <button onClick={onNovaVenda} className="btn btn-primary">
                  <Plus size={14} />
                  {t("Nova venda")}
                </button>
              ) : undefined
            }
          />
        ) : (
          <TabelaDados
            itens={lista}
            colunas={colunas}
            chaveDe={(v) => v.id}
            onAbrir={(v) => onAbrir(v.id)}
            hrefDe={(v) => urls.venda(v.id)}
            rotuloItens="vendas"
            linhaClasse={(v) => (v.status === "cancelada" ? "opacity-60" : "")}
            acoes={(v) => {
              const cancelada = v.status === "cancelada";
              const podeCancelar =
                !cancelada &&
                podeCancelarVendaUI(podeUI, v.artistaId || null, v.criadoPor, userId);
              // Mesmo gate do VendaDetalhe — permissão de VENDAS, não de agenda.
              // Sem `!cancelada`: nem o detalhe nem o PATCH travam a edição de
              // venda cancelada; esconder só aqui daria a impressão falsa de trava.
              const podeEditar = podeEditarVendaUI(podeUI, v.artistaId || null, v.criadoPor, userId);
              return (
                <>
                  <button onClick={() => onAbrir(v.id)} className="btn-ghost p-1.5 rounded" title={t("Ver")}>
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
                    className="btn-ghost p-1.5 rounded hover:text-danger"
                    title={t("Remover")}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              );
            }}
          />
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
              className="btn btn-danger"
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
            <label className="text-xs font-medium text-secondary">{t("Motivo (opcional)")}</label>
            <textarea aria-label={t("Motivo (opcional)")}
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder={t("Ex.: contratante desistiu, evento cancelado…")}
              rows={2}
              maxLength={1000}
              className="input resize-none bg-surface border border-border rounded-md px-3 py-2 foco-campo transition-colors"
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
              className="btn btn-danger"
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
