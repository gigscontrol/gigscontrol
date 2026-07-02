"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { Plus, Search, Users, Building2, MapPin, Pencil, Trash2, ChevronRight, Compass } from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import ContratanteForm from "./forms/ContratanteForm";
import CasaForm from "./forms/CasaForm";
import CidadeForm from "./forms/CidadeForm";
import ContatoDetail from "./ContatoDetail";
import MapaDobras from "./contatos/MapaDobras";
import MiniLixeira from "./MiniLixeira";
import { useContatos } from "@/lib/contatos-context";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { getContratanteStats, getCasaStats, getCidadeStats, getCidadeNome, formatBRL } from "@/lib/contatos-stats";
import { MODULE_THEMES } from "@/types";
import type { ContatoCategoria, Contratante, Casa, Cidade } from "@/types";

type Selecionado =
  | { tipo: "contratante"; item: Contratante }
  | { tipo: "casa"; item: Casa }
  | { tipo: "cidade"; item: Cidade }
  | null;

const TIPO_CASA_LABEL: Record<string, string> = {
  club: "Club",
  festival: "Festival",
  "festa-privada": "Festa privada",
  bar: "Bar",
  arena: "Arena",
  outro: "Outro",
};

export default function Contatos({
  categoriaInicial = "contratantes",
  selectedDJs = [],
}: {
  categoriaInicial?: ContatoCategoria;
  selectedDJs?: string[];
}) {
  const t = useT();
  const accent = MODULE_THEMES.contatos.color;
  const { contratantes, casas, cidades, removeContratante, removeCasa, removeCidade } = useContatos();
  const { shows } = useShows();
  const { orcamentos } = useOrcamentos();
  const { vendas } = useVendas();
  const artistasAtivos = useArtistas(); // só retorna DJs não-deletados

  const [categoria, setCategoria] = useState<ContatoCategoria>(categoriaInicial);
  const [search, setSearch] = useState("");
  const [selecionado, setSelecionado] = useState<Selecionado>(null);
  const [modal, setModal] = useState<
    | { type: "novo-contratante" }
    | { type: "edit-contratante"; item: Contratante }
    | { type: "novo-casa" }
    | { type: "edit-casa"; item: Casa }
    | { type: "novo-cidade" }
    | { type: "edit-cidade"; item: Cidade }
    | null
  >(null);

  // ----------------------------------------------------------------
  // Filtro por DJ selecionado (sidebar):
  //  - "comHist" = aparece em show/orçamento/venda cujo djId pertence
  //    a um DJ ATIVO (não está na lixeira). Registros vinculados a DJs
  //    já excluídos são ignorados — assim, contato que era exclusivo
  //    de um DJ deletado "vira manual" e passa a aparecer sempre.
  //  - "ativos" = subset de comHist em que pelo menos 1 dos djIds está
  //    em selectedDJs (DJs marcados na sidebar).
  // Regra final em passaFiltroDj: sem histórico → sempre visível;
  // com histórico → só se algum DJ marcado é dono.
  // ----------------------------------------------------------------
  const filtrosPorDj = useMemo(() => {
    const djSet = new Set(selectedDJs);
    const djsAtivosSet = new Set(artistasAtivos.map((a) => a.id));
    const contratantesAtivos = new Set<string>();
    const contratantesComHist = new Set<string>();
    const casasAtivas = new Set<string>();
    const casasComHist = new Set<string>();
    const cidadesAtivas = new Set<string>();
    const cidadesComHist = new Set<string>();

    const marcar = (
      djId: string | null | undefined,
      contId: string | null | undefined,
      casaId: string | null | undefined,
      cidadeId: string | null | undefined
    ) => {
      // Ignora registros de DJs deletados/inexistentes — o contato passa
      // a se comportar como manual.
      if (!djId || !djsAtivosSet.has(djId)) return;
      const djOk = djSet.has(djId);
      if (contId) {
        contratantesComHist.add(contId);
        if (djOk) contratantesAtivos.add(contId);
      }
      if (casaId) {
        casasComHist.add(casaId);
        if (djOk) casasAtivas.add(casaId);
      }
      if (cidadeId) {
        cidadesComHist.add(cidadeId);
        if (djOk) cidadesAtivas.add(cidadeId);
      }
    };

    for (const s of shows) marcar(s.djId, s.contratanteId, s.casaId ?? null, s.cidadeId);
    for (const o of orcamentos) marcar(o.djId, o.contratanteId, o.casaId ?? null, o.cidadeId);
    for (const v of vendas) marcar(v.djId, v.contratanteId, v.casaId ?? null, v.cidadeId);

    return {
      contratantesAtivos,
      contratantesComHist,
      casasAtivas,
      casasComHist,
      cidadesAtivas,
      cidadesComHist,
    };
  }, [shows, orcamentos, vendas, selectedDJs, artistasAtivos]);

  function passaFiltroDj(
    id: string,
    ativos: Set<string>,
    comHist: Set<string>
  ): boolean {
    // Sem histórico → contato manual, sempre visível
    if (!comHist.has(id)) return true;
    // Com histórico → só visível se algum DJ marcado tem ligação
    return ativos.has(id);
  }

  // Filtros aplicados conforme aba
  const contratantesFiltrados = useMemo(() => {
    const base = contratantes.filter((c) =>
      passaFiltroDj(c.id, filtrosPorDj.contratantesAtivos, filtrosPorDj.contratantesComHist)
    );
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        getCidadeNome(c.cidadeId, cidades).toLowerCase().includes(q)
    );
  }, [contratantes, search, cidades, filtrosPorDj]);

  const casasFiltradas = useMemo(() => {
    const base = casas.filter((c) =>
      passaFiltroDj(c.id, filtrosPorDj.casasAtivas, filtrosPorDj.casasComHist)
    );
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        getCidadeNome(c.cidadeId, cidades).toLowerCase().includes(q) ||
        TIPO_CASA_LABEL[c.tipo]?.toLowerCase().includes(q)
    );
  }, [casas, search, cidades, filtrosPorDj]);

  const cidadesFiltradas = useMemo(() => {
    const base = cidades.filter((c) =>
      passaFiltroDj(c.id, filtrosPorDj.cidadesAtivas, filtrosPorDj.cidadesComHist)
    );
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.estado.toLowerCase().includes(q)
    );
  }, [cidades, search, filtrosPorDj]);

  // Tela de detalhe quando algo selecionado
  if (selecionado) {
    return (
      <ContatoDetail
        selecionado={selecionado}
        onBack={() => setSelecionado(null)}
        onEdit={() => {
          if (selecionado.tipo === "contratante")
            setModal({ type: "edit-contratante", item: selecionado.item });
          else if (selecionado.tipo === "casa")
            setModal({ type: "edit-casa", item: selecionado.item });
          else setModal({ type: "edit-cidade", item: selecionado.item });
        }}
      />
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Contatos"
        subtitle="Contratantes, casas/eventos e cidades — sua base de relacionamento"
        accentColor={accent}
        actions={
          <button
            onClick={() => {
              if (categoria === "contratantes") setModal({ type: "novo-contratante" });
              else if (categoria === "casas") setModal({ type: "novo-casa" });
              else setModal({ type: "novo-cidade" });
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            {categoria === "contratantes" ? t("Novo contratante") : categoria === "casas" ? t("Nova casa") : t("Nova cidade")}
          </button>
        }
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryTile
          icon={<Users size={16} />}
          label={t("Contratantes")}
          value={contratantesFiltrados.length}
          active={categoria === "contratantes"}
          accent={accent}
          onClick={() => setCategoria("contratantes")}
        />
        <SummaryTile
          icon={<Building2 size={16} />}
          label={t("Casas / Eventos")}
          value={casasFiltradas.length}
          active={categoria === "casas"}
          accent={accent}
          onClick={() => setCategoria("casas")}
        />
        <SummaryTile
          icon={<MapPin size={16} />}
          label={t("Cidades")}
          value={cidadesFiltradas.length}
          active={categoria === "cidades"}
          accent={accent}
          onClick={() => setCategoria("cidades")}
        />
        <SummaryTile
          icon={<Compass size={16} />}
          label={t("Mapa de Dobras")}
          value={cidadesFiltradas.filter((c) => c.latitude !== undefined).length}
          active={categoria === "mapa"}
          accent={accent}
          onClick={() => setCategoria("mapa")}
        />
      </div>

      {/* Busca (não aparece no mapa) */}
      {categoria !== "mapa" && (
        <div className="flex items-center gap-2 bg-surface border border-border rounded-md px-3 py-2 mb-4 focus-within:border-border-strong transition-colors">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Buscar em {categoria}...", { categoria })}
            className="input"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted hover:text-primary text-xs">
              {t("Limpar")}
            </button>
          )}
        </div>
      )}

      {/* Mapa de Dobras (busca por raio) */}
      {categoria === "mapa" && (
        <MapaDobras
          cidades={cidadesFiltradas}
          casas={casasFiltradas}
          contratantes={contratantesFiltrados}
        />
      )}

      {/* Tabela conforme categoria */}
      {categoria !== "mapa" && (
      <div className="card p-0 overflow-hidden">
        {categoria === "contratantes" && (
          <TabelaContratantes
            items={contratantesFiltrados}
            onSelect={(item) => setSelecionado({ tipo: "contratante", item })}
            onEdit={(item) => setModal({ type: "edit-contratante", item })}
            onRemove={(id) => {
              if (confirm(t("Remover este contratante?"))) removeContratante(id);
            }}
          />
        )}

        {categoria === "casas" && (
          <TabelaCasas
            items={casasFiltradas}
            onSelect={(item) => setSelecionado({ tipo: "casa", item })}
            onEdit={(item) => setModal({ type: "edit-casa", item })}
            onRemove={(id) => {
              if (confirm(t("Remover esta casa?"))) removeCasa(id);
            }}
          />
        )}

        {categoria === "cidades" && (
          <TabelaCidades
            items={cidadesFiltradas}
            onSelect={(item) => setSelecionado({ tipo: "cidade", item })}
            onEdit={(item) => setModal({ type: "edit-cidade", item })}
            onRemove={(id) => {
              if (confirm(t("Remover esta cidade?"))) removeCidade(id);
            }}
          />
        )}
      </div>
      )}

      {/* Mini-lixeira da categoria ativa — só admin vê, e só se houver
          algum item dessa categoria na lixeira. */}
      {categoria === "contratantes" && <MiniLixeira tipo="contratante" />}
      {categoria === "casas" && <MiniLixeira tipo="casa" />}
      {categoria === "cidades" && <MiniLixeira tipo="cidade" />}

      {/* Modais */}
      <Modal
        isOpen={modal?.type === "novo-contratante" || modal?.type === "edit-contratante"}
        onClose={() => setModal(null)}
        title={modal?.type === "edit-contratante" ? t("Editar contratante") : t("Novo contratante")}
        subtitle={t("Cliente que contrata os DJs da agência")}
      >
        <ContratanteForm
          initial={modal?.type === "edit-contratante" ? modal.item : undefined}
          onSubmit={() => setModal(null)}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal
        isOpen={modal?.type === "novo-casa" || modal?.type === "edit-casa"}
        onClose={() => setModal(null)}
        title={modal?.type === "edit-casa" ? t("Editar casa / evento") : t("Nova casa / evento")}
        subtitle={t("Local onde os shows acontecem")}
        maxWidth={640}
      >
        <CasaForm
          initial={modal?.type === "edit-casa" ? modal.item : undefined}
          onSubmit={() => setModal(null)}
          onCancel={() => setModal(null)}
        />
      </Modal>

      <Modal
        isOpen={modal?.type === "novo-cidade" || modal?.type === "edit-cidade"}
        onClose={() => setModal(null)}
        title={modal?.type === "edit-cidade" ? t("Editar cidade") : t("Nova cidade")}
        subtitle={t("Cidades onde a agência atua")}
      >
        <CidadeForm
          initial={modal?.type === "edit-cidade" ? modal.item : undefined}
          onSubmit={() => setModal(null)}
          onCancel={() => setModal(null)}
        />
      </Modal>
    </div>
  );
}

// ---------- Tile de categoria ----------

function SummaryTile({
  icon,
  label,
  value,
  active,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card-interactive flex items-center gap-4 text-left"
      style={{
        borderColor: active ? accent : undefined,
        boxShadow: active ? `0 0 0 1px ${accent}` : undefined,
      }}
    >
      <div
        className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: active ? `${accent}20` : "var(--bg-elevated)",
          color: active ? accent : "var(--text-secondary)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="stat-label">{label}</div>
        <div className="text-2xl font-bold tabular-nums mt-0.5">{value}</div>
      </div>
      <ChevronRight size={16} className={active ? "" : "text-muted"} style={active ? { color: accent } : undefined} />
    </button>
  );
}

// ---------- Tabelas ----------

function TabelaContratantes({
  items,
  onSelect,
  onEdit,
  onRemove,
}: {
  items: Contratante[];
  onSelect: (c: Contratante) => void;
  onEdit: (c: Contratante) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const { cidades } = useContatos();
  const { shows } = useShows();
  const { orcamentos } = useOrcamentos();
  if (items.length === 0) return <EmptyTable label={t("Nenhum contratante encontrado")} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/40">
            <Th>{t("Nome")}</Th>
            <Th>{t("Cidade")}</Th>
            <Th>{t("Contato")}</Th>
            <Th className="text-right">{t("Orçamentos")}</Th>
            <Th className="text-right">{t("Shows")}</Th>
            <Th className="w-[1%]"></Th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const stats = getContratanteStats(c.id, shows, orcamentos);
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
              >
                <Td className="font-medium text-primary">{c.nome}</Td>
                <Td className="text-secondary">{getCidadeNome(c.cidadeId, cidades)}</Td>
                <Td className="text-secondary">
                  <div className="text-xs">{c.email || <span className="text-muted italic">{t("sem e-mail")}</span>}</div>
                  <div className="text-xs text-muted">{c.telefone}</div>
                </Td>
                <Td className="text-right tabular-nums font-semibold">{stats.totalOrcamentos}</Td>
                <Td className="text-right tabular-nums">{stats.totalShows}</Td>
                <Td>
                  <RowActions onEdit={() => onEdit(c)} onRemove={() => onRemove(c.id)} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabelaCasas({
  items,
  onSelect,
  onEdit,
  onRemove,
}: {
  items: Casa[];
  onSelect: (c: Casa) => void;
  onEdit: (c: Casa) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const { cidades } = useContatos();
  const { shows } = useShows();
  if (items.length === 0) return <EmptyTable label={t("Nenhuma casa encontrada")} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/40">
            <Th>{t("Nome")}</Th>
            <Th>{t("Tipo")}</Th>
            <Th>{t("Cidade")}</Th>
            <Th className="text-right">{t("Capacidade")}</Th>
            <Th className="text-right">{t("Shows")}</Th>
            <Th className="text-right">{t("Faturado")}</Th>
            <Th className="w-[1%]"></Th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const stats = getCasaStats(c.id, shows);
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
              >
                <Td className="font-medium text-primary">{c.nome}</Td>
                <Td>
                  <span className="badge badge-neutral">{t(TIPO_CASA_LABEL[c.tipo] ?? c.tipo)}</span>
                </Td>
                <Td className="text-secondary">{getCidadeNome(c.cidadeId, cidades)}</Td>
                <Td className="text-right tabular-nums">
                  {c.capacidade ? c.capacidade.toLocaleString("pt-BR") : "—"}
                </Td>
                <Td className="text-right tabular-nums">{stats.totalShows}</Td>
                <Td className="text-right tabular-nums font-semibold">
                  {stats.faturamento > 0 ? formatBRL(stats.faturamento) : "—"}
                </Td>
                <Td>
                  <RowActions onEdit={() => onEdit(c)} onRemove={() => onRemove(c.id)} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TabelaCidades({
  items,
  onSelect,
  onEdit,
  onRemove,
}: {
  items: Cidade[];
  onSelect: (c: Cidade) => void;
  onEdit: (c: Cidade) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const { shows } = useShows();
  if (items.length === 0) return <EmptyTable label={t("Nenhuma cidade encontrada")} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/40">
            <Th>{t("Cidade")}</Th>
            <Th>{t("UF")}</Th>
            <Th>{t("Região")}</Th>
            <Th className="text-right">{t("Casas")}</Th>
            <Th className="text-right">{t("Shows")}</Th>
            <Th className="text-right">{t("Faturado")}</Th>
            <Th>{t("Top DJ")}</Th>
            <Th className="w-[1%]"></Th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const stats = getCidadeStats(c.id, shows);
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
              >
                <Td className="font-medium text-primary">{c.nome}</Td>
                <Td className="text-secondary">{c.estado}</Td>
                <Td className="text-secondary">{c.regiao}</Td>
                <Td className="text-right tabular-nums">{stats.totalCasas}</Td>
                <Td className="text-right tabular-nums">{stats.totalShows}</Td>
                <Td className="text-right tabular-nums font-semibold">
                  {stats.faturamento > 0 ? formatBRL(stats.faturamento) : "—"}
                </Td>
                <Td className="text-secondary">
                  {stats.topDJ ? (
                    <span>
                      {stats.topDJ.nome}{" "}
                      <span className="text-muted">({stats.topDJ.shows})</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <RowActions onEdit={() => onEdit(c)} onRemove={() => onRemove(c.id)} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Utilitários de tabela ----------

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-left px-4 py-3 stat-label font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function RowActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
      <button onClick={onEdit} className="btn-ghost p-1.5 rounded" aria-label={t("Editar")}>
        <Pencil size={14} />
      </button>
      <button onClick={onRemove} className="btn-ghost p-1.5 rounded hover:text-danger" aria-label={t("Remover")}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EmptyTable({ label }: { label: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
        <Search size={18} className="text-muted" />
      </div>
      <div className="section-title mb-1">{label}</div>
      <div className="section-subtitle">{t("Ajuste a busca ou cadastre um novo registro")}</div>
    </div>
  );
}
