"use client";

import { useEffect, useMemo, useState } from "react";
import { resolverMes } from "@/lib/periodo";
import { useT } from "@/lib/i18n";
import { Plus, Search, Users, Building2, MapPin, Pencil, Trash2, ChevronRight, Ban, ShieldCheck } from "lucide-react";
import PageHeader from "./PageHeader";
import DateRangeSelector from "./DateRangeSelector";
import Modal from "./Modal";
import ContratanteForm from "./forms/ContratanteForm";
import CasaForm from "./forms/CasaForm";
import CidadeForm from "./forms/CidadeForm";
import ContatoDetail from "./ContatoDetail";
import TabelaDados, { type Coluna } from "./lista/TabelaDados";
import { useContatosFiltrados } from "@/lib/useContatosFiltrados";
import MiniLixeira from "./MiniLixeira";
import { useConfirmar } from "./ConfirmarModal";
import { useContatos } from "@/lib/contatos-context";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { getContratanteStats, getCasaStats, getCidadeStats, getCidadeNome, formatarFaturamento } from "@/lib/contatos-stats";
import { MODULE_THEMES, LABELS_TIPO_CASA } from "@/types";
import type { ContatoCategoria, Contratante, Casa, Cidade, AgendaDateRange, TipoCasa } from "@/types";

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

const ATALHOS_CONTATOS: AgendaDateRange[] = ["Visão geral", "Mês anterior", "Mês atual", "Próximo mês", "Personalizado"];

/** Casa a data de cadastro (ISO) no período. Sem data de cadastro → SEMPRE visível
 *  (registro legado não some do Gerenciar por causa do filtro de período). */
function dataNoMes(dataISO: string | undefined, p: { ano: number; mes: number; tudo: boolean }): boolean {
  if (p.tudo) return true;
  if (!dataISO) return true;
  const d = dataISO.length <= 10 ? new Date(`${dataISO}T12:00:00`) : new Date(dataISO);
  return d.getFullYear() === p.ano && d.getMonth() === p.mes;
}

export default function Contatos({
  aba = "contratantes",
  contatoId = null,
  abrirNovo = false,
  onAbrirAba,
  onAbrirContato,
  onVoltarDaFicha,
  selectedArtistas = [],
  onAbrirShow,
}: {
  /** Aba ativa — vem do ENDEREÇO (/app/contatos/lista/<aba>). */
  aba?: Aba;
  /** Ficha aberta — vem do endereço (/app/contatos/lista/<categoria>/<id>). */
  contatoId?: string | null;
  /** Chegou pelo atalho "Novo contratante/casa/cidade" (?novo=1): abre o formulário. */
  abrirNovo?: boolean;
  onAbrirAba: (aba: Aba) => void;
  onAbrirContato: (categoria: ContatoCategoria, id: string) => void;
  onVoltarDaFicha: () => void;
  selectedArtistas?: string[];
  /** Abre o modal global de detalhe do show (ShowDetalheModal, em
   *  layout.tsx). Repassado ao ContatoDetail — histórico de shows clicável. */
  onAbrirShow?: (id: string) => void;
}) {
  const t = useT();
  const accent = MODULE_THEMES.contatos.color;
  const { confirmar, confirmador } = useConfirmar();
  const {
    contratantes,
    casas,
    cidades,
    removeContratante,
    removeCasa,
    removeCidade,
    updateContratante,
    updateCasa,
    carregado: contatosCarregados,
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

  // Aba e ficha moram no ENDEREÇO: F5, voltar do navegador e link
  // compartilhado caem no mesmo lugar.
  const categoria = aba;
  const [search, setSearch] = useState("");
  // J1 — filtro por tipo (só casas)/cidade/estado no Gerenciar Contatos.
  // Vazio = "" em todos → não esconde nada por padrão (mesma regra do
  // período/busca; ver lição no comentário I11 abaixo).
  const [filtroTipo, setFiltroTipo] = useState<TipoCasa | "">("");
  const [filtroCidadeId, setFiltroCidadeId] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const { workspaceCriadoEm } = useWorkspace();
  const [range, setRange] = useState<AgendaDateRange>("Visão geral");
  const [customMonth, setCustomMonth] = useState<string | null>(null);
  const [customYear, setCustomYear] = useState<number | null>(null);
  const periodo = useMemo(
    () => resolverMes(range, customMonth, customYear),
    [range, customMonth, customYear]
  );
  const selecionado: Selecionado = useMemo(() => {
    if (!contatoId) return null;
    if (categoria === "contratantes") {
      const item = contratantes.find((c) => c.id === contatoId);
      return item ? { tipo: "contratante", item } : null;
    }
    if (categoria === "casas") {
      const item = casas.find((c) => c.id === contatoId);
      return item ? { tipo: "casa", item } : null;
    }
    if (categoria === "cidades") {
      const item = cidades.find((c) => c.id === contatoId);
      return item ? { tipo: "cidade", item } : null;
    }
    return null;
  }, [contatoId, categoria, contratantes, casas, cidades]);
  const [modal, setModal] = useState<
    | { type: "novo-contratante" }
    | { type: "edit-contratante"; item: Contratante }
    | { type: "novo-casa" }
    | { type: "edit-casa"; item: Casa }
    | { type: "novo-cidade" }
    | { type: "edit-cidade"; item: Cidade }
    | null
  >(null);
  // Atalho "Novo …" do dashboard: abre o formulário e tira o ?novo=1 do
  // endereço (substituindo) — senão um F5 reabriria o cadastro.
  useEffect(() => {
    if (!abrirNovo || contatoId) return;
    if (categoria === "contratantes") setModal({ type: "novo-contratante" });
    else if (categoria === "casas") setModal({ type: "novo-casa" });
    else if (categoria === "cidades") setModal({ type: "novo-cidade" });
    onAbrirAba(categoria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirNovo]);

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

  // cidadeId → estado (UF). Contratante/Casa não têm UF própria; o filtro
  // por estado resolve pela cidade vinculada.
  const estadoPorCidadeId = useMemo(() => {
    const m = new Map<string, string>();
    for (const cid of cidades) m.set(cid.id, cid.estado);
    return m;
  }, [cidades]);

  /** Algum filtro de tipo/cidade/estado ligado? (a busca e o período têm
   *  controles próprios, sempre visíveis, e não entram aqui). */
  const temFiltroAtivo = !!(filtroTipo || filtroCidadeId || filtroEstado);
  const limparFiltros = () => {
    setFiltroTipo("");
    setFiltroCidadeId("");
    setFiltroEstado("");
  };

  // Estados distintos presentes nas cidades cadastradas, pro select de UF.
  const estadosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const cid of cidades) if (cid.estado) set.add(cid.estado);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cidades]);

  // Filtro "Artistas" da barra lateral (decisão do dono, 20/10/2026: vale
  // aqui também). Contato herda os artistas do histórico; SEM histórico
  // aparece sempre — o contratante recém-criado nunca "some" (lição do I11),
  // e a faixa "Mostrando N de M artistas" no topo explica o que está oculto.
  // A ficha aberta por endereço usa as listas COMPLETAS (link de contato de
  // artista desmarcado abre do mesmo jeito); as listas da tela, as filtradas.
  const visiveis = useContatosFiltrados();

  // Filtros aplicados conforme aba
  const contratantesFiltrados = useMemo(() => {
    let base = visiveis.contratantes.filter((c) => dataNoMes(c.criadoEm, periodo));
    // J1 — filtro vazio ("") não filtra nada, nunca esconde por padrão.
    if (filtroCidadeId) base = base.filter((c) => c.cidadeId === filtroCidadeId);
    if (filtroEstado) base = base.filter((c) => estadoPorCidadeId.get(c.cidadeId ?? "") === filtroEstado);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        getCidadeNome(c.cidadeId, cidades).toLowerCase().includes(q)
    );
  }, [visiveis.contratantes, search, cidades, periodo, filtroCidadeId, filtroEstado, estadoPorCidadeId]);

  const casasFiltradas = useMemo(() => {
    let base = visiveis.casas.filter((c) => dataNoMes(c.criadoEm, periodo));
    // J1 — tipo/cidade/estado; "" = sem filtro (mostra tudo).
    if (filtroTipo) base = base.filter((c) => c.tipo === filtroTipo);
    if (filtroCidadeId) base = base.filter((c) => c.cidadeId === filtroCidadeId);
    if (filtroEstado) base = base.filter((c) => estadoPorCidadeId.get(c.cidadeId ?? "") === filtroEstado);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        getCidadeNome(c.cidadeId, cidades).toLowerCase().includes(q) ||
        LABELS_TIPO_CASA[c.tipo]?.toLowerCase().includes(q)
    );
  }, [visiveis.casas, search, cidades, periodo, filtroTipo, filtroCidadeId, filtroEstado, estadoPorCidadeId]);

  const cidadesFiltradas = useMemo(() => {
    // I11 — cadastro mostra tudo; só a busca filtra (cidade ignora período).
    // J1 — cidade/estado do filtro não se aplicam aqui: a aba já É a lista
    // de cidades (o próprio nome/UF já é filtrável pela busca acima).
    const base = visiveis.cidades;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.estado.toLowerCase().includes(q)
    );
  }, [visiveis.cidades, search]);

  // Bloqueados: contratantes + casas bloqueados (respeitando a busca).
  // Cidades não têm bloqueio.
  const contratantesBloqueados = useMemo(
    () =>
      visiveis.contratantes.filter(
        (c) =>
          c.bloqueado &&
          (!search.trim() || c.nome.toLowerCase().includes(search.toLowerCase()))
      ),
    [visiveis.contratantes, search]
  );
  const casasBloqueadas = useMemo(
    () =>
      visiveis.casas.filter(
        (c) =>
          c.bloqueado &&
          (!search.trim() || c.nome.toLowerCase().includes(search.toLowerCase()))
      ),
    [visiveis.casas, search]
  );
  const totalBloqueados = contratantesBloqueados.length + casasBloqueadas.length;

  // Modais (form de contratante/casa/cidade, bloqueio, confirmação) valem
  // nos DOIS ramos: o "Editar" de dentro da ficha abria o form num ramo que
  // não estava montado — o clique não fazia nada até voltar pra lista.
  const modais = (
    <>
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
              className="btn btn-danger"
            >
              <Ban size={14} />
              {salvandoBloqueio ? t("Bloqueando...") : t("Bloquear")}
            </button>
          </div>
        </div>
      </Modal>
      {confirmador}
    </>
  );

  // Tela de detalhe quando algo selecionado
  if (contatoId && !selecionado) {
    return (
      <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
        <div className="card text-center py-12">
          <div className="section-title mb-3">
            {!contatosCarregados ? t("Carregando...") : t("Contato não encontrado")}
          </div>
          {contatosCarregados && (
            <button onClick={onVoltarDaFicha} className="btn btn-secondary">
              {t("Voltar")}
            </button>
          )}
        </div>
      </div>
    );
  }
  if (selecionado) {
    return (
      <>
      <ContatoDetail
        selecionado={selecionado}
        onBack={onVoltarDaFicha}
        onEdit={() => {
          if (selecionado.tipo === "contratante")
            setModal({ type: "edit-contratante", item: selecionado.item });
          else if (selecionado.tipo === "casa")
            setModal({ type: "edit-casa", item: selecionado.item });
          else setModal({ type: "edit-cidade", item: selecionado.item });
        }}
        onAbrirShow={onAbrirShow}
      />
      {modais}
      </>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Todos os contatos"
        subtitle="Contratantes, casas/eventos e cidades — sua base de relacionamento"
        accentColor={accent}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
                className="btn btn-primary w-full sm:w-auto justify-center"
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
          onClick={() => onAbrirAba("contratantes")}
        />
        <SummaryTile
          icon={<Building2 size={16} />}
          label={t("Casas / Eventos")}
          value={casasFiltradas.length}
          active={categoria === "casas"}
          accent={accent}
          onClick={() => onAbrirAba("casas")}
        />
        <SummaryTile
          icon={<MapPin size={16} />}
          label={t("Cidades")}
          value={cidadesFiltradas.length}
          active={categoria === "cidades"}
          accent={accent}
          onClick={() => onAbrirAba("cidades")}
        />
        <SummaryTile
          icon={<Ban size={16} />}
          label={t("Bloqueados")}
          value={totalBloqueados}
          active={categoria === "bloqueados"}
          accent="var(--danger)"
          onClick={() => onAbrirAba("bloqueados")}
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

      {/* J1 — filtro por tipo (só casas) / cidade / estado. Só faz sentido
          nas abas que têm cidade vinculada (contratantes e casas); cidades
          e bloqueados não ganham a barra. Vazio = tudo (nunca esconde por padrão). */}
      {(categoria === "contratantes" || categoria === "casas") && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {categoria === "casas" && (
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoCasa | "")}
              className="campo-input w-auto min-w-[140px] flex-1 sm:flex-none"
            >
              <option value="">{t("Todos os tipos")}</option>
              {(Object.keys(LABELS_TIPO_CASA) as TipoCasa[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {t(LABELS_TIPO_CASA[tipo])}
                </option>
              ))}
            </select>
          )}
          <select
            value={filtroCidadeId}
            onChange={(e) => setFiltroCidadeId(e.target.value)}
            className="campo-input w-auto min-w-[160px] flex-1 sm:flex-none"
          >
            <option value="">{t("Todas as cidades")}</option>
            {cidades
              .slice()
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
              .map((cid) => (
                <option key={cid.id} value={cid.id}>
                  {cid.nome} — {cid.estado}
                </option>
              ))}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="campo-input w-auto min-w-[120px] flex-1 sm:flex-none"
          >
            <option value="">{t("Todos os estados")}</option>
            {estadosDisponiveis.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              className="text-muted hover:text-primary text-xs whitespace-nowrap"
            >
              {t("Limpar filtros")}
            </button>
          )}
        </div>
      )}

      {/* Abas SEM a barra (Cidades / Bloqueados): os cards de resumo do topo
          continuam contando contratantes e casas COM o filtro aplicado, então
          o filtro não pode ficar invisível — senão parece que o cadastro
          encolheu sozinho (a lição do filtro que "some" com registro). Mostra
          o que está ativo e como limpar, sem precisar voltar de aba. */}
      {categoria !== "contratantes" && categoria !== "casas" && temFiltroAtivo && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-muted">{t("Filtros ativos:")}</span>
          {filtroTipo && (
            <span className="badge badge-neutral">{t(LABELS_TIPO_CASA[filtroTipo])}</span>
          )}
          {filtroCidadeId && (
            <span className="badge badge-neutral">
              {getCidadeNome(filtroCidadeId, cidades)}
            </span>
          )}
          {filtroEstado && <span className="badge badge-neutral">{filtroEstado}</span>}
          <button
            onClick={limparFiltros}
            className="text-muted hover:text-primary text-xs whitespace-nowrap"
          >
            {t("Limpar filtros")}
          </button>
        </div>
      )}

      {/* Tabela conforme categoria */}
      <div className="card p-0 overflow-hidden">
        {categoria === "contratantes" && (
          <TabelaContratantes
            items={contratantesFiltrados}
            nomePorUsuario={nomePorUsuario}
            onSelect={(item) => onAbrirContato("contratantes", item.id)}
            onEdit={(item) => setModal({ type: "edit-contratante", item })}
            onRemove={async (id) => {
              if (await confirmar({ titulo: t("Remover este contratante?"), perigo: true })) {
                removeContratante(id);
              }
            }}
            onBloquear={(item) => abrirBloqueio({ tipo: "contratante", item })}
            onDesbloquear={(item) => desbloquear({ tipo: "contratante", item })}
          />
        )}

        {categoria === "casas" && (
          <TabelaCasas
            items={casasFiltradas}
            nomePorUsuario={nomePorUsuario}
            onSelect={(item) => onAbrirContato("casas", item.id)}
            onEdit={(item) => setModal({ type: "edit-casa", item })}
            onRemove={async (id) => {
              if (await confirmar({ titulo: t("Remover esta casa?"), perigo: true })) {
                removeCasa(id);
              }
            }}
            onBloquear={(item) => abrirBloqueio({ tipo: "casa", item })}
            onDesbloquear={(item) => desbloquear({ tipo: "casa", item })}
          />
        )}

        {categoria === "cidades" && (
          <TabelaCidades
            items={cidadesFiltradas}
            onSelect={(item) => onAbrirContato("cidades", item.id)}
            onEdit={(item) => setModal({ type: "edit-cidade", item })}
            onRemove={async (id) => {
              if (await confirmar({ titulo: t("Remover esta cidade?"), perigo: true })) {
                removeCidade(id);
              }
            }}
          />
        )}

        {categoria === "bloqueados" && (
          <TabelaBloqueados
            contratantes={contratantesBloqueados}
            casas={casasBloqueadas}
            nomePorUsuario={nomePorUsuario}
            onSelectContratante={(item) => onAbrirContato("contratantes", item.id)}
            onSelectCasa={(item) => onAbrirContato("casas", item.id)}
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

      {modais}
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

// ---------- Tabelas (lista padrão: ordenar, paginar, cartão no celular) ----------

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

  const stats = (c: Contratante) => getContratanteStats(c.id, shows, orcamentos);
  const colunas: Coluna<Contratante>[] = [
    {
      chave: "nome",
      titulo: "Nome",
      classe: "font-medium text-primary",
      ordenarPor: (c) => c.nome,
      celula: (c) => (
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
      ),
    },
    {
      chave: "cidade",
      titulo: "Cidade",
      classe: "text-secondary",
      ordenarPor: (c) => getCidadeNome(c.cidadeId, cidades),
      celula: (c) => getCidadeNome(c.cidadeId, cidades),
    },
    {
      chave: "contato",
      titulo: "Contato",
      classe: "text-secondary",
      celula: (c) => (
        <>
          <div className="text-xs">{c.email || <span className="text-muted italic">{t("sem e-mail")}</span>}</div>
          <div className="text-xs text-muted">{c.telefone}</div>
        </>
      ),
    },
    {
      chave: "orcamentos",
      titulo: "Orçamentos",
      alinhar: "direita",
      classe: "tabular-nums font-semibold",
      decrescentePrimeiro: true,
      ordenarPor: (c) => stats(c).totalOrcamentos,
      celula: (c) => stats(c).totalOrcamentos,
    },
    {
      chave: "shows",
      titulo: "Shows",
      alinhar: "direita",
      classe: "tabular-nums",
      decrescentePrimeiro: true,
      ordenarPor: (c) => stats(c).totalShows,
      celula: (c) => stats(c).totalShows,
    },
  ];

  return (
    <TabelaDados
      itens={items}
      colunas={colunas}
      chaveDe={(c) => c.id}
      onAbrir={onSelect}
      rotuloItens="contratantes"
      acoes={(c) => (
        <RowActions
          onEdit={() => onEdit(c)}
          onRemove={() => onRemove(c.id)}
          bloqueado={c.bloqueado}
          onBloquear={() => onBloquear(c)}
          onDesbloquear={() => onDesbloquear(c)}
        />
      )}
    />
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
  const { vendas } = useVendas();
  if (items.length === 0) return <EmptyTable label={t("Nenhuma casa encontrada")} />;

  const stats = (c: Casa) => getCasaStats(c.id, shows, vendas);
  const colunas: Coluna<Casa>[] = [
    {
      chave: "nome",
      titulo: "Nome",
      classe: "font-medium text-primary",
      ordenarPor: (c) => c.nome,
      celula: (c) => (
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
      ),
    },
    {
      chave: "tipo",
      titulo: "Tipo",
      ordenarPor: (c) => t(LABELS_TIPO_CASA[c.tipo] ?? c.tipo),
      celula: (c) => <span className="badge badge-neutral">{t(LABELS_TIPO_CASA[c.tipo] ?? c.tipo)}</span>,
    },
    {
      chave: "cidade",
      titulo: "Cidade",
      classe: "text-secondary",
      ordenarPor: (c) => getCidadeNome(c.cidadeId, cidades),
      celula: (c) => getCidadeNome(c.cidadeId, cidades),
    },
    {
      chave: "capacidade",
      titulo: "Capacidade",
      alinhar: "direita",
      classe: "tabular-nums",
      decrescentePrimeiro: true,
      ordenarPor: (c) => c.capacidade ?? null,
      celula: (c) => (c.capacidade ? c.capacidade.toLocaleString("pt-BR") : "—"),
    },
    {
      chave: "shows",
      titulo: "Shows",
      alinhar: "direita",
      classe: "tabular-nums",
      decrescentePrimeiro: true,
      ordenarPor: (c) => stats(c).totalShows,
      celula: (c) => stats(c).totalShows,
    },
    {
      chave: "faturado",
      titulo: "Faturado",
      alinhar: "direita",
      classe: "tabular-nums font-semibold",
      decrescentePrimeiro: true,
      ordenarPor: (c) => stats(c).faturamento,
      celula: (c) => {
        const st = stats(c);
        return st.faturamento > 0 ? formatarFaturamento(st.faturamentoPorMoeda) : "—";
      },
    },
  ];

  return (
    <TabelaDados
      itens={items}
      colunas={colunas}
      chaveDe={(c) => c.id}
      onAbrir={onSelect}
      rotuloItens="casas"
      acoes={(c) => (
        <RowActions
          onEdit={() => onEdit(c)}
          onRemove={() => onRemove(c.id)}
          bloqueado={c.bloqueado}
          onBloquear={() => onBloquear(c)}
          onDesbloquear={() => onDesbloquear(c)}
        />
      )}
    />
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
  const { vendas } = useVendas();
  if (items.length === 0) return <EmptyTable label={t("Nenhuma cidade encontrada")} />;

  const stats = (c: Cidade) => getCidadeStats(c.id, shows, casas, vendas);
  const colunas: Coluna<Cidade>[] = [
    { chave: "cidade", titulo: "Cidade", classe: "font-medium text-primary", ordenarPor: (c) => c.nome, celula: (c) => c.nome },
    { chave: "uf", titulo: "UF", classe: "text-secondary", ordenarPor: (c) => c.estado, celula: (c) => c.estado },
    { chave: "regiao", titulo: "Região", classe: "text-secondary", ordenarPor: (c) => c.regiao, celula: (c) => c.regiao },
    {
      chave: "casas",
      titulo: "Casas",
      alinhar: "direita",
      classe: "tabular-nums",
      decrescentePrimeiro: true,
      ordenarPor: (c) => stats(c).totalCasas,
      celula: (c) => stats(c).totalCasas,
    },
    {
      chave: "shows",
      titulo: "Shows",
      alinhar: "direita",
      classe: "tabular-nums",
      decrescentePrimeiro: true,
      ordenarPor: (c) => stats(c).totalShows,
      celula: (c) => stats(c).totalShows,
    },
    {
      chave: "faturado",
      titulo: "Faturado",
      alinhar: "direita",
      classe: "tabular-nums font-semibold",
      decrescentePrimeiro: true,
      ordenarPor: (c) => stats(c).faturamento,
      celula: (c) => {
        const st = stats(c);
        return st.faturamento > 0 ? formatarFaturamento(st.faturamentoPorMoeda) : "—";
      },
    },
    {
      chave: "top",
      titulo: "Top artista",
      classe: "text-secondary",
      celula: (c) => {
        const top = stats(c).topArtista;
        return top ? (
          <span>
            {top.nome} <span className="text-muted">({top.shows})</span>
          </span>
        ) : (
          "—"
        );
      },
    },
  ];

  return (
    <TabelaDados
      itens={items}
      colunas={colunas}
      chaveDe={(c) => c.id}
      onAbrir={onSelect}
      rotuloItens="cidades"
      acoes={(c) => <RowActions onEdit={() => onEdit(c)} onRemove={() => onRemove(c.id)} />}
    />
  );
}

// ---------- Bloqueados (contratantes + casas) ----------

type LinhaBloqueado =
  | { tipo: "contratante"; item: Contratante }
  | { tipo: "casa"; item: Casa };

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
  const linhas = useMemo<LinhaBloqueado[]>(
    () => [
      ...contratantes.map((item) => ({ tipo: "contratante" as const, item })),
      ...casas.map((item) => ({ tipo: "casa" as const, item })),
    ],
    [contratantes, casas]
  );
  if (linhas.length === 0) return <EmptyTable label={t("Nenhum contato bloqueado")} />;

  const colunas: Coluna<LinhaBloqueado>[] = [
    { chave: "nome", titulo: "Nome", classe: "font-medium text-primary", ordenarPor: (l) => l.item.nome, celula: (l) => l.item.nome },
    {
      chave: "tipo",
      titulo: "Tipo",
      ordenarPor: (l) => l.tipo,
      celula: (l) => (
        <span className="badge badge-neutral">{l.tipo === "contratante" ? t("Contratante") : t("Casa / Evento")}</span>
      ),
    },
    {
      chave: "cidade",
      titulo: "Cidade",
      classe: "text-secondary",
      ordenarPor: (l) => getCidadeNome(l.item.cidadeId, cidades),
      celula: (l) => getCidadeNome(l.item.cidadeId, cidades),
    },
    {
      chave: "bloqueio",
      titulo: "Bloqueio",
      decrescentePrimeiro: true,
      ordenarPor: (l) => l.item.bloqueadoEm ?? null,
      celula: (l) => (
        <SeloBloqueado
          motivo={l.item.bloqueadoMotivo}
          por={l.item.bloqueadoPor}
          em={l.item.bloqueadoEm}
          nomePorUsuario={nomePorUsuario}
        />
      ),
    },
  ];

  return (
    <TabelaDados
      itens={linhas}
      colunas={colunas}
      chaveDe={(l) => `${l.tipo}-${l.item.id}`}
      onAbrir={(l) => (l.tipo === "contratante" ? onSelectContratante(l.item) : onSelectCasa(l.item))}
      rotuloItens="contatos"
      acoes={(l) => (
        <button
          onClick={() =>
            l.tipo === "contratante" ? onDesbloquearContratante(l.item) : onDesbloquearCasa(l.item)
          }
          className="btn-ghost p-1.5 rounded hover:text-success"
          aria-label={t("Desbloquear")}
          title={t("Desbloquear")}
        >
          <ShieldCheck size={14} />
        </button>
      )}
    />
  );
}

// ---------- Utilitários de tabela ----------



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
