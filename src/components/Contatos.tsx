"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { Plus, Search, Users, Building2, MapPin, Pencil, Trash2, ChevronRight, Ban, ShieldCheck } from "lucide-react";
import PageHeader from "./PageHeader";
import DateRangeSelector from "./DateRangeSelector";
import Modal from "./Modal";
import ContratanteForm from "./forms/ContratanteForm";
import CasaForm from "./forms/CasaForm";
import CidadeForm from "./forms/CidadeForm";
import ContatoDetail from "./ContatoDetail";
import MiniLixeira from "./MiniLixeira";
import { useContatos } from "@/lib/contatos-context";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { getContratanteStats, getCasaStats, getCidadeStats, getCidadeNome, formatBRL } from "@/lib/contatos-stats";
import { MODULE_THEMES } from "@/types";
import type { ContatoCategoria, Contratante, Casa, Cidade, AgendaDateRange } from "@/types";

type Selecionado =
  | { tipo: "contratante"; item: Contratante }
  | { tipo: "casa"; item: Casa }
  | { tipo: "cidade"; item: Cidade }
  | null;

/** Abas do Gerenciar. "bloqueados" é a lista de contratantes+casas bloqueados. */
type Aba = ContatoCategoria | "bloqueados";

/** Item alvo do modal de bloqueio (bloquear/desbloquear contratante ou casa). */
type AlvoBloqueio =
  | { tipo: "contratante"; item: Contratante }
  | { tipo: "casa"; item: Casa };

const TIPO_CASA_LABEL: Record<string, string> = {
  club: "Club",
  festival: "Festival",
  "festa-privada": "Festa privada",
  bar: "Bar",
  arena: "Arena",
  outro: "Outro",
};

const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ATALHOS_CONTATOS: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

/** {ano, mes(0-based), tudo}. "Visão geral" = tudo (sem recorte). */
function resolverMes(
  range: AgendaDateRange,
  customMonth: string | null,
  customYear: number | null
): { ano: number; mes: number; tudo: boolean } {
  const h = new Date();
  if (range === "Visão geral") return { ano: h.getFullYear(), mes: h.getMonth(), tudo: true };
  if (range === "Mês anterior") {
    const d = new Date(h.getFullYear(), h.getMonth() - 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Próximo mês") {
    const d = new Date(h.getFullYear(), h.getMonth() + 1, 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), tudo: false };
  }
  if (range === "Personalizado" && customMonth && customYear !== null) {
    return { ano: customYear, mes: Math.max(0, MESES_CURTO.indexOf(customMonth)), tudo: false };
  }
  return { ano: h.getFullYear(), mes: h.getMonth(), tudo: false };
}

/** Casa a data de cadastro (ISO) no período. Sem data de cadastro → SEMPRE visível
 *  (registro legado não some do Gerenciar por causa do filtro de período). */
function dataNoMes(dataISO: string | undefined, p: { ano: number; mes: number; tudo: boolean }): boolean {
  if (p.tudo) return true;
  if (!dataISO) return true;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  return d.getFullYear() === p.ano && d.getMonth() === p.mes;
}

export default function Contatos({
  categoriaInicial = "contratantes",
  selectedArtistas = [],
}: {
  categoriaInicial?: ContatoCategoria;
  selectedArtistas?: string[];
}) {
  const t = useT();
  const accent = MODULE_THEMES.contatos.color;
  const {
    contratantes,
    casas,
    cidades,
    removeContratante,
    removeCasa,
    removeCidade,
    updateContratante,
    updateCasa,
  } = useContatos();
  const { shows } = useShows();
  const { orcamentos } = useOrcamentos();
  const { vendas } = useVendas();
  const artistasAtivos = useArtistas(); // só retorna DJs não-deletados
  const { equipe } = useWorkspace();

  /** userId → nome legível (para exibir "bloqueado por"). Admin não está na
   *  equipe, então cai no fallback. */
  const nomePorUsuario = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of equipe) m.set(u.id, u.nome);
    return m;
  }, [equipe]);

  const [categoria, setCategoria] = useState<Aba>(categoriaInicial);
  const [search, setSearch] = useState("");
  const { workspaceCriadoEm } = useWorkspace();
  const [range, setRange] = useState<AgendaDateRange>("Visão geral");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
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
  // Modal de bloqueio: pede o motivo ao bloquear um contratante/casa.
  const [bloquear, setBloquear] = useState<AlvoBloqueio | null>(null);
  const [motivoBloqueio, setMotivoBloqueio] = useState("");
  const [salvandoBloqueio, setSalvandoBloqueio] = useState(false);

  const abrirBloqueio = (alvo: AlvoBloqueio) => {
    setMotivoBloqueio("");
    setBloquear(alvo);
  };

  const confirmarBloqueio = async () => {
    if (!bloquear) return;
    setSalvandoBloqueio(true);
    try {
      const patch = { bloqueado: true, bloqueadoMotivo: motivoBloqueio.trim() || undefined };
      if (bloquear.tipo === "contratante") await updateContratante(bloquear.item.id, patch);
      else await updateCasa(bloquear.item.id, patch);
      setBloquear(null);
    } finally {
      setSalvandoBloqueio(false);
    }
  };

  const desbloquear = async (alvo: AlvoBloqueio) => {
    const patch = { bloqueado: false };
    if (alvo.tipo === "contratante") await updateContratante(alvo.item.id, patch);
    else await updateCasa(alvo.item.id, patch);
  };

  // ----------------------------------------------------------------
  // Filtro por DJ selecionado (sidebar):
  //  - "comHist" = aparece em show/orçamento/venda cujo artistaId pertence
  //    a um DJ ATIVO (não está na lixeira). Registros vinculados a DJs
  //    já excluídos são ignorados — assim, contato que era exclusivo
  //    de um DJ deletado "vira manual" e passa a aparecer sempre.
  //  - "ativos" = subset de comHist em que pelo menos 1 dos artistaIds está
  //    em selectedArtistas (DJs marcados na sidebar).
  // Regra final em passaFiltroDj: sem histórico → sempre visível;
  // com histórico → só se algum DJ marcado é dono.
  // ----------------------------------------------------------------
  const filtrosPorDj = useMemo(() => {
    const artistaSet = new Set(selectedArtistas);
    const djsAtivosSet = new Set(artistasAtivos.map((a) => a.id));
    const contratantesAtivos = new Set<string>();
    const contratantesComHist = new Set<string>();
    const casasAtivas = new Set<string>();
    const casasComHist = new Set<string>();
    const cidadesAtivas = new Set<string>();
    const cidadesComHist = new Set<string>();

    const marcar = (
      artistaId: string | null | undefined,
      contId: string | null | undefined,
      casaId: string | null | undefined,
      cidadeId: string | null | undefined
    ) => {
      // Ignora registros de DJs deletados/inexistentes — o contato passa
      // a se comportar como manual.
      if (!artistaId || !djsAtivosSet.has(artistaId)) return;
      const artistaOk = artistaSet.has(artistaId);
      if (contId) {
        contratantesComHist.add(contId);
        if (artistaOk) contratantesAtivos.add(contId);
      }
      if (casaId) {
        casasComHist.add(casaId);
        if (artistaOk) casasAtivas.add(casaId);
      }
      if (cidadeId) {
        cidadesComHist.add(cidadeId);
        if (artistaOk) cidadesAtivas.add(cidadeId);
      }
    };

    for (const s of shows) marcar(s.artistaId, s.contratanteId, s.casaId ?? null, s.cidadeId);
    for (const o of orcamentos) marcar(o.artistaId, o.contratanteId, o.casaId ?? null, o.cidadeId);
    for (const v of vendas) marcar(v.artistaId, v.contratanteId, v.casaId ?? null, v.cidadeId);

    return {
      contratantesAtivos,
      contratantesComHist,
      casasAtivas,
      casasComHist,
      cidadesAtivas,
      cidadesComHist,
    };
  }, [shows, orcamentos, vendas, selectedArtistas, artistasAtivos]);

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
    const base = contratantes.filter(
      (c) =>
        passaFiltroDj(c.id, filtrosPorDj.contratantesAtivos, filtrosPorDj.contratantesComHist) &&
        dataNoMes(c.criadoEm, periodo)
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
  }, [contratantes, search, cidades, filtrosPorDj, periodo]);

  const casasFiltradas = useMemo(() => {
    const base = casas.filter(
      (c) =>
        passaFiltroDj(c.id, filtrosPorDj.casasAtivas, filtrosPorDj.casasComHist) &&
        dataNoMes(c.criadoEm, periodo)
    );
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        getCidadeNome(c.cidadeId, cidades).toLowerCase().includes(q) ||
        TIPO_CASA_LABEL[c.tipo]?.toLowerCase().includes(q)
    );
  }, [casas, search, cidades, filtrosPorDj, periodo]);

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

  // Bloqueados: contratantes + casas bloqueados (respeitando o filtro por DJ e
  // a busca). Cidades não têm bloqueio.
  const contratantesBloqueados = useMemo(
    () =>
      contratantes.filter(
        (c) =>
          c.bloqueado &&
          passaFiltroDj(c.id, filtrosPorDj.contratantesAtivos, filtrosPorDj.contratantesComHist) &&
          (!search.trim() || c.nome.toLowerCase().includes(search.toLowerCase()))
      ),
    [contratantes, filtrosPorDj, search]
  );
  const casasBloqueadas = useMemo(
    () =>
      casas.filter(
        (c) =>
          c.bloqueado &&
          passaFiltroDj(c.id, filtrosPorDj.casasAtivas, filtrosPorDj.casasComHist) &&
          (!search.trim() || c.nome.toLowerCase().includes(search.toLowerCase()))
      ),
    [casas, filtrosPorDj, search]
  );
  const totalBloqueados = contratantesBloqueados.length + casasBloqueadas.length;

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
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <DateRangeSelector
              options={ATALHOS_CONTATOS}
              value={range}
              onChange={setRange}
              selectedCustomMonth={customMonth}
              setSelectedCustomMonth={setCustomMonth}
              selectedCustomYear={customYear}
              setSelectedCustomYear={setCustomYear}
              accountCreatedAt={workspaceCriadoEm}
            />
            {categoria !== "bloqueados" && (
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
            )}
          </div>
        }
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
          icon={<Ban size={16} />}
          label={t("Bloqueados")}
          value={totalBloqueados}
          active={categoria === "bloqueados"}
          accent="var(--danger)"
          onClick={() => setCategoria("bloqueados")}
        />
      </div>

      {/* Busca */}
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

      {/* Tabela conforme categoria */}
      <div className="card p-0 overflow-hidden">
        {categoria === "contratantes" && (
          <TabelaContratantes
            items={contratantesFiltrados}
            nomePorUsuario={nomePorUsuario}
            onSelect={(item) => setSelecionado({ tipo: "contratante", item })}
            onEdit={(item) => setModal({ type: "edit-contratante", item })}
            onRemove={(id) => {
              if (confirm(t("Remover este contratante?"))) removeContratante(id);
            }}
            onBloquear={(item) => abrirBloqueio({ tipo: "contratante", item })}
            onDesbloquear={(item) => desbloquear({ tipo: "contratante", item })}
          />
        )}

        {categoria === "casas" && (
          <TabelaCasas
            items={casasFiltradas}
            nomePorUsuario={nomePorUsuario}
            onSelect={(item) => setSelecionado({ tipo: "casa", item })}
            onEdit={(item) => setModal({ type: "edit-casa", item })}
            onRemove={(id) => {
              if (confirm(t("Remover esta casa?"))) removeCasa(id);
            }}
            onBloquear={(item) => abrirBloqueio({ tipo: "casa", item })}
            onDesbloquear={(item) => desbloquear({ tipo: "casa", item })}
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

        {categoria === "bloqueados" && (
          <TabelaBloqueados
            contratantes={contratantesBloqueados}
            casas={casasBloqueadas}
            nomePorUsuario={nomePorUsuario}
            onSelectContratante={(item) => setSelecionado({ tipo: "contratante", item })}
            onSelectCasa={(item) => setSelecionado({ tipo: "casa", item })}
            onDesbloquearContratante={(item) => desbloquear({ tipo: "contratante", item })}
            onDesbloquearCasa={(item) => desbloquear({ tipo: "casa", item })}
          />
        )}
      </div>

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
        subtitle={t("Cliente que contrata os artistas da agência")}
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

      {/* Modal de bloqueio — pede o motivo ao bloquear um contratante/casa */}
      <Modal
        isOpen={bloquear !== null}
        onClose={() => setBloquear(null)}
        title={t("Bloquear contato")}
        subtitle={bloquear?.item.nome}
        maxWidth={480}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-border bg-elevated p-3">
            <Ban size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-secondary">
              {t(
                "Bloquear sinaliza que este contato é problemático. Ele continua visível para a equipe, com um selo de bloqueio."
              )}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="stat-label">{t("Motivo (opcional)")}</span>
            <textarea
              value={motivoBloqueio}
              onChange={(e) => setMotivoBloqueio(e.target.value)}
              rows={3}
              placeholder={t("Ex.: calote, comportamento abusivo...")}
              className="input resize-none"
            />
          </label>
          <div className="flex items-center justify-end gap-2 mt-1">
            <button onClick={() => setBloquear(null)} className="btn btn-ghost">
              {t("Cancelar")}
            </button>
            <button
              onClick={confirmarBloqueio}
              disabled={salvandoBloqueio}
              className="btn text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--danger)" }}
            >
              <Ban size={14} />
              {salvandoBloqueio ? t("Bloqueando...") : t("Bloquear")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Selo de bloqueio: motivo + quem bloqueou + quando. Reutilizado nas tabelas. */
function SeloBloqueado({
  motivo,
  por,
  em,
  nomePorUsuario,
}: {
  motivo?: string;
  por?: string;
  em?: string;
  nomePorUsuario: Map<string, string>;
}) {
  const t = useT();
  const quem = por ? nomePorUsuario.get(por) : undefined;
  const data = em
    ? new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : undefined;
  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className="badge badge-danger inline-flex items-center gap-1 w-fit">
        <Ban size={11} />
        {t("Bloqueado")}
      </span>
      {motivo && <span className="text-xs text-secondary max-w-[240px]">{motivo}</span>}
      {(quem || data) && (
        <span className="text-xs text-muted">
          {quem ? t("por {nome}", { nome: quem }) : t("por um administrador")}
          {data ? ` · ${data}` : ""}
        </span>
      )}
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
  nomePorUsuario,
  onSelect,
  onEdit,
  onRemove,
  onBloquear,
  onDesbloquear,
}: {
  items: Contratante[];
  nomePorUsuario: Map<string, string>;
  onSelect: (c: Contratante) => void;
  onEdit: (c: Contratante) => void;
  onRemove: (id: string) => void;
  onBloquear: (c: Contratante) => void;
  onDesbloquear: (c: Contratante) => void;
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
                <Td className="font-medium text-primary">
                  <div className="flex flex-col gap-1">
                    <span>{c.nome}</span>
                    {c.bloqueado && (
                      <SeloBloqueado
                        motivo={c.bloqueadoMotivo}
                        por={c.bloqueadoPor}
                        em={c.bloqueadoEm}
                        nomePorUsuario={nomePorUsuario}
                      />
                    )}
                  </div>
                </Td>
                <Td className="text-secondary">{getCidadeNome(c.cidadeId, cidades)}</Td>
                <Td className="text-secondary">
                  <div className="text-xs">{c.email || <span className="text-muted italic">{t("sem e-mail")}</span>}</div>
                  <div className="text-xs text-muted">{c.telefone}</div>
                </Td>
                <Td className="text-right tabular-nums font-semibold">{stats.totalOrcamentos}</Td>
                <Td className="text-right tabular-nums">{stats.totalShows}</Td>
                <Td>
                  <RowActions
                    onEdit={() => onEdit(c)}
                    onRemove={() => onRemove(c.id)}
                    bloqueado={c.bloqueado}
                    onBloquear={() => onBloquear(c)}
                    onDesbloquear={() => onDesbloquear(c)}
                  />
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
  nomePorUsuario,
  onSelect,
  onEdit,
  onRemove,
  onBloquear,
  onDesbloquear,
}: {
  items: Casa[];
  nomePorUsuario: Map<string, string>;
  onSelect: (c: Casa) => void;
  onEdit: (c: Casa) => void;
  onRemove: (id: string) => void;
  onBloquear: (c: Casa) => void;
  onDesbloquear: (c: Casa) => void;
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
                <Td className="font-medium text-primary">
                  <div className="flex flex-col gap-1">
                    <span>{c.nome}</span>
                    {c.bloqueado && (
                      <SeloBloqueado
                        motivo={c.bloqueadoMotivo}
                        por={c.bloqueadoPor}
                        em={c.bloqueadoEm}
                        nomePorUsuario={nomePorUsuario}
                      />
                    )}
                  </div>
                </Td>
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
                  <RowActions
                    onEdit={() => onEdit(c)}
                    onRemove={() => onRemove(c.id)}
                    bloqueado={c.bloqueado}
                    onBloquear={() => onBloquear(c)}
                    onDesbloquear={() => onDesbloquear(c)}
                  />
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
  const { casas } = useContatos();
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
            <Th>{t("Top artista")}</Th>
            <Th className="w-[1%]"></Th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const stats = getCidadeStats(c.id, shows, casas);
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
                  {stats.topArtista ? (
                    <span>
                      {stats.topArtista.nome}{" "}
                      <span className="text-muted">({stats.topArtista.shows})</span>
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

// ---------- Bloqueados (contratantes + casas) ----------

function TabelaBloqueados({
  contratantes,
  casas,
  nomePorUsuario,
  onSelectContratante,
  onSelectCasa,
  onDesbloquearContratante,
  onDesbloquearCasa,
}: {
  contratantes: Contratante[];
  casas: Casa[];
  nomePorUsuario: Map<string, string>;
  onSelectContratante: (c: Contratante) => void;
  onSelectCasa: (c: Casa) => void;
  onDesbloquearContratante: (c: Contratante) => void;
  onDesbloquearCasa: (c: Casa) => void;
}) {
  const t = useT();
  const { cidades } = useContatos();
  if (contratantes.length === 0 && casas.length === 0)
    return <EmptyTable label={t("Nenhum contato bloqueado")} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/40">
            <Th>{t("Nome")}</Th>
            <Th>{t("Tipo")}</Th>
            <Th>{t("Cidade")}</Th>
            <Th>{t("Bloqueio")}</Th>
            <Th className="w-[1%]"></Th>
          </tr>
        </thead>
        <tbody>
          {contratantes.map((c) => (
            <tr
              key={`ct-${c.id}`}
              onClick={() => onSelectContratante(c)}
              className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
            >
              <Td className="font-medium text-primary">{c.nome}</Td>
              <Td>
                <span className="badge badge-neutral">{t("Contratante")}</span>
              </Td>
              <Td className="text-secondary">{getCidadeNome(c.cidadeId, cidades)}</Td>
              <Td>
                <SeloBloqueado
                  motivo={c.bloqueadoMotivo}
                  por={c.bloqueadoPor}
                  em={c.bloqueadoEm}
                  nomePorUsuario={nomePorUsuario}
                />
              </Td>
              <Td>
                <div
                  className="flex items-center justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onDesbloquearContratante(c)}
                    className="btn-ghost p-1.5 rounded hover:text-success"
                    aria-label={t("Desbloquear")}
                    title={t("Desbloquear")}
                  >
                    <ShieldCheck size={14} />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
          {casas.map((c) => (
            <tr
              key={`ca-${c.id}`}
              onClick={() => onSelectCasa(c)}
              className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
            >
              <Td className="font-medium text-primary">{c.nome}</Td>
              <Td>
                <span className="badge badge-neutral">{t("Casa / Evento")}</span>
              </Td>
              <Td className="text-secondary">{getCidadeNome(c.cidadeId, cidades)}</Td>
              <Td>
                <SeloBloqueado
                  motivo={c.bloqueadoMotivo}
                  por={c.bloqueadoPor}
                  em={c.bloqueadoEm}
                  nomePorUsuario={nomePorUsuario}
                />
              </Td>
              <Td>
                <div
                  className="flex items-center justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onDesbloquearCasa(c)}
                    className="btn-ghost p-1.5 rounded hover:text-success"
                    aria-label={t("Desbloquear")}
                    title={t("Desbloquear")}
                  >
                    <ShieldCheck size={14} />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
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

function RowActions({
  onEdit,
  onRemove,
  bloqueado,
  onBloquear,
  onDesbloquear,
}: {
  onEdit: () => void;
  onRemove: () => void;
  /** Só contratantes/casas passam estas props (cidades não têm bloqueio). */
  bloqueado?: boolean;
  onBloquear?: () => void;
  onDesbloquear?: () => void;
}) {
  const t = useT();
  const temBloqueio = onBloquear !== undefined && onDesbloquear !== undefined;
  return (
    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
      {temBloqueio &&
        (bloqueado ? (
          <button
            onClick={onDesbloquear}
            className="btn-ghost p-1.5 rounded hover:text-success"
            aria-label={t("Desbloquear")}
            title={t("Desbloquear")}
          >
            <ShieldCheck size={14} />
          </button>
        ) : (
          <button
            onClick={onBloquear}
            className="btn-ghost p-1.5 rounded hover:text-danger"
            aria-label={t("Bloquear")}
            title={t("Bloquear")}
          >
            <Ban size={14} />
          </button>
        ))}
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
