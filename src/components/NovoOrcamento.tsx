"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Save,
  Building2,
  PartyPopper,
  Sparkles,
  Copy,
  Check,
  FileText,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Stepper from "./Stepper";
import QuantitySelector from "./QuantitySelector";
import ExistenteOuNovo from "./ExistenteOuNovo";
import PhoneInput, { DEFAULT_COUNTRY, contarDigitos, type Country } from "./PhoneInput";
import CidadeIBGEAutocomplete, { type CidadeIBGE } from "./CidadeIBGEAutocomplete";
import { resolverCidadeIbge } from "@/lib/cidade-helpers";
import { Field, TextInput, TextArea, Select } from "./Field";
import { useContatos } from "@/lib/contatos-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useArtistas } from "@/lib/workspace-context";
import { gerarTextoWhatsApp, montarLinkWhatsApp, formatBRL, formatarDuracao } from "@/lib/whatsapp";
import { montarTelefoneE164 } from "@/lib/data/countries";
import {
  CATALOGO_CAMARIM,
  CATALOGO_EFEITOS,
  CATALOGO_HOTEL,
  LABELS_TIPO_EVENTO,
  LOGISTICA_VAZIA,
  MODULE_THEMES,
  type ItemQuantidade,
  type LogisticaSelecao,
  type TipoEvento,
  type DJ,
} from "@/types";
import type { ContratanteInput, CasaInput, CidadeInput } from "@/lib/orcamentos-context";

type Props = {
  onSaved: (orcamentoIds: string[]) => void;
  onCancel: () => void;
  onDone: () => void;
};

const TIPOS_EVENTO: { value: TipoEvento; label: string; icon: typeof PartyPopper; desc: string }[] = [
  { value: "social", label: "Social", icon: PartyPopper, desc: "Festa privada, aniversário, casamento" },
  { value: "casa-noturna", label: "Casa Noturna", icon: Building2, desc: "Club, bar, balada" },
  { value: "festival", label: "Festival", icon: Sparkles, desc: "Festival, arena, evento grande" },
];

type DjBlock = {
  djId: string;
  valorCache: string;
  duracaoHoras: number;
  duracaoMinutos: number;
  camarim: ItemQuantidade[];
  efeitos: ItemQuantidade[];
  hotel: ItemQuantidade[];
  logistica: LogisticaSelecao;
  /** Texto livre opcional anexado ao fim do orçamento deste DJ. */
  infoExtra: string;
};

function novoBlocoDj(djId: string): DjBlock {
  return {
    djId,
    valorCache: "",
    duracaoHoras: 1,
    duracaoMinutos: 0,
    camarim: CATALOGO_CAMARIM.map((n) => ({ nome: n, qtd: 0 })),
    efeitos: CATALOGO_EFEITOS.map((n) => ({ nome: n, qtd: 0 })),
    hotel: CATALOGO_HOTEL.map((n) => ({ nome: n, qtd: 0 })),
    logistica: { ...LOGISTICA_VAZIA },
    infoExtra: "",
  };
}

export default function NovoOrcamento({ onSaved, onCancel, onDone }: Props) {
  const accent = MODULE_THEMES.vendas.color;
  const { contratantes } = useContatos();
  const { criarOrcamentoComContatos } = useOrcamentos();
  const artistas = useArtistas();

  const [step, setStep] = useState(1);

  // ----- ETAPA 1 -----
  const [tipoEvento, setTipoEvento] = useState<TipoEvento | null>(null);
  const [contratanteMode, setContratanteMode] = useState<"existente" | "novo">("novo");
  const [contratanteId, setContratanteId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [telDigits, setTelDigits] = useState("");
  const [cidadeIbge, setCidadeIbge] = useState<CidadeIBGE | null>(null);

  // ----- ETAPA 2 -----
  const [blocos, setBlocos] = useState<DjBlock[]>([novoBlocoDj("")]);
  const [modalAddDj, setModalAddDj] = useState(false);

  // Quando a lista de artistas carregar, preenche o djId do bloco
  // inicial (era estático via DJS[0] antes; agora vem do hook).
  useEffect(() => {
    if (artistas.length === 0) return;
    setBlocos((prev) =>
      prev.length === 1 && !prev[0].djId
        ? [{ ...prev[0], djId: artistas[0].id }]
        : prev
    );
  }, [artistas]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Tela 3
  const [salvos, setSalvos] = useState<Array<{
    id: string;
    numero: string;
    djNome: string;
    djCor: string;
    telefoneE164: string;
    texto: string;
    linkWA: string;
  }> | null>(null);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!tipoEvento) errs.tipoEvento = "Selecione o tipo de evento";
    if (contratanteMode === "existente") {
      if (!contratanteId) errs.contratante = "Selecione um contratante";
    } else {
      if (!novoNome.trim()) errs.contratanteNome = "Nome obrigatório";
      const dig = contarDigitos(telDigits);
      if (dig === 0) errs.contratanteTel = "Telefone obrigatório";
      else if (dig < country.minDigits) errs.contratanteTel = "Faltam dígitos";
    }
    if (!cidadeIbge) errs.cidade = "Selecione a cidade do evento";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    blocos.forEach((b, i) => {
      if (!b.djId) errs[`dj-${i}`] = "Selecione um DJ";
      const valor = parseFloat(b.valorCache.replace(",", "."));
      if (!b.valorCache || isNaN(valor) || valor <= 0) errs[`valor-${i}`] = "Valor obrigatório";
      if (b.duracaoHoras < 1 && b.duracaoMinutos < 15) errs[`dur-${i}`] = "Duração mínima 15 min";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validateStep1()) setStep(2);
  }
  function handleBack() {
    setStep(1);
    setErrors({});
  }

  function adicionarDj(djId: string) {
    setBlocos((prev) => [...prev, novoBlocoDj(djId)]);
    setModalAddDj(false);
  }

  function removerBloco(idx: number) {
    if (blocos.length === 1) return;
    setBlocos(blocos.filter((_, i) => i !== idx));
  }

  function atualizarBloco(idx: number, patch: Partial<DjBlock>) {
    setBlocos(blocos.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function getTelefoneSelecionadoE164(): string {
    if (contratanteMode === "novo") return montarTelefoneE164(country, telDigits);
    const c = contratantes.find((x) => x.id === contratanteId);
    return c?.telefone ?? "";
  }

  // ----- Salvar todos os blocos -----
  async function handleSubmit() {
    if (!validateStep1()) { setStep(1); return; }
    if (!validateStep2()) return;
    if (!tipoEvento || !cidadeIbge) return;

    // Resolve a cidade IBGE → UUID local (cria se ainda não existe;
    // geocoda lat/lng via OSM no caminho).
    let cidadeResolvida;
    try {
      cidadeResolvida = await resolverCidadeIbge(cidadeIbge);
    } catch (e) {
      setErrors((p) => ({ ...p, cidade: (e as Error).message }));
      return;
    }

    const contratanteInputInicial: ContratanteInput =
      contratanteMode === "existente"
        ? { tipo: "existente", id: contratanteId! }
        : {
            tipo: "novo",
            dados: {
              nome: novoNome,
              telefone: montarTelefoneE164(country, telDigits),
            },
          };

    const casaInput: CasaInput = { tipo: "nenhuma" };

    const cidadeInputInicial: CidadeInput = {
      tipo: "existente",
      id: cidadeResolvida.id,
    };

    const resultados: NonNullable<typeof salvos> = [];
    let contratanteIdResolvido: string | null = null;
    let cidadeIdResolvido: string | null = null;

    // for-of sequencial — precisamos resolver contratante/cidade do bloco 0
    // antes de criar os próximos, e cada criação é async (API).
    for (let idx = 0; idx < blocos.length; idx++) {
      const b = blocos[idx];
      const valor = parseFloat(b.valorCache.replace(",", "."));

      const cInput: ContratanteInput =
        idx === 0
          ? contratanteInputInicial
          : contratanteIdResolvido
          ? { tipo: "existente", id: contratanteIdResolvido }
          : contratanteInputInicial;

      const cidInput: CidadeInput =
        idx === 0
          ? cidadeInputInicial
          : cidadeIdResolvido
          ? { tipo: "existente", id: cidadeIdResolvido }
          : cidadeInputInicial;

      const orc = await criarOrcamentoComContatos({
        tipoEvento,
        contratante: cInput,
        casa: casaInput,
        cidade: cidInput,
        djId: b.djId,
        valorCache: valor,
        duracaoHoras: b.duracaoHoras,
        duracaoMinutos: b.duracaoMinutos > 0 ? b.duracaoMinutos : undefined,
        camarim: b.camarim,
        efeitos: b.efeitos,
        hotel: b.hotel,
        logistica: b.logistica,
        infoExtra: b.infoExtra.trim() || undefined,
      });

      if (idx === 0) {
        contratanteIdResolvido = orc.contratanteId;
        cidadeIdResolvido = orc.cidadeId;
      }

      const cidadeObj = {
        id: orc.cidadeId,
        nome: cidadeResolvida.nome,
        estado: cidadeResolvida.estado,
        regiao: cidadeResolvida.regiao,
      };
      const dj = artistas.find((d) => d.id === b.djId);
      const e164 = getTelefoneSelecionadoE164();
      const texto = gerarTextoWhatsApp(orc, { cidade: cidadeObj, dj });

      resultados.push({
        id: orc.id,
        numero: orc.numero,
        djNome: dj?.name ?? "—",
        djCor: dj?.color ?? "#888",
        telefoneE164: e164,
        texto,
        linkWA: montarLinkWhatsApp(e164, texto),
      });
    }

    setSalvos(resultados);
    onSaved(resultados.map((r) => r.id));
  }

  async function handleCopiar(idx: number) {
    if (!salvos) return;
    const texto = salvos[idx].texto;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoIdx(idx);
      setTimeout(() => setCopiadoIdx(null), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiadoIdx(idx);
        setTimeout(() => setCopiadoIdx(null), 2000);
      } catch {
        alert("Não foi possível copiar.");
      }
      document.body.removeChild(ta);
    }
  }

  // ============ TELA 3 ============
  if (salvos) {
    return (
      <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
        <PageHeader
          title={salvos.length === 1 ? "Orçamento criado" : `${salvos.length} orçamentos criados`}
          subtitle={
            salvos.length === 1
              ? "Copie a mensagem ou envie pelo WhatsApp"
              : "Um orçamento por DJ — envie cada um separadamente"
          }
          accentColor={accent}
        />

        {salvos.map((s, idx) => (
          <div key={s.id} className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${s.djCor}25`, color: s.djCor }}
                >
                  <User size={14} />
                </div>
                <span className="text-sm font-semibold text-primary truncate">{s.djNome}</span>
                <span className="text-xs font-mono tabular-nums" style={{ color: accent }}>
                  {s.numero}
                </span>
              </div>
            </div>

            <div className="card mb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="section-title text-sm">Mensagem</div>
                <button
                  onClick={() => handleCopiar(idx)}
                  className="btn btn-secondary text-xs"
                  style={
                    copiadoIdx === idx
                      ? { color: "var(--success)", borderColor: "var(--success)" }
                      : undefined
                  }
                >
                  {copiadoIdx === idx ? (
                    <>
                      <Check size={12} />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-elevated border border-border rounded-md p-3 text-xs text-primary whitespace-pre-wrap font-sans">
                {s.texto}
              </pre>
            </div>

            <div className="flex justify-end">
              <a
                href={s.linkWA}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-sm"
                style={{ backgroundColor: "#25D366", color: "#fff" }}
              >
                <MessageCircle size={14} />
                Enviar pelo WhatsApp
              </a>
            </div>
          </div>
        ))}

        <div
          className="card mt-6 flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}30` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="stat-label">
                {salvos.length > 1 ? "Códigos criados" : "Código criado"}
              </div>
              <div
                className="font-mono font-bold tracking-wide tabular-nums text-base"
                style={{ color: accent }}
              >
                {salvos.map((s) => s.numero).join("  ·  ")}
              </div>
            </div>
          </div>
          <button onClick={onDone} className="btn btn-primary">
            Concluir
          </button>
        </div>

        {salvos[0]?.telefoneE164 && (
          <div className="mt-3 text-xs text-muted">
            Destino: <strong>+{salvos[0].telefoneE164}</strong>
          </div>
        )}
      </div>
    );
  }

  // ============ WIZARD ============
  const djsDisponiveis = artistas.filter((d) => !blocos.some((b) => b.djId === d.id));

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Novo Orçamento"
        subtitle="Você pode incluir mais de um DJ — cada um gera um orçamento próprio"
        accentColor={accent}
        actions={
          <button onClick={onCancel} className="btn btn-ghost">
            Cancelar
          </button>
        }
      />

      <Stepper
        steps={[
          { num: 1, label: "Contato" },
          { num: 2, label: "Orçamento" },
        ]}
        current={step}
        accent={accent}
      />

      {/* ============ ETAPA 1 ============ */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="section-title mb-3">
              Tipo de evento <span className="text-danger">*</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIPOS_EVENTO.map(({ value, label, icon: Icon, desc }) => {
                const isActive = tipoEvento === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipoEvento(value)}
                    className="card-interactive flex flex-col items-start gap-2 text-left"
                    style={{
                      borderColor: isActive ? accent : undefined,
                      boxShadow: isActive ? `0 0 0 1px ${accent}` : undefined,
                    }}
                  >
                    <div
                      className="h-9 w-9 rounded-md flex items-center justify-center"
                      style={{
                        backgroundColor: isActive ? `${accent}20` : "var(--bg-elevated)",
                        color: isActive ? accent : "var(--text-secondary)",
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-primary">{label}</div>
                      <div className="text-xs text-muted">{desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.tipoEvento && <p className="text-xs text-danger mt-2">{errors.tipoEvento}</p>}
          </div>

          <div className="card">
            <ExistenteOuNovo
              label="Contratante"
              required
              options={contratantes.map((c) => ({
                id: c.id,
                label: c.nome,
                sublabel: c.telefone ? `+${c.telefone}` : undefined,
              }))}
              selectedId={contratanteId}
              onSelectExisting={(id) => setContratanteId(id)}
              mode={contratanteMode}
              newLabel="Novo contratante"
              onSwitchToNew={() => setContratanteMode("novo")}
              onSwitchToExisting={() => setContratanteMode("existente")}
              newFormChildren={
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nome" required error={errors.contratanteNome}>
                    <TextInput
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      placeholder="Marcos Lima"
                      autoFocus
                    />
                  </Field>
                  <Field label="Telefone (WhatsApp)" required>
                    <PhoneInput
                      country={country}
                      onCountryChange={setCountry}
                      value={telDigits}
                      onChange={setTelDigits}
                      error={errors.contratanteTel}
                    />
                  </Field>
                </div>
              }
            />
            {errors.contratante && <p className="text-xs text-danger mt-2">{errors.contratante}</p>}
          </div>

          <div className="card">
            <div className="section-title mb-3">
              Cidade do evento <span className="text-danger">*</span>
            </div>
            <CidadeIBGEAutocomplete
              value={cidadeIbge}
              onChange={(c) => {
                setCidadeIbge(c);
                if (c) setErrors((p) => ({ ...p, cidade: "" }));
              }}
              placeholder="Ex: São Paulo, Belo Horizonte..."
            />
            {errors.cidade && (
              <p className="text-xs text-danger mt-1">{errors.cidade}</p>
            )}
          </div>
        </div>
      )}

      {/* ============ ETAPA 2 ============ */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {blocos.map((b, idx) => (
            <BlocoOrcamentoDj
              key={idx}
              bloco={b}
              indice={idx}
              totalBlocos={blocos.length}
              accent={accent}
              artistas={artistas}
              onChange={(patch) => atualizarBloco(idx, patch)}
              onRemove={() => removerBloco(idx)}
              errors={errors}
              ufCidade={cidadeIbge?.uf}
              nomeCidade={cidadeIbge?.nome}
              tipoEvento={tipoEvento}
            />
          ))}

          {djsDisponiveis.length > 0 && (
            <button
              type="button"
              onClick={() => setModalAddDj(true)}
              className="card-interactive flex items-center justify-center gap-2 text-sm font-medium border-dashed"
              style={{ color: accent }}
            >
              <Plus size={16} />
              Adicionar outro DJ ao orçamento
              <span className="text-xs text-muted font-normal">
                · gera um orçamento separado
              </span>
            </button>
          )}

          {/* Modal de seleção de DJ — via Portal */}
          <Modal
            isOpen={modalAddDj}
            onClose={() => setModalAddDj(false)}
            title="Adicionar DJ ao orçamento"
            subtitle="Cada DJ gera um orçamento separado (ORC-XXXX)"
            maxWidth={440}
          >
            <div className="flex flex-col gap-2">
              {djsDisponiveis.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => adicionarDj(d.id)}
                  className="flex items-center gap-3 px-3 py-3 rounded-md border border-border bg-elevated hover:border-border-strong transition-colors text-left"
                >
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      backgroundColor: d.color,
                      color: "#fff",
                      boxShadow: `0 0 0 2px ${d.color}33`,
                    }}
                  >
                    {d.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-primary">
                    {d.name}
                  </span>
                  <Plus size={16} className="text-muted" />
                </button>
              ))}
            </div>
          </Modal>
        </div>
      )}

      {/* Navegação */}
      <div className="flex justify-between items-center mt-6 gap-2">
        <button onClick={step === 1 ? onCancel : handleBack} className="btn btn-secondary">
          <ArrowLeft size={14} />
          {step === 1 ? "Cancelar" : "Voltar"}
        </button>

        {step === 1 ? (
          <button onClick={handleNext} className="btn btn-primary">
            Próximo
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Save size={14} />
            Salvar {blocos.length > 1 ? `${blocos.length} orçamentos` : "orçamento"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============ Bloco de DJ ============

function BlocoOrcamentoDj({
  bloco,
  indice,
  totalBlocos,
  accent,
  artistas,
  onChange,
  onRemove,
  errors,
  ufCidade,
  nomeCidade,
  tipoEvento,
}: {
  bloco: DjBlock;
  indice: number;
  totalBlocos: number;
  accent: string;
  artistas: DJ[];
  onChange: (patch: Partial<DjBlock>) => void;
  onRemove: () => void;
  errors: Record<string, string>;
  ufCidade?: string;
  nomeCidade?: string;
  tipoEvento: TipoEvento | null;
}) {
  const dj = artistas.find((d) => d.id === bloco.djId);
  const valor = parseFloat(bloco.valorCache.replace(",", "."));

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface overflow-hidden">
      {/* Cabeçalho com cor do DJ */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border"
        style={{
          background: dj
            ? `linear-gradient(90deg, ${dj.color}15 0%, transparent 60%)`
            : "var(--bg-surface-2)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: dj?.color ?? "var(--bg-elevated)", color: "#fff" }}
          >
            {indice + 1}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary truncate">
              {dj?.name ?? "—"}
            </div>
            <div className="text-[0.7rem] text-muted">
              Orçamento {indice + 1} de {totalBlocos}
            </div>
          </div>
        </div>

        {totalBlocos > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="btn-ghost text-xs inline-flex items-center gap-1 flex-shrink-0"
            style={{ color: "var(--danger)" }}
          >
            <Trash2 size={13} />
            Remover
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* DJ + Valor + Duração */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <Field label="DJ" required error={errors[`dj-${indice}`]}>
            <Select value={bloco.djId} onChange={(e) => onChange({ djId: e.target.value })}>
              {artistas.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Valor do cachê" required error={errors[`valor-${indice}`]}>
            <TextInput
              type="text"
              inputMode="decimal"
              value={bloco.valorCache}
              onChange={(e) => onChange({ valorCache: e.target.value.replace(/[^\d.,]/g, "") })}
              placeholder="15000"
            />
          </Field>

          <Field label="Duração">
            <div className="flex items-center gap-1">
              <TextInput
                type="number"
                min={0}
                max={12}
                value={bloco.duracaoHoras}
                onChange={(e) => onChange({ duracaoHoras: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })}
                className="w-14 text-right tabular-nums"
              />
              <span className="text-xs text-muted">h</span>
            </div>
          </Field>

          <Field label="&nbsp;">
            <div className="flex items-center gap-1">
              <TextInput
                type="number"
                min={0}
                max={59}
                step={5}
                value={bloco.duracaoMinutos}
                onChange={(e) => onChange({ duracaoMinutos: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
                className="w-14 text-right tabular-nums"
              />
              <span className="text-xs text-muted">min</span>
            </div>
          </Field>
        </div>

        {errors[`dur-${indice}`] && <p className="text-xs text-danger -mt-2">{errors[`dur-${indice}`]}</p>}

        {bloco.valorCache && !isNaN(valor) && (
          <div className="bg-elevated/40 border border-border rounded-md p-3 text-sm">
            <span className="text-muted">Cachê:</span>{" "}
            <span className="font-bold text-primary tabular-nums">{formatBRL(valor)}</span>{" "}
            <span className="text-muted">
              por {formatarDuracao(bloco.duracaoHoras, bloco.duracaoMinutos)}
              {nomeCidade && (
                <>
                  {" em "}
                  <span className="text-primary font-semibold">{nomeCidade}</span>
                  {ufCidade && `, ${ufCidade}`}
                </>
              )}
              {tipoEvento && (
                <>
                  {" · "}
                  <span style={{ color: accent }}>{LABELS_TIPO_EVENTO[tipoEvento]}</span>
                </>
              )}
            </span>
          </div>
        )}

        <SectionItens title="Camarim / Consumação" items={bloco.camarim} onChange={(camarim) => onChange({ camarim })} />
        <SectionItens title="Efeitos" items={bloco.efeitos} onChange={(efeitos) => onChange({ efeitos })} />
        <SectionItens title="Hotel" items={bloco.hotel} onChange={(hotel) => onChange({ hotel })} />

        {/* Logística - multi-seleção */}
        <div>
          <div className="section-title mb-2">Logística</div>
          <p className="text-xs text-muted mb-3">
            Não marque nenhuma se a logística estiver inclusa no cachê.
          </p>
          <div className="flex flex-col gap-2">
            {/* Aérea com quantidade */}
            <div
              className={`flex items-center gap-3 py-2 px-3 rounded-md border transition-colors ${
                bloco.logistica.aereaQtd > 0
                  ? "border-border-strong bg-elevated"
                  : "border-border"
              }`}
            >
              <input
                type="checkbox"
                checked={bloco.logistica.aereaQtd > 0}
                onChange={(e) =>
                  onChange({
                    logistica: {
                      ...bloco.logistica,
                      aereaQtd: e.target.checked ? Math.max(1, bloco.logistica.aereaQtd) : 0,
                    },
                  })
                }
                style={{ accentColor: accent }}
              />
              <span className="text-sm flex-1">Logística Aérea (Ida e Volta)</span>
              {bloco.logistica.aereaQtd > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        logistica: {
                          ...bloco.logistica,
                          aereaQtd: Math.max(1, bloco.logistica.aereaQtd - 1),
                        },
                      })
                    }
                    className="h-7 w-7 rounded-md border border-border bg-surface-2 text-secondary flex items-center justify-center hover:border-border-strong"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold tabular-nums w-6 text-center">
                    {bloco.logistica.aereaQtd}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        logistica: {
                          ...bloco.logistica,
                          aereaQtd: Math.min(20, bloco.logistica.aereaQtd + 1),
                        },
                      })
                    }
                    className="h-7 w-7 rounded-md border border-border bg-surface-2 text-secondary flex items-center justify-center hover:border-border-strong"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {/* Translado simples */}
            <label
              className={`flex items-center gap-3 py-2 px-3 rounded-md border cursor-pointer transition-colors text-sm ${
                bloco.logistica.transladoTerrestre
                  ? "border-border-strong bg-elevated"
                  : "border-border hover:border-border-hover"
              }`}
            >
              <input
                type="checkbox"
                checked={bloco.logistica.transladoTerrestre}
                onChange={(e) =>
                  onChange({
                    logistica: {
                      ...bloco.logistica,
                      transladoTerrestre: e.target.checked,
                    },
                  })
                }
                style={{ accentColor: accent }}
              />
              <span className="flex-1">
                <span className="font-medium">Translado Terrestre</span>
                <span className="block text-xs text-muted mt-0.5">
                  Motorista executivo ou van: Aeroporto → Hotel → Evento → Hotel → Aeroporto
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Informações extras — texto livre que vai pro fim do orçamento
            no WhatsApp / detalhe. Opcional. */}
        <Field
          label="Informações extras"
          hint="Opcional. Se preenchido, aparece no fim do orçamento (WhatsApp e detalhe)."
        >
          <TextArea
            value={bloco.infoExtra}
            onChange={(e) => onChange({ infoExtra: e.target.value })}
            placeholder="Ex: Promoção especial — desconto de 10% se confirmar até amanhã."
            maxLength={1000}
            rows={3}
          />
        </Field>
      </div>
    </div>
  );
}

function SectionItens({
  title,
  items,
  onChange,
}: {
  title: string;
  items: ItemQuantidade[];
  onChange: (next: ItemQuantidade[]) => void;
}) {
  return (
    <div>
      <div className="section-title mb-2">{title}</div>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <QuantitySelector
            key={item.nome}
            label={item.nome}
            value={item.qtd}
            onChange={(v) => onChange(items.map((it, i) => (i === idx ? { ...it, qtd: v } : it)))}
          />
        ))}
      </div>
    </div>
  );
}

