"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  User,
  MapPin,
  Music,
  CheckCircle2,
  Sparkles,
  Plus,
  Minus,
  X,
  Users,
  CreditCard,
} from "lucide-react";
import PageHeader from "./PageHeader";
import QuantitySelector from "./QuantitySelector";
import PagamentoSection, { novaParcela, type ModoParcela } from "./PagamentoSection";
import { Field, TextInput, TextArea } from "./Field";
import CityAutocomplete, { type CidadeSelecionada } from "./CityAutocomplete";
import PhoneInput, { DEFAULT_COUNTRY, contarDigitos, type Country } from "./PhoneInput";
import { useContatos } from "@/lib/contatos-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas, type NovaVendaInput } from "@/lib/vendas-context";
import { DJS } from "@/lib/djs";
import { formatBRL, formatarDuracao } from "@/lib/whatsapp";
import {
  CATALOGO_CAMARIM,
  CATALOGO_EFEITOS,
  CATALOGO_HOTEL,
  LOGISTICA_VAZIA,
  MODULE_THEMES,
  type ItemQuantidade,
  type LogisticaSelecao,
  type Parcela,
} from "@/types";

type Props = {
  orcamentoId?: string;
  onSaved: (vendaId: string) => void;
  onCancel: () => void;
};

/**
 * Dado dois horários HH:mm, calcula a duração resultante em horas+minutos.
 * Lida com "passar da meia-noite" (fim < início → soma 24h).
 */
function calcularDuracao(inicio: string, fim: string): { horas: number; minutos: number } | null {
  if (!inicio || !fim) return null;
  const [hi, mi] = inicio.split(":").map((n) => parseInt(n, 10));
  const [hf, mf] = fim.split(":").map((n) => parseInt(n, 10));
  if (isNaN(hi) || isNaN(mi) || isNaN(hf) || isNaN(mf)) return null;

  let totalMin = hf * 60 + mf - (hi * 60 + mi);
  if (totalMin <= 0) totalMin += 24 * 60; // cruzou meia-noite

  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  return { horas, minutos };
}

export default function ConcretizarVenda({ orcamentoId, onSaved, onCancel }: Props) {
  const accent = MODULE_THEMES.vendas.color;
  const { contratantes, casas, cidades, addCidade } = useContatos();
  const { orcamentos } = useOrcamentos();
  const { criarVenda } = useVendas();

  const orc = orcamentoId ? orcamentos.find((o) => o.id === orcamentoId) : undefined;
  const contratanteOrc = orc ? contratantes.find((c) => c.id === orc.contratanteId) : undefined;
  const cidadeOrc = orc ? cidades.find((c) => c.id === orc.cidadeId) : undefined;
  const casaOrc = orc?.casaId ? casas.find((c) => c.id === orc.casaId) : undefined;

  // -------------------- Estado --------------------

  // Contratante
  const [contratanteNome, setContratanteNome] = useState(contratanteOrc?.nome ?? "");
  const [contratanteEmail, setContratanteEmail] = useState(contratanteOrc?.email ?? "");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [telDigits, setTelDigits] = useState(() => {
    const tel = contratanteOrc?.telefone ?? "";
    const digs = tel.replace(/\D/g, "");
    if (digs.startsWith("55") && digs.length >= 12) return digs.slice(2);
    return digs;
  });
  const [contratanteDocumento, setContratanteDocumento] = useState(contratanteOrc?.documento ?? "");
  const [contratanteEndereco, setContratanteEndereco] = useState("");

  // Evento
  const [nomeEvento, setNomeEvento] = useState("");
  const [eventoInstagram, setEventoInstagram] = useState("");
  const [nomeLocal, setNomeLocal] = useState(casaOrc?.nome ?? "");
  const [capacidadePublico, setCapacidadePublico] = useState<string>(
    casaOrc?.capacidade ? String(casaOrc.capacidade) : ""
  );
  const [enderecoLocal, setEnderecoLocal] = useState(casaOrc?.endereco ?? "");
  const [dataShow, setDataShow] = useState(orc?.dataShow ?? "");

  // Horário início e fim
  const [horarioInicio, setHorarioInicio] = useState(orc?.horario ?? "");
  const [horarioFim, setHorarioFim] = useState("");

  // Cidade
  const [paisCidade, setPaisCidade] = useState<Country>(DEFAULT_COUNTRY);
  const [cidadeSelecionada, setCidadeSelecionada] = useState<CidadeSelecionada | null>(
    cidadeOrc
      ? {
          id: cidadeOrc.id,
          nome: cidadeOrc.nome,
          uf: cidadeOrc.estado,
          regiao: cidadeOrc.regiao,
          pais: "BR",
          paisNome: "Brasil",
        }
      : null
  );

  // Show — djId é uuid do artista (workspace.artistas).
  const [djId, setDjId] = useState<string | null>(orc?.djId ?? null);

  // Line-Up (outros artistas do evento)
  const [lineUp, setLineUp] = useState<string[]>([]);
  const [novoLineUp, setNovoLineUp] = useState("");

  const [cache, setCache] = useState<string>(orc ? String(orc.valorCache) : "");

  // Duração — pode ser auto-calculada OU sobrescrita manualmente pelo usuário
  const [duracaoHorasManual, setDuracaoHorasManual] = useState<number>(orc?.duracaoHoras ?? 1);
  const [duracaoMinutosManual, setDuracaoMinutosManual] = useState<number>(orc?.duracaoMinutos ?? 0);
  const [duracaoOverride, setDuracaoOverride] = useState<boolean>(false);

  // Cálculo automático a partir de início/fim
  const duracaoAuto = useMemo(
    () => calcularDuracao(horarioInicio, horarioFim),
    [horarioInicio, horarioFim]
  );

  // Quando muda horário e não está em modo manual, atualiza a duração efetiva
  useEffect(() => {
    if (duracaoAuto && !duracaoOverride) {
      setDuracaoHorasManual(duracaoAuto.horas);
      setDuracaoMinutosManual(duracaoAuto.minutos);
    }
  }, [duracaoAuto, duracaoOverride]);

  const duracaoHoras = duracaoHorasManual;
  const duracaoMinutos = duracaoMinutosManual;

  const [camarim, setCamarim] = useState<ItemQuantidade[]>(
    orc?.camarim ?? CATALOGO_CAMARIM.map((n) => ({ nome: n, qtd: 0 }))
  );
  const [efeitos, setEfeitos] = useState<ItemQuantidade[]>(
    orc?.efeitos ?? CATALOGO_EFEITOS.map((n) => ({ nome: n, qtd: 0 }))
  );
  const [hotel, setHotel] = useState<ItemQuantidade[]>(
    orc?.hotel ?? CATALOGO_HOTEL.map((n) => ({ nome: n, qtd: 0 }))
  );
  const [logistica, setLogistica] = useState<LogisticaSelecao>(
    orc?.logistica ?? { ...LOGISTICA_VAZIA }
  );

  const [observacoes, setObservacoes] = useState(orc?.observacoes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ------- Pagamento / Parcelas -------
  const cacheNumAtual = parseFloat(cache.replace(",", ".")) || 0;
  // Modo de pagamento: "padrao" = 1 parcela 100% na data do show | "detalhado" = parcelas customizadas
  const [modoPagamento, setModoPagamento] = useState<"padrao" | "detalhado">("padrao");
  const [modoParcela, setModoParcela] = useState<ModoParcela>("percentual");
  // Começa com 1 parcela de 100%
  const [parcelas, setParcelas] = useState<Parcela[]>(() => [
    novaParcela(100, 0),
  ]);

  // Recalcula os valores das parcelas quando o cachê muda
  useEffect(() => {
    setParcelas((prev) =>
      prev.map((p) => ({
        ...p,
        valor: Math.round((cacheNumAtual * p.percentual) / 100),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheNumAtual]);

  // Monta a lista de parcelas efetiva conforme o modo escolhido.
  // No modo "padrao": 1 parcela de 100% vencendo na data do show.
  function getParcelasEfetivas(): Parcela[] {
    if (modoPagamento === "padrao") {
      return [
        {
          id: parcelas[0]?.id ?? "parc-padrao",
          percentual: 100,
          valor: cacheNumAtual,
          dataVencimento: dataShow,
          statusBase: parcelas[0]?.statusBase ?? "pendente",
          dataPagamento: parcelas[0]?.dataPagamento,
        },
      ];
    }
    return parcelas;
  }

  // ------- Auto-fill tracking -------
  const [autoFilled] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (orc) {
      if (contratanteOrc?.nome) set.add("contratanteNome");
      if (contratanteOrc?.email) set.add("contratanteEmail");
      if (contratanteOrc?.telefone) set.add("contratanteTelefone");
      if (contratanteOrc?.documento) set.add("contratanteDocumento");
      if (casaOrc?.nome) set.add("nomeLocal");
      if (casaOrc?.capacidade) set.add("capacidadePublico");
      if (casaOrc?.endereco) set.add("enderecoLocal");
      if (orc.dataShow) set.add("dataShow");
      if (orc.horario) set.add("horarioInicio");
      if (cidadeOrc) set.add("cidade");
      if (orc.djId) set.add("djId");
      set.add("cache");
      set.add("camarim");
      set.add("efeitos");
      set.add("hotel");
      set.add("logistica");
    }
    return set;
  });
  const [editado, setEditado] = useState<Set<string>>(new Set());
  const marcarEditado = (campo: string) => {
    if (!editado.has(campo)) setEditado((prev) => new Set(prev).add(campo));
  };
  const showAutoBadge = (campo: string): boolean =>
    autoFilled.has(campo) && !editado.has(campo);

  // ------- Line-Up handlers -------
  function adicionarLineUp() {
    const t = novoLineUp.trim();
    if (!t) return;
    if (lineUp.includes(t)) {
      setNovoLineUp("");
      return;
    }
    setLineUp([...lineUp, t]);
    setNovoLineUp("");
  }

  function removerLineUp(idx: number) {
    setLineUp(lineUp.filter((_, i) => i !== idx));
  }

  // ------- Validação -------
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!contratanteNome.trim()) errs.contratanteNome = "Nome obrigatório";
    if (!contratanteEmail.trim()) errs.contratanteEmail = "E-mail obrigatório";
    const dig = contarDigitos(telDigits);
    if (dig === 0) errs.contratanteTelefone = "Telefone obrigatório";
    else if (dig < country.minDigits) errs.contratanteTelefone = "Faltam dígitos";
    if (!contratanteDocumento.trim()) errs.contratanteDocumento = "CPF/CNPJ obrigatório";
    if (!contratanteEndereco.trim()) errs.contratanteEndereco = "Endereço obrigatório";

    if (!nomeEvento.trim()) errs.nomeEvento = "Nome do evento obrigatório";
    if (!nomeLocal.trim()) errs.nomeLocal = "Nome do local obrigatório";
    if (!enderecoLocal.trim()) errs.enderecoLocal = "Endereço do local obrigatório";
    if (!dataShow) errs.dataShow = "Data obrigatória";
    if (!horarioInicio) errs.horarioInicio = "Horário de início obrigatório";
    if (!horarioFim) errs.horarioFim = "Horário de fim obrigatório";
    if (!cidadeSelecionada) errs.cidade = "Cidade obrigatória";

    if (djId === null) errs.dj = "Selecione o artista da agência";
    const cacheNum = parseFloat(cache.replace(",", "."));
    if (!cache || isNaN(cacheNum) || cacheNum <= 0) errs.cache = "Cachê obrigatório";

    // Parcelas — só valida no modo detalhado.
    // No modo padrão, a parcela é gerada automaticamente (100% na data do show).
    if (modoPagamento === "detalhado") {
      if (parcelas.length === 0) {
        errs.parcelas = "Defina ao menos uma parcela";
      } else {
        const somaPct = parcelas.reduce((a, p) => a + (p.percentual || 0), 0);
        const somaVal = parcelas.reduce((a, p) => a + (p.valor || 0), 0);
        const pctOk = Math.abs(somaPct - 100) < 0.01;
        const valOk = Math.abs(somaVal - cacheNum) < 1;
        if (modoParcela === "percentual" && !pctOk) {
          errs.parcelas = "A soma das parcelas deve ser 100%";
        } else if (modoParcela === "valor" && !valOk) {
          errs.parcelas = "A soma das parcelas deve bater com o cachê";
        }
        if (parcelas.some((p) => !p.dataVencimento)) {
          errs.parcelas = "Defina a data de vencimento de todas as parcelas";
        }
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTimeout(() => {
        const firstErr = document.querySelector('[data-has-error="true"]');
        firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !cidadeSelecionada || djId === null) return;

    const cacheNum = parseFloat(cache.replace(",", "."));
    const telefoneE164 = `${country.ddi}${telDigits.replace(/\D/g, "")}`;

    // Resolver cidade nova
    let cidadeIdResolvido: string | undefined = cidadeSelecionada.id;
    if (!cidadeIdResolvido) {
      const novaCid = await addCidade({
        nome: cidadeSelecionada.nome,
        estado: cidadeSelecionada.uf,
        regiao: cidadeSelecionada.regiao,
      });
      cidadeIdResolvido = novaCid.id;
    }
    if (!cidadeIdResolvido) return;

    const input: NovaVendaInput = {
      orcamentoId,
      contratante: contratanteOrc
        ? {
            tipo: "existente",
            id: contratanteOrc.id,
            nomeNovo: contratanteNome,
            emailNovo: contratanteEmail,
            telefoneNovo: telefoneE164,
            documentoNovo: contratanteDocumento,
          }
        : {
            tipo: "novo",
            nome: contratanteNome,
            email: contratanteEmail,
            telefone: telefoneE164,
            documento: contratanteDocumento,
            cidadeId: cidadeIdResolvido,
          },
      contratanteEndereco,
      nomeEvento,
      eventoInstagram: eventoInstagram || undefined,
      nomeLocal,
      capacidadePublico: capacidadePublico ? Number(capacidadePublico) : undefined,
      enderecoLocal,
      dataShow,
      horario: horarioInicio,
      horarioFim,
      cidadeId: cidadeIdResolvido,
      casaId: casaOrc?.id,
      djId,
      lineUp: lineUp.length > 0 ? lineUp : undefined,
      cache: cacheNum,
      duracaoHoras,
      duracaoMinutos: duracaoMinutos > 0 ? duracaoMinutos : undefined,
      camarim,
      efeitos,
      hotel,
      logistica,
      parcelas: getParcelasEfetivas(),
      observacoes: observacoes || undefined,
    };

    const venda = await criarVenda(input);
    onSaved(venda.id);
  }

  const djSelecionado = djId !== null ? DJS.find((d) => d.id === djId) : undefined;

  return (
    <div className="max-w-[900px] mx-auto w-full p-6 lg:p-8 pb-32">
      <button
        onClick={onCancel}
        className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={14} />
        Voltar
      </button>

      <PageHeader
        title={orc ? `Concretizar Venda · ${orc.numero}` : "Nova Venda Direta"}
        subtitle={
          orc
            ? "Dados do orçamento já preenchidos. Complete o restante e confirme."
            : "Preencha todos os dados para fechar uma venda sem orçamento prévio."
        }
        accentColor={accent}
      />

      {orc && (
        <div
          className="card mb-4 flex items-start gap-3"
          style={{ borderColor: accent, backgroundColor: `${accent}08` }}
        >
          <Sparkles size={16} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
          <div className="text-sm text-secondary">
            Os campos com selo{" "}
            <span className="badge badge-neutral text-[0.6rem]">auto</span> vieram do
            orçamento <strong>{orc.numero}</strong>. Você pode alterar qualquer um — o
            selo some quando edita.
          </div>
        </div>
      )}

      {/* ============ 🖋️ INFORMAÇÕES DO CONTRATANTE ============ */}
      <SectionCard icon={<User size={16} />} title="Informações do Contratante" accent={accent}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldWithAuto
            label="Nome do Contratante / Empresa"
            required
            error={errors.contratanteNome}
            showAuto={showAutoBadge("contratanteNome")}
          >
            <TextInput
              value={contratanteNome}
              onChange={(e) => {
                setContratanteNome(e.target.value);
                marcarEditado("contratanteNome");
              }}
              placeholder="Marcos Lima"
            />
          </FieldWithAuto>

          <FieldWithAuto
            label="E-mail"
            required
            error={errors.contratanteEmail}
            showAuto={showAutoBadge("contratanteEmail")}
          >
            <TextInput
              type="email"
              value={contratanteEmail}
              onChange={(e) => {
                setContratanteEmail(e.target.value);
                marcarEditado("contratanteEmail");
              }}
              placeholder="contato@email.com"
            />
          </FieldWithAuto>

          <FieldWithAuto
            label="Telefone"
            required
            showAuto={showAutoBadge("contratanteTelefone")}
          >
            <PhoneInput
              country={country}
              onCountryChange={setCountry}
              value={telDigits}
              onChange={(v) => {
                setTelDigits(v);
                marcarEditado("contratanteTelefone");
              }}
              error={errors.contratanteTelefone}
            />
          </FieldWithAuto>

          <FieldWithAuto
            label="CPF / CNPJ"
            required
            error={errors.contratanteDocumento}
            showAuto={showAutoBadge("contratanteDocumento")}
          >
            <TextInput
              value={contratanteDocumento}
              onChange={(e) => {
                setContratanteDocumento(e.target.value);
                marcarEditado("contratanteDocumento");
              }}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
            />
          </FieldWithAuto>

          <div className="sm:col-span-2">
            <Field
              label="Endereço do Contratante / Empresa"
              required
              error={errors.contratanteEndereco}
            >
              <TextInput
                value={contratanteEndereco}
                onChange={(e) => setContratanteEndereco(e.target.value)}
                placeholder="Rua, número, bairro, cidade — CEP"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ============ 📌 INFORMAÇÕES DO EVENTO ============ */}
      <SectionCard icon={<MapPin size={16} />} title="Informações do Evento" accent={accent}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome do Evento" required error={errors.nomeEvento}>
            <TextInput
              value={nomeEvento}
              onChange={(e) => setNomeEvento(e.target.value)}
              placeholder="Ex: Réveillon Club Laroc 2026"
            />
          </Field>

          <Field label="Instagram do evento" hint="Opcional">
            <TextInput
              value={eventoInstagram}
              onChange={(e) => setEventoInstagram(e.target.value)}
              placeholder="@evento"
            />
          </Field>

          <FieldWithAuto
            label="Nome do Local"
            required
            error={errors.nomeLocal}
            showAuto={showAutoBadge("nomeLocal")}
          >
            <TextInput
              value={nomeLocal}
              onChange={(e) => {
                setNomeLocal(e.target.value);
                marcarEditado("nomeLocal");
              }}
              placeholder="Club Laroc"
            />
          </FieldWithAuto>

          <FieldWithAuto
            label="Capacidade de público"
            showAuto={showAutoBadge("capacidadePublico")}
          >
            <TextInput
              type="number"
              value={capacidadePublico}
              onChange={(e) => {
                setCapacidadePublico(e.target.value);
                marcarEditado("capacidadePublico");
              }}
              placeholder="1200"
            />
          </FieldWithAuto>

          <div className="sm:col-span-2">
            <FieldWithAuto
              label="Endereço do local"
              required
              error={errors.enderecoLocal}
              showAuto={showAutoBadge("enderecoLocal")}
            >
              <TextInput
                value={enderecoLocal}
                onChange={(e) => {
                  setEnderecoLocal(e.target.value);
                  marcarEditado("enderecoLocal");
                }}
                placeholder="Rua, número, bairro"
              />
            </FieldWithAuto>
          </div>

          <FieldWithAuto
            label="Data"
            required
            error={errors.dataShow}
            showAuto={showAutoBadge("dataShow")}
          >
            <TextInput
              type="date"
              value={dataShow}
              onChange={(e) => {
                setDataShow(e.target.value);
                marcarEditado("dataShow");
              }}
            />
          </FieldWithAuto>

          <div className="sm:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <FieldWithAuto
                label="Horário de início"
                required
                error={errors.horarioInicio}
                showAuto={showAutoBadge("horarioInicio")}
              >
                <TextInput
                  type="time"
                  value={horarioInicio}
                  onChange={(e) => {
                    setHorarioInicio(e.target.value);
                    marcarEditado("horarioInicio");
                    setDuracaoOverride(false);
                  }}
                />
              </FieldWithAuto>

              <Field label="Horário de fim" required error={errors.horarioFim}>
                <TextInput
                  type="time"
                  value={horarioFim}
                  onChange={(e) => {
                    setHorarioFim(e.target.value);
                    setDuracaoOverride(false);
                  }}
                />
              </Field>
            </div>
            {duracaoAuto && (
              <p className="text-xs text-muted mt-1.5">
                Duração calculada:{" "}
                <span className="font-semibold text-secondary">
                  {formatarDuracao(duracaoAuto.horas, duracaoAuto.minutos)}
                </span>
                {duracaoOverride && (
                  <span className="ml-2 text-warning">
                    (substituída manualmente — limpe os horários ou ajuste para recalcular)
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <FieldWithAuto label="Cidade" required showAuto={showAutoBadge("cidade")}>
              <CityAutocomplete
                value={cidadeSelecionada}
                onChange={(c) => {
                  setCidadeSelecionada(c);
                  marcarEditado("cidade");
                }}
                country={paisCidade}
                onCountryChange={setPaisCidade}
                error={errors.cidade}
              />
            </FieldWithAuto>
          </div>
        </div>
      </SectionCard>

      {/* ============ 🎵 SHOW ============ */}
      <SectionCard icon={<Music size={16} />} title="Informações do Show" accent={accent}>
        {/* Artista da agência — cards visuais */}
        <FieldWithAuto
          label="Artista da agência (quem vai se apresentar)"
          required
          error={errors.dj}
          showAuto={showAutoBadge("djId")}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {DJS.map((d) => {
              const isActive = djId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setDjId(d.id);
                    marcarEditado("djId");
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md border bg-elevated transition-all text-left"
                  style={{
                    borderColor: isActive ? d.color : "var(--border-color)",
                    boxShadow: isActive ? `0 0 0 1px ${d.color}` : undefined,
                  }}
                >
                  <span
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0"
                    style={{
                      backgroundColor: isActive ? d.color : "var(--bg-surface-2)",
                      color: isActive ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {d.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold text-primary truncate">{d.name}</span>
                </button>
              );
            })}
          </div>
        </FieldWithAuto>

        {/* Line-Up — outros artistas do evento */}
        <div className="mt-5">
          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                <Users size={12} />
                Line-Up <span className="text-muted font-normal">(outros artistas do evento)</span>
              </span>
            }
            hint="Não obrigatório. Use vírgula ou Enter para adicionar cada nome."
          >
            <div className="flex gap-2">
              <TextInput
                value={novoLineUp}
                onChange={(e) => setNovoLineUp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    adicionarLineUp();
                  }
                }}
                placeholder="Ex: Alok"
                className="flex-1"
              />
              <button
                type="button"
                onClick={adicionarLineUp}
                disabled={!novoLineUp.trim()}
                className="btn btn-secondary"
              >
                <Plus size={14} />
                Adicionar
              </button>
            </div>
          </Field>

          {lineUp.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {lineUp.map((nome, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 bg-elevated border border-border rounded-md px-2.5 py-1 text-sm text-primary"
                >
                  {nome}
                  <button
                    type="button"
                    onClick={() => removerLineUp(idx)}
                    className="text-muted hover:text-danger transition-colors"
                    aria-label={`Remover ${nome} do line-up`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Cachê + Duração */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-4 items-end mt-5">
          <FieldWithAuto
            label="Cachê"
            required
            error={errors.cache}
            showAuto={showAutoBadge("cache")}
          >
            <TextInput
              type="text"
              inputMode="decimal"
              value={cache}
              onChange={(e) => {
                setCache(e.target.value.replace(/[^\d.,]/g, ""));
                marcarEditado("cache");
              }}
              placeholder="15000"
            />
          </FieldWithAuto>

          <Field label="Duração do show">
            <div className="flex items-center gap-1">
              <TextInput
                type="number"
                min={0}
                max={12}
                value={duracaoHoras}
                onChange={(e) => {
                  setDuracaoHorasManual(Math.max(0, Math.min(12, Number(e.target.value) || 0)));
                  setDuracaoOverride(true);
                }}
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
                value={duracaoMinutos}
                onChange={(e) => {
                  setDuracaoMinutosManual(Math.max(0, Math.min(59, Number(e.target.value) || 0)));
                  setDuracaoOverride(true);
                }}
                className="w-14 text-right tabular-nums"
              />
              <span className="text-xs text-muted">min</span>
            </div>
          </Field>
        </div>

        {cache && (
          <div className="bg-elevated/40 border border-border rounded-md p-3 text-sm mt-4 mb-4">
            <span className="text-muted">Cachê:</span>{" "}
            <span className="font-bold text-primary tabular-nums">
              {formatBRL(parseFloat(cache.replace(",", ".")) || 0)}
            </span>{" "}
            <span className="text-muted">
              por {formatarDuracao(duracaoHoras, duracaoMinutos)}
              {djSelecionado && (
                <>
                  {" para "}
                  <span style={{ color: djSelecionado.color }} className="font-semibold">
                    {djSelecionado.name}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4 mt-4">
          <SubSection
            title="Camarim / Consumação"
            autoBadge={showAutoBadge("camarim")}
            items={camarim}
            onChange={(c) => {
              setCamarim(c);
              marcarEditado("camarim");
            }}
          />
          <SubSection
            title="Efeitos"
            autoBadge={showAutoBadge("efeitos")}
            items={efeitos}
            onChange={(c) => {
              setEfeitos(c);
              marcarEditado("efeitos");
            }}
          />
          <SubSection
            title="Hotel"
            autoBadge={showAutoBadge("hotel")}
            items={hotel}
            onChange={(c) => {
              setHotel(c);
              marcarEditado("hotel");
            }}
          />

          <LogisticaBlock
            value={logistica}
            onChange={(l) => {
              setLogistica(l);
              marcarEditado("logistica");
            }}
            accent={accent}
            showAuto={showAutoBadge("logistica")}
          />
        </div>
      </SectionCard>

      {/* ============ 💳 FORMA DE PAGAMENTO ============ */}
      <SectionCard icon={<CreditCard size={16} />} title="Forma de Pagamento" accent={accent}>
        {/* Escolha: Padrão x Detalhado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setModoPagamento("padrao")}
            className="card-interactive flex items-start gap-3 text-left"
            style={{
              borderColor: modoPagamento === "padrao" ? accent : undefined,
              boxShadow: modoPagamento === "padrao" ? `0 0 0 1px ${accent}` : undefined,
            }}
          >
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor:
                  modoPagamento === "padrao" ? `${accent}20` : "var(--bg-elevated)",
                color: modoPagamento === "padrao" ? accent : "var(--text-secondary)",
              }}
            >
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-primary">Pagamento Padrão</div>
              <div className="text-xs text-muted">
                Valor único (100%) com vencimento na data do show
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModoPagamento("detalhado")}
            className="card-interactive flex items-start gap-3 text-left"
            style={{
              borderColor: modoPagamento === "detalhado" ? accent : undefined,
              boxShadow:
                modoPagamento === "detalhado" ? `0 0 0 1px ${accent}` : undefined,
            }}
          >
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor:
                  modoPagamento === "detalhado" ? `${accent}20` : "var(--bg-elevated)",
                color: modoPagamento === "detalhado" ? accent : "var(--text-secondary)",
              }}
            >
              <CreditCard size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-primary">Pagamento Detalhado</div>
              <div className="text-xs text-muted">
                Divida em parcelas com % ou valor e datas próprias
              </div>
            </div>
          </button>
        </div>

        {/* Modo Padrão — resumo simples */}
        {modoPagamento === "padrao" && (
          <div className="bg-elevated/40 border border-border rounded-md p-3 text-sm">
            {cacheNumAtual > 0 ? (
              <>
                <span className="text-muted">Pagamento único de </span>
                <span className="font-bold text-primary tabular-nums">
                  {formatBRL(cacheNumAtual)}
                </span>
                <span className="text-muted">
                  {" "}
                  (100%) com vencimento{" "}
                  {dataShow ? (
                    <>
                      em{" "}
                      <span className="text-primary font-semibold">
                        {new Date(dataShow + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>{" "}
                      (data do show)
                    </>
                  ) : (
                    <span className="text-warning">
                      na data do show — preencha a data do evento acima
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span className="text-warning">
                Preencha o cachê acima para definir o pagamento.
              </span>
            )}
          </div>
        )}

        {/* Modo Detalhado — editor completo de parcelas */}
        {modoPagamento === "detalhado" && (
          <>
            <p className="text-xs text-muted mb-3">
              Divida o cachê em parcelas. Cada parcela tem uma data de vencimento
              para o controle no Financeiro.
            </p>
            <div data-has-error={!!errors.parcelas}>
              <PagamentoSection
                cacheTotal={cacheNumAtual}
                parcelas={parcelas}
                onChange={setParcelas}
                modo={modoParcela}
                onModoChange={setModoParcela}
                accent={accent}
                error={errors.parcelas}
              />
            </div>
          </>
        )}
      </SectionCard>

      {/* Observações */}
      <SectionCard icon={null} title="Observações internas" accent={accent}>
        <TextArea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Notas internas sobre a venda (não aparecem em documentos públicos)"
        />
      </SectionCard>

      {/* Ações sticky */}
      <div className="sticky bottom-4 mt-6 flex justify-between items-center gap-2 bg-surface border border-border rounded-lg px-4 py-3 shadow-lg">
        <button onClick={onCancel} className="btn btn-secondary">
          <ArrowLeft size={14} />
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          className="btn btn-primary"
          style={{ backgroundColor: accent, color: "#fff" }}
        >
          <CheckCircle2 size={14} />
          Concretizar Venda
        </button>
      </div>
    </div>
  );
}

// ============ Auxiliares ============

function SectionCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode | null;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mb-4">
      <div className="flex items-center gap-2 mb-4">
        {icon && (
          <div
            className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}20`, color: accent }}
          >
            {icon}
          </div>
        )}
        <div className="section-title">{title}</div>
      </div>
      {children}
    </div>
  );
}

function FieldWithAuto({
  label,
  required,
  hint,
  error,
  showAuto,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
  showAuto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5" data-has-error={!!error}>
      <span className="text-xs font-medium text-secondary inline-flex items-center gap-2">
        {label}
        {required && <span className="text-danger">*</span>}
        {showAuto && <span className="badge badge-neutral text-[0.55rem] py-0">auto</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

function SubSection({
  title,
  autoBadge,
  items,
  onChange,
}: {
  title: string;
  autoBadge?: boolean;
  items: ItemQuantidade[];
  onChange: (next: ItemQuantidade[]) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="stat-label">{title}</span>
        {autoBadge && <span className="badge badge-neutral text-[0.55rem] py-0">auto</span>}
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <QuantitySelector
            key={item.nome}
            label={item.nome}
            value={item.qtd}
            onChange={(v) =>
              onChange(items.map((it, i) => (i === idx ? { ...it, qtd: v } : it)))
            }
          />
        ))}
      </div>
    </div>
  );
}

function LogisticaBlock({
  value,
  onChange,
  accent,
  showAuto,
}: {
  value: LogisticaSelecao;
  onChange: (v: LogisticaSelecao) => void;
  accent: string;
  showAuto?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="stat-label">Logística</span>
        {showAuto && <span className="badge badge-neutral text-[0.55rem] py-0">auto</span>}
      </div>
      <p className="text-xs text-muted mb-3">
        Não marque nada se a logística estiver inclusa no cachê.
      </p>
      <div className="flex flex-col gap-2">
        <div
          className={`flex items-center gap-3 py-2 px-3 rounded-md border transition-colors ${
            value.aereaQtd > 0 ? "border-border-strong bg-elevated" : "border-border"
          }`}
        >
          <input
            type="checkbox"
            checked={value.aereaQtd > 0}
            onChange={(e) =>
              onChange({
                ...value,
                aereaQtd: e.target.checked ? Math.max(1, value.aereaQtd) : 0,
              })
            }
            style={{ accentColor: accent }}
          />
          <span className="text-sm flex-1">Logística Aérea (Ida e Volta)</span>
          {value.aereaQtd > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, aereaQtd: Math.max(1, value.aereaQtd - 1) })}
                className="h-7 w-7 rounded-md border border-border bg-surface-2 text-secondary flex items-center justify-center hover:border-border-strong"
              >
                <Minus size={13} />
              </button>
              <span className="text-sm font-bold tabular-nums w-6 text-center">
                {value.aereaQtd}
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...value, aereaQtd: Math.min(20, value.aereaQtd + 1) })}
                className="h-7 w-7 rounded-md border border-border bg-surface-2 text-secondary flex items-center justify-center hover:border-border-strong"
              >
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>

        <label
          className={`flex items-center gap-3 py-2 px-3 rounded-md border cursor-pointer transition-colors text-sm ${
            value.transladoTerrestre
              ? "border-border-strong bg-elevated"
              : "border-border hover:border-border-hover"
          }`}
        >
          <input
            type="checkbox"
            checked={value.transladoTerrestre}
            onChange={(e) => onChange({ ...value, transladoTerrestre: e.target.checked })}
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
  );
}
