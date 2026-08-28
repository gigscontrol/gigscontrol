"use client";

import { ArrowLeft, Pencil, Mail, Phone, MapPin, Calendar, Music, Building2, Users, FileText, Banknote, Hash, StickyNote } from "lucide-react";
import { FichaHeroPagina, Bloco, Linha } from "./detalhes/FichaUI";
import { useContatos } from "@/lib/contatos-context";
import {
  getContratanteStats,
  getCasaStats,
  getCidadeStats,
  getCidadeNome,
  getCidadePrincipalContratante,
  formatarFaturamento,
} from "@/lib/contatos-stats";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { MODULE_THEMES, LABELS_STATUS_ORCAMENTO, LABELS_TIPO_CASA } from "@/types";
import { useT } from "@/lib/i18n";
import { mascararCpfCnpj, formatarMoeda } from "@/lib/formatters";
import { ResumoModal, ResumoLista } from "./DashboardResumo";
import { useEffect, useState } from "react";
import type { Contratante, Casa, Cidade, Show, Venda, Moeda, Orcamento } from "@/types";
import { iniciaisDoNome } from "@/lib/iniciais";

/**
 * Detalhe de contato (contratante/casa/cidade) na LINGUAGEM DA FICHA
 * (redesign 28/08/2026, mesmo tratamento de VendaDetalhe/OrcamentoDetalhe):
 * herói de página com gradiente (FichaHeroPagina), blocos com ícone
 * (Bloco/Linha) e malha alinhada — grid único de 2 colunas onde cada linha
 * de cards compartilha a altura. Métricas, históricos clicáveis, histórico
 * sanitizado (I12), documentos antigos (D3-UI) e "ver todos" (D8) mantidos.
 */

/** Moeda de um show herdada da venda que o gerou (show.vendaId → venda.moeda);
 *  sem venda vinculada → BRL, mantendo a agência 100% BRL idêntica a hoje. */
function moedaDoShow(show: Show, vendas: Venda[]): Moeda {
  return (show.vendaId && vendas.find((v) => v.id === show.vendaId)?.moeda) || "BRL";
}

type Selecionado =
  | { tipo: "contratante"; item: Contratante }
  | { tipo: "casa"; item: Casa }
  | { tipo: "cidade"; item: Cidade };

type Props = {
  selecionado: Selecionado;
  onBack: () => void;
  onEdit: () => void;
  /** Abre o modal global de detalhe do show (ShowDetalheModal, montado em
   *  layout.tsx). Histórico de shows do contratante/casa/cidade fica
   *  clicável quando presente; sem a prop, as linhas ficam estáticas. */
  onAbrirShow?: (id: string) => void;
};

/** Espelha `DocumentoContratante` (tipo do WI-B, ainda não necessariamente
 *  presente em types/index.ts dependendo da ordem de merge) — declarado
 *  localmente pra não invadir arquivo de outro WI. Acesso via cast degrada
 *  com elegância pra lista vazia quando o campo `documentos` não existe
 *  (contatos antigos / WI-B ainda não aplicado). */
type DocumentoHistorico = {
  documento: string;
  pais?: string;
  /** Razão social DESTE documento (migração 91) — a razão pertence ao
   *  documento, não à pessoa (D1): cada CNPJ do histórico tem a sua. */
  razao_social?: string;
  primeiro_uso: string;
  ultimo_uso: string;
};

function getDocumentosHistorico(item: Contratante): DocumentoHistorico[] {
  const raw = (item as unknown as { documentos?: unknown }).documentos;
  return Array.isArray(raw) ? (raw as DocumentoHistorico[]) : [];
}

/** Linha do histórico sanitizado (I12) — o shape que a rota /historico devolve. */
type HistoricoSanitizadoItem = {
  id: string;
  data: string | null;
  status: string;
  cidadeNome: string;
  cidadeUf: string;
  casaNome: string;
  artistaNome: string;
  artistaCor: string | null;
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  confirmado: { label: "Confirmado", cls: "badge-success" },
  pendente: { label: "Pendente", cls: "badge-danger" },
  logistica: { label: "Logística", cls: "badge-warning" },
  cancelado: { label: "Cancelado", cls: "badge-danger" },
};

export default function ContatoDetail({ selecionado, onBack, onEdit, onAbrirShow }: Props) {
  const t = useT();
  const accent = MODULE_THEMES.contatos.color;
  const { cidades, contratantes } = useContatos();
  const { shows } = useShows();
  const { orcamentos } = useOrcamentos();
  const { vendas } = useVendas();
  // D8 — estado do modal "ver todos os shows" da casa. Mora aqui (no
  // componente-pai) porque CasaDetail é uma function declarada dentro deste
  // corpo e é recriada a cada render — um useState dentro dela reiniciaria
  // a cada re-render do pai.
  const [casaVerTodosAberto, setCasaVerTodosAberto] = useState(false);

  // I12 — histórico SANITIZADO do servidor (data/cidade/casa/artista, nunca
  // valores). Usado quando o cache local — escopado ao próprio artista — vem
  // vazio pro contratante de OUTRO artista. Mora aqui pelo mesmo motivo acima.
  const contratanteId = selecionado.tipo === "contratante" ? selecionado.item.id : null;
  const temShowsLocais =
    !!contratanteId && shows.some((s) => s.contratanteId === contratanteId);
  const [historicoSanitizado, setHistoricoSanitizado] = useState<HistoricoSanitizadoItem[]>([]);
  useEffect(() => {
    setHistoricoSanitizado([]);
    if (!contratanteId || temShowsLocais) return; // cache próprio cobre
    let ativo = true;
    (async () => {
      try {
        const res = await fetch(`/api/contatos/contratantes/${contratanteId}/historico`, {
          credentials: "include",
        });
        if (!res.ok) return; // best-effort: sem histórico a tela segue inteira
        const body = (await res.json()) as { historico?: HistoricoSanitizadoItem[] };
        if (ativo) setHistoricoSanitizado(Array.isArray(body.historico) ? body.historico : []);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      ativo = false;
    };
  }, [contratanteId, temShowsLocais]);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <button
        onClick={onBack}
        className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={14} />
        {t("Voltar para Contatos")}
      </button>

      {selecionado.tipo === "contratante" && (
        <ContratanteDetail item={selecionado.item} accent={accent} onEdit={onEdit} />
      )}
      {selecionado.tipo === "casa" && (
        <CasaDetail item={selecionado.item} accent={accent} onEdit={onEdit} />
      )}
      {selecionado.tipo === "cidade" && (
        <CidadeDetail item={selecionado.item} accent={accent} onEdit={onEdit} />
      )}
    </div>
  );

  function ContratanteDetail({
    item,
    accent,
    onEdit,
  }: {
    item: Contratante;
    accent: string;
    onEdit: () => void;
  }) {
    // Evita stale prop: `item` chega por valor e pode ficar velho depois que
    // o popup de divergência (WI-A) atualiza o contato com o detalhe aberto.
    const atual = contratantes.find((c) => c.id === item.id) ?? item;
    const stats = getContratanteStats(atual.id, shows, orcamentos, vendas);
    const artistas = useArtistas();
    // J3 — histórico de orçamentos deste contratante, mais recente primeiro.
    // `orcamentos` (useOrcamentos) já vem escopado no servidor pela sessão
    // (aplicarFiltroOrcamentos): pro contratante de OUTRO artista o cache
    // local vem vazio — degrada pro estado vazio abaixo.
    const orcamentosContratante = [...orcamentos]
      .filter((o) => o.contratanteId === atual.id)
      .sort((a, b) => (b.dataShow ?? b.criadoEm).localeCompare(a.dataShow ?? a.criadoEm));
    // D-TICKET — ticket médio só faz sentido com uma moeda; com vendas em moedas
    // diferentes o número seria aritmética falsa → mostra "—" com tooltip.
    const ticketMedioLabel =
      stats.moedaUnica === null
        ? "—"
        : stats.ticketMedio > 0
        ? formatarMoeda(stats.ticketMedio, stats.moedaUnica, 0)
        : "—";
    const showsContratante = shows.filter((s) => s.contratanteId === atual.id);
    // D6 — cidade "principal" exibida = cidade do último show REALIZADO,
    // com fallback pro cidade_id gravado. Só exibição — não mexe no
    // cidade_id gravado (que alimenta geocode/mapa).
    const cidadePrincipalId = getCidadePrincipalContratante(atual.id, shows) ?? atual.cidadeId;
    // D3-UI — histórico de documentos (jsonb, WI-B). Degrada pra nada quando
    // vazio/ausente (contato antigo ou WI-B ainda não aplicado).
    const documentosHistorico = getDocumentosHistorico(atual);
    const temHistoricoDocumentos =
      documentosHistorico.length > 1 ||
      (documentosHistorico.length === 1 && documentosHistorico[0].documento !== atual.documento);

    return (
      <>
        <FichaHeroPagina
          artistaNome={atual.nome}
          artistaCor={accent}
          linhaSuperior={
            <span className="normal-case">
              {t("cadastrado em")} {new Date(atual.criadoEm).toLocaleDateString("pt-BR")}
            </span>
          }
          badges={
            <>
              <span className="badge badge-info">
                <Users size={11} />
                {t("Contratante")}
              </span>
              {getCidadeNome(cidadePrincipalId, cidades) !== "—" && (
                <span className="badge badge-neutral">
                  <MapPin size={11} />
                  {getCidadeNome(cidadePrincipalId, cidades)}
                </span>
              )}
            </>
          }
          acoes={
            <button onClick={onEdit} className="btn btn-secondary">
              <Pencil size={14} />
              {t("Editar")}
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <MetricTile label={t("Orçamentos")} value={stats.totalOrcamentos.toString()} accent={accent} icon={<FileText size={14} />} />
          <MetricTile label={t("Total de shows")} value={stats.totalShows.toString()} accent={accent} icon={<Music size={14} />} />
          <MetricTile
            label={t("Ticket médio")}
            value={ticketMedioLabel}
            hint={stats.moedaUnica === null ? t("Ticket médio indisponível com múltiplas moedas") : undefined}
            icon={<Hash size={14} />}
          />
          <MetricTile
            label={t("Último show")}
            value={
              stats.ultimoShow
                ? t("Dia {n} — {venue}", { n: stats.ultimoShow.dayId, venue: stats.ultimoShow.venue })
                : t("Nenhum ainda")
            }
            icon={<Calendar size={14} />}
            small
          />
        </div>

        {/* MALHA ALINHADA (mesma do VendaDetalhe): grid único de 2 colunas,
            linhas de cards com a mesma altura. Orçamentos em col-span-2. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <Bloco icon={<Users size={14} />} title={t("Informações")}>
              <Linha icon={<Hash size={13} />} subtle={!atual.documento}>
                {mascararCpfCnpj(atual.documento) || "—"}
              </Linha>
              {atual.razaoSocial && (
                <Linha icon={<Building2 size={13} />}>{atual.razaoSocial}</Linha>
              )}
              <Linha icon={<Mail size={13} />} subtle={!atual.email}>
                {atual.email || "—"}
              </Linha>
              <Linha icon={<Phone size={13} />}>+{atual.telefone.replace(/\D/g, "")}</Linha>
              <Linha icon={<MapPin size={13} />}>
                {getCidadeNome(cidadePrincipalId, cidades)}
              </Linha>
            </Bloco>

            {atual.observacoes && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <Bloco icon={<StickyNote size={14} />} title={t("Observações")}>
                  <p className="text-sm text-secondary whitespace-pre-wrap">{atual.observacoes}</p>
                </Bloco>
              </div>
            )}

            {temHistoricoDocumentos && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <Bloco icon={<Hash size={14} />} title={t("Documentos já utilizados")}>
                  <div className="flex flex-col gap-1.5">
                    {[...documentosHistorico]
                      .sort((a, b) => (b.ultimo_uso || "").localeCompare(a.ultimo_uso || ""))
                      .map((d) => {
                        const principal = d.documento === atual.documento;
                        return (
                          <div
                            key={d.documento}
                            className="flex items-center justify-between gap-2 text-xs bg-elevated border border-border rounded-md px-2.5 py-1.5"
                          >
                            <span className="flex flex-col min-w-0">
                              <span className="font-mono text-secondary">{mascararCpfCnpj(d.documento)}</span>
                              {/* D1 — razão social é DESTE documento, não da pessoa: cada CNPJ do histórico mostra a sua. */}
                              {d.razao_social && (
                                <span className="text-muted truncate">{d.razao_social}</span>
                              )}
                            </span>
                            <span className="flex items-center gap-1.5 text-muted flex-shrink-0">
                              {d.pais && d.pais !== "BR" && <span>{d.pais}</span>}
                              {principal && <span className="badge badge-info">{t("Atual")}</span>}
                              <span>
                                {t("Último uso")}: {d.ultimo_uso ? new Date(d.ultimo_uso).toLocaleDateString("pt-BR") : "—"}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </Bloco>
              </div>
            )}
          </div>

          {/* Histórico de shows */}
          <div className="card">
            <Bloco icon={<Music size={14} />} title={t("Histórico de shows")}>
              {showsContratante.length === 0 && historicoSanitizado.length > 0 ? (
                // I12 — contratante de OUTRO artista: o cache local é escopado ao
                // próprio artista e vem vazio, mas quem tem acesso aos contatos
                // VÊ o histórico sanitizado do servidor: data, cidade, casa e
                // QUAL artista — nunca cachê/valores (a resposta não os carrega).
                <div className="flex flex-col gap-2">
                  {historicoSanitizado.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-border bg-elevated"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span
                          className="h-7 w-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold flex-shrink-0"
                          style={{ backgroundColor: h.artistaCor ?? "var(--bg-surface-2)", color: "#fff" }}
                        >
                          {iniciaisDoNome((h.artistaNome || "?"))}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-primary truncate">
                            {h.artistaNome || t("Artista")}
                          </div>
                          <div className="text-xs text-muted truncate">
                            {[h.casaNome, [h.cidadeNome, h.cidadeUf].filter(Boolean).join("/")]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                        {h.status === "cancelado" && (
                          <span className="badge badge-danger">{t("Cancelado")}</span>
                        )}
                        <span className="text-muted tabular-nums">
                          {h.data ? new Date(`${h.data}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : showsContratante.length === 0 ? (
                <div className="text-sm text-muted py-6 text-center">
                  {t("Este contratante ainda não fechou nenhum show.")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {showsContratante.map((show) => (
                    <LinhaShow
                      key={show.id}
                      show={show}
                      valorComLabel
                      moeda={moedaDoShow(show, vendas)}
                      subtitulo={`${show.venue} · ${show.location} · ${t("Dia {n}", { n: show.dayId })} · ${show.time || t("A definir")}`}
                      onAbrirShow={onAbrirShow}
                    />
                  ))}
                </div>
              )}
            </Bloco>
          </div>

          {/* J3 — Histórico de orçamentos, linha inteira (conteúdo largo). */}
          <div className="card lg:col-span-2">
            <Bloco icon={<FileText size={14} />} title={t("Histórico de orçamentos")}>
              {orcamentosContratante.length === 0 ? (
                <div className="text-sm text-muted py-6 text-center">
                  {t("Nenhum orçamento registrado para este contratante.")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {orcamentosContratante.map((orcamento) => (
                    <LinhaOrcamento
                      key={orcamento.id}
                      orcamento={orcamento}
                      artistaNome={artistas.find((a) => a.id === orcamento.artistaId)?.name}
                    />
                  ))}
                </div>
              )}
            </Bloco>
          </div>
        </div>
      </>
    );
  }

  function CasaDetail({ item, accent, onEdit }: { item: Casa; accent: string; onEdit: () => void }) {
    const stats = getCasaStats(item.id, shows, vendas);
    // Mais recente primeiro; shows sem data ficam por último.
    const showsCasa = [...shows.filter((s) => s.casaId === item.id)].sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return b.data.localeCompare(a.data);
    });
    const showsRecentes = showsCasa.slice(0, 5);

    // D8 — "quem já contratou aqui": contratantes distintos derivados dos
    // shows desta casa. Lista vazia é estado NORMAL (a visibilidade derivada
    // zera contratanteId pra quem só tem agenda.ver) — nunca derivar de
    // `vendas` pra "consertar" (reabriria o vazamento que stripShowDetalhado
    // fecha de propósito).
    const contratantesAqui = Array.from(
      new Set(showsCasa.map((s) => s.contratanteId).filter((id): id is string => Boolean(id)))
    )
      .map((id) => contratantes.find((c) => c.id === id))
      .filter((c): c is Contratante => Boolean(c));

    return (
      <>
        <FichaHeroPagina
          artistaNome={item.nome}
          artistaCor={accent}
          linhaSuperior={
            <span className="normal-case">{getCidadeNome(item.cidadeId, cidades)}</span>
          }
          badges={
            <span className="badge badge-info">
              <Building2 size={11} />
              {t(LABELS_TIPO_CASA[item.tipo])}
            </span>
          }
          acoes={
            <button onClick={onEdit} className="btn btn-secondary">
              <Pencil size={14} />
              {t("Editar")}
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <MetricTile label={t("Total de shows")} value={stats.totalShows.toString()} accent={accent} icon={<Music size={14} />} />
          <MetricTile label={t("Faturamento")} value={formatarFaturamento(stats.faturamentoPorMoeda)} accent={accent} icon={<Banknote size={14} />} />
          <MetricTile label={t("Capacidade")} value={item.capacidade?.toLocaleString("pt-BR") ?? "—"} icon={<Users size={14} />} />
          <MetricTile label={t("Artistas que tocaram")} value={stats.artistasQueTocaram.length.toString()} icon={<Music size={14} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <Bloco icon={<Building2 size={14} />} title={t("Informações")}>
              <Linha icon={<Building2 size={13} />} bold>{t(LABELS_TIPO_CASA[item.tipo])}</Linha>
              <Linha icon={<MapPin size={13} />}>{getCidadeNome(item.cidadeId, cidades)}</Linha>
              {item.endereco && <Linha icon={<MapPin size={13} />}>{item.endereco}</Linha>}
              {item.contatoResponsavel && (
                <Linha icon={<Users size={13} />}>{item.contatoResponsavel}</Linha>
              )}
              {item.telefone && <Linha icon={<Phone size={13} />}>{item.telefone}</Linha>}
            </Bloco>

            {item.observacoes && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <Bloco icon={<StickyNote size={14} />} title={t("Observações")}>
                  <p className="text-sm text-secondary whitespace-pre-wrap">{item.observacoes}</p>
                </Bloco>
              </div>
            )}

            {stats.artistasQueTocaram.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <Bloco icon={<Music size={14} />} title={t("Artistas que já tocaram aqui")}>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.artistasQueTocaram.map((artista) => (
                      <span key={artista} className="badge badge-neutral">{artista}</span>
                    ))}
                  </div>
                </Bloco>
              </div>
            )}

            {/* D8 — quem já contratou aqui */}
            <div className="mt-4 pt-4 border-t border-border/60">
              <Bloco icon={<Users size={14} />} title={t("Quem já contratou aqui")}>
                {contratantesAqui.length === 0 ? (
                  <div className="text-xs text-muted italic">{t("Nenhum contratante visível nos shows desta casa.")}</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {contratantesAqui.map((c) => (
                      <span key={c.id} className="badge badge-neutral">{c.nome}</span>
                    ))}
                  </div>
                )}
              </Bloco>
            </div>
          </div>

          <div className="card">
            {/* Título na gramática do Bloco, mas inline com o "Ver todos". */}
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                <span style={{ color: "var(--brand)" }}>
                  <Music size={14} />
                </span>
                {t("Shows realizados")}
              </div>
              {showsCasa.length > showsRecentes.length && (
                <button
                  type="button"
                  onClick={() => setCasaVerTodosAberto(true)}
                  className="text-xs font-medium text-info hover:underline flex-shrink-0"
                >
                  {t("Ver todos ({n})", { n: showsCasa.length })}
                </button>
              )}
            </div>
            {showsRecentes.length === 0 ? (
              <div className="text-sm text-muted py-6 text-center">
                {t("Nenhum show registrado nesta casa ainda.")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {showsRecentes.map((show) => (
                  <LinhaShow
                    key={show.id}
                    show={show}
                    moeda={moedaDoShow(show, vendas)}
                    subtitulo={`${t("Dia {n}", { n: show.dayId })} · ${show.time || t("A definir")}`}
                    onAbrirShow={onAbrirShow}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* D8 — "ver todos os shows" com acesso ao detalhe de cada um */}
        <ResumoModal
          isOpen={casaVerTodosAberto}
          onClose={() => setCasaVerTodosAberto(false)}
          title={t("Shows em {casa}", { casa: item.nome })}
          accentColor={accent}
        >
          <ResumoLista
            itens={showsCasa.map((show) => ({
              id: show.id,
              titulo: `${show.artistaNome} — ${t("Dia {n}", { n: show.dayId })}`,
              subtitulo: `${t(STATUS_BADGES[show.status]?.label ?? show.status)}${show.time ? ` · ${show.time}` : ""}`,
              valor: show.valor ? formatarMoeda(show.valor, moedaDoShow(show, vendas), 0) : undefined,
            }))}
            maxItens={showsCasa.length}
            onItemClick={(id) => {
              setCasaVerTodosAberto(false);
              onAbrirShow?.(id);
            }}
          />
        </ResumoModal>
      </>
    );
  }

  function CidadeDetail({ item, accent, onEdit }: { item: Cidade; accent: string; onEdit: () => void }) {
    const { casas } = useContatos();
    const stats = getCidadeStats(item.id, shows, casas, vendas);
    const casasAqui = casas.filter((c) => c.cidadeId === item.id);
    const showsCidade = shows.filter((s) => s.cidadeId === item.id);

    return (
      <>
        <FichaHeroPagina
          artistaNome={item.nome}
          artistaCor={accent}
          linhaSuperior={
            <span className="normal-case">
              {item.estado} · {item.regiao}
            </span>
          }
          badges={
            <span className="badge badge-info">
              <MapPin size={11} />
              {t("Cidade")}
            </span>
          }
          acoes={
            <button onClick={onEdit} className="btn btn-secondary">
              <Pencil size={14} />
              {t("Editar")}
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <MetricTile label={t("Casas cadastradas")} value={stats.totalCasas.toString()} accent={accent} icon={<Building2 size={14} />} />
          <MetricTile label={t("Total de shows")} value={stats.totalShows.toString()} accent={accent} icon={<Music size={14} />} />
          <MetricTile label={t("Faturamento")} value={formatarFaturamento(stats.faturamentoPorMoeda)} icon={<Banknote size={14} />} />
          <MetricTile
            label={t("Top artista")}
            value={stats.topArtista ? `${stats.topArtista.nome} (${stats.topArtista.shows})` : "—"}
            icon={<Music size={14} />}
            small
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <Bloco icon={<Building2 size={14} />} title={t("Casas nesta cidade")}>
              {casasAqui.length === 0 ? (
                <div className="text-sm text-muted py-6 text-center">{t("Nenhuma casa cadastrada aqui.")}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {casasAqui.map((c) => (
                    <div key={c.id} className="bg-elevated border border-border rounded-md p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-primary">{c.nome}</div>
                        <div className="text-xs text-muted">{t(LABELS_TIPO_CASA[c.tipo])}</div>
                      </div>
                      {c.capacidade && (
                        <div className="text-xs text-secondary flex items-center gap-1 flex-shrink-0">
                          <Users size={12} />
                          {c.capacidade.toLocaleString("pt-BR")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Bloco>
          </div>

          <div className="card">
            <Bloco icon={<Music size={14} />} title={t("Shows nesta cidade")}>
              {showsCidade.length === 0 ? (
                <div className="text-sm text-muted py-6 text-center">{t("Nenhum show realizado aqui ainda.")}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {showsCidade.map((show) => (
                    <LinhaShow
                      key={show.id}
                      show={show}
                      moeda={moedaDoShow(show, vendas)}
                      subtitulo={`${show.venue} · ${t("Dia {n}", { n: show.dayId })}`}
                      onAbrirShow={onAbrirShow}
                    />
                  ))}
                </div>
              )}
            </Bloco>
          </div>
        </div>
      </>
    );
  }
}

// ---------- Componentes auxiliares ----------

function MetricTile({
  label,
  value,
  accent,
  icon,
  small,
  hint,
}: {
  label: string;
  value: string;
  accent?: string;
  icon: React.ReactNode;
  small?: boolean;
  /** Tooltip no valor (ex.: explicar o "—" do ticket médio multi-moeda). */
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="stat-label">{label}</span>
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center"
          style={{
            backgroundColor: accent ? `${accent}15` : "var(--bg-elevated)",
            color: accent ?? "var(--text-secondary)",
          }}
        >
          {icon}
        </div>
      </div>
      <div className={small ? "text-base font-semibold" : "stat-value"} title={hint}>
        {value}
      </div>
    </div>
  );
}

/** D9/D8 — linha de show do histórico (contratante/casa/cidade). Clicável
 *  quando `onAbrirShow` está presente (abre o ShowDetalheModal global); sem
 *  a prop, degrada pra linha estática (comportamento antigo). */
function LinhaShow({
  show,
  subtitulo,
  valorComLabel,
  onAbrirShow,
  moeda = "BRL",
}: {
  show: Show;
  subtitulo: React.ReactNode;
  /** "Valor" com rótulo acima (Histórico do contratante) vs. só o número (casa/cidade). */
  valorComLabel?: boolean;
  onAbrirShow?: (id: string) => void;
  /** Moeda do valor do show (herdada da venda). Default BRL → agência legado igual. */
  moeda?: Moeda;
}) {
  const t = useT();
  const badge = STATUS_BADGES[show.status] ?? STATUS_BADGES.pendente;
  const conteudo = (
    <>
      <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center text-secondary flex-shrink-0">
        <Music size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-primary">{show.artistaNome}</span>
          <span className={`badge ${badge.cls}`}>{t(badge.label)}</span>
        </div>
        <div className="text-xs text-muted truncate">{subtitulo}</div>
      </div>
      {show.valor ? (
        valorComLabel ? (
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-muted">{t("Valor")}</div>
            <div className="text-sm font-semibold tabular-nums">{formatarMoeda(show.valor, moeda, 0)}</div>
          </div>
        ) : (
          <div className="text-sm font-semibold tabular-nums flex-shrink-0">{formatarMoeda(show.valor, moeda, 0)}</div>
        )
      ) : null}
    </>
  );

  if (!onAbrirShow) {
    return (
      <div className="bg-elevated border border-border rounded-md p-3 flex items-center gap-3">
        {conteudo}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onAbrirShow(show.id)}
      className="bg-elevated border border-border rounded-md p-3 flex items-center gap-3 text-left w-full hover:border-border-strong transition-colors"
    >
      {conteudo}
    </button>
  );
}

/** J3 — linha do histórico de orçamentos do contratante: número, status,
 *  artista, data e valor (na moeda do orçamento). Mesmo tratamento visual de
 *  LinhaShow, sem clique (não há tela de detalhe de orçamento navegável a
 *  partir daqui — o histórico de shows já cobre o caminho clicável). */
function LinhaOrcamento({
  orcamento,
  artistaNome,
}: {
  orcamento: Orcamento;
  artistaNome?: string;
}) {
  const t = useT();
  const badge = LABELS_STATUS_ORCAMENTO[orcamento.status];
  return (
    <div className="bg-elevated border border-border rounded-md p-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center text-secondary flex-shrink-0">
        <FileText size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-primary">{artistaNome ?? t("Artista")}</span>
          <span className={`badge ${badge.badge}`}>{t(badge.label)}</span>
        </div>
        <div className="text-xs text-muted truncate">
          {t("Orçamento nº {n}", { n: orcamento.numero })}
          {orcamento.dataShow
            ? ` · ${new Date(`${orcamento.dataShow}T12:00:00`).toLocaleDateString("pt-BR")}`
            : ` · ${t("Sem data definida")}`}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-muted">{t("Valor")}</div>
        <div className="text-sm font-semibold tabular-nums">
          {formatarMoeda(orcamento.valorCache, orcamento.moeda, 0)}
        </div>
      </div>
    </div>
  );
}
