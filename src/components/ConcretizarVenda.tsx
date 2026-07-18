"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useT } from "@/lib/i18n";
import {
  ArrowLeft,
  User,
  MapPin,
  Music,
  CheckCircle2,
  Copy,
  ClipboardPaste,
  MessageCircle,
  Sparkles,
  Plus,
  Minus,
  X,
  Users,
  CreditCard,
  Lock,
} from "lucide-react";
import PageHeader from "./PageHeader";
import QuantitySelector from "./QuantitySelector";
import PagamentoSection, { novaParcela, type ModoParcela } from "./PagamentoSection";
import { Field, TextInput, TextArea } from "./Field";
import InputDocumento from "./inputs/InputDocumento";
import {
  useRazaoSocialDoCnpj,
  LabelRazaoSocial,
  DicaRazaoSocial,
} from "./inputs/RazaoSocialCnpj";
import {
  normalizarDocumento,
  configDocumento,
  detectarEmpresa,
  ehDocumentoEmpresa,
  rotuloEmpresa,
} from "@/lib/data/documentos";
import { canonicalizarTelefoneBR } from "@/lib/telefone";
import InputCapacidade from "./inputs/InputCapacidade";
import InputDataBR from "./inputs/InputDataBR";
import InputHora from "./inputs/InputHora";
import { apenasDigitos, SIMBOLO_MOEDA, formatarMoeda } from "@/lib/formatters";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "./CidadeGlobalAutocomplete";
import { resolverCidade, cidadeParaEscolhida } from "@/lib/cidade-helpers";
import PhoneInput, { DEFAULT_COUNTRY, COUNTRIES, contarDigitos, type Country } from "./PhoneInput";
import SeletorPais from "./SeletorPais";
import DivergenciaContatoModal, { type Divergencia } from "./DivergenciaContatoModal";
import { useConfirmar } from "./ConfirmarModal";
import { algumaParcelaTemHistorico } from "@/lib/parcelaHistorico";
import CasaParecidaModal, {
  type CasaCandidata,
  type EscolhaCasaParecida,
} from "./CasaParecidaModal";
import { buscarPais } from "@/lib/data/countries";
import { normalizar } from "@/lib/normalizar";
import { exemploEndereco } from "@/lib/data/exemplos";
import { getPaisPadrao, getPaisPadraoCode } from "@/lib/preferencias";
import { useContatos } from "@/lib/contatos-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas, type NovaVendaInput } from "@/lib/vendas-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { moedaValida } from "@/lib/mappers/venda";
import { useAuth } from "@/lib/auth-context";
import { formatBRL, formatarDuracao } from "@/lib/whatsapp";
import { textoFechamentoVenda } from "@/lib/fechamentoVenda";
import { parseFechamento } from "@/lib/parseFechamento";
import { parseValorBR } from "@/lib/valor";
import { itensDoRider } from "@/lib/rider";
import { TIPOS_EVENTO } from "./NovoOrcamento";
import {
  CATALOGO_CAMARIM,
  CATALOGO_EFEITOS,
  CATALOGO_HOTEL,
  LABELS_TIPO_EVENTO,
  LOGISTICA_VAZIA,
  MODULE_THEMES,
  TIPO_CASA_POR_EVENTO,
  TIPO_EVENTO_POR_CASA,
  MOEDAS,
  type Contratante,
  type ItemQuantidade,
  type LogisticaSelecao,
  type Moeda,
  type Parcela,
  type TipoEvento,
  type Venda,
} from "@/types";

/** Dados do contato já cadastrado que a venda vai reusar (D2). */
type ContatoAlvo = {
  id: string;
  nome: string;
  email: string;
  endereco: string;
  telefone: string;
  cidadeId: string;
  /** País do CADASTRO. Governa a normalização do documento — sobrescrevê-lo com
   *  o padrão da agência corrompe o CPF/CNPJ/CUIT do contato (ver `submeter`). */
  pais: string;
  /** true quando o alvo veio do /existe, isto é, é um contato FORA da
   *  visibilidade derivada deste usuário. O popup não imprime valores dele. */
  oculto?: boolean;
};

function alvoDeContratante(c: Contratante): ContatoAlvo {
  return {
    id: c.id,
    nome: c.nome ?? "",
    email: c.email ?? "",
    endereco: c.endereco ?? "",
    telefone: c.telefone ?? "",
    cidadeId: c.cidadeId ?? "",
    pais: c.pais ?? "",
  };
}

type Props = {
  orcamentoId?: string;
  /** Data ISO (YYYY-MM-DD) pré-selecionada — ex: vindo do "+" de um dia da agenda. */
  dataInicial?: string;
  /**
   * Venda existente → o form vira MODO EDIÇÃO (campos pré-preenchidos, salva
   * via PATCH). Sem isso, é criação normal.
   */
  vendaParaEditar?: Venda;
  /**
   * `resultado` carrega o que precisa sobreviver à navegação que o próprio
   * onSaved dispara (o form desmonta) — hoje só o aviso das parcelas (D5).
   */
  onSaved: (vendaId: string, resultado?: { parcelasPreservadas?: boolean }) => void;
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

/**
 * Quebra um telefone E.164 (sem "+") em país + dígitos nacionais.
 *
 * A chave de dedupe do contratante é o telefone (D1), então remontá-lo com o
 * DDI errado cria duplicata garantida: o contratante estrangeiro vindo de um
 * orçamento seria remontado com o DDI padrão da agência (55 + número gringo).
 *
 * Ordem: (1) DDI do país-dica (o `pais` do cadastro, quando bate); (2) match do
 * DDI mais LONGO que sobre uma quantidade de dígitos plausível pro país (evita
 * "598…" cair em "5…"); (3) nada plausível → país padrão + dígitos crus, que é
 * o comportamento legado pra número gravado sem DDI.
 */
function separarTelefoneE164(
  e164: string,
  paisDica?: string
): { country: Country; digits: string } {
  const padrao = getPaisPadrao();
  const digs = (e164 ?? "").replace(/\D/g, "");
  if (!digs) return { country: padrao, digits: "" };

  const plausivel = (c: Country, resto: string) =>
    resto.length >= c.minDigits && resto.length <= c.maxDigits;

  const dica = paisDica
    ? COUNTRIES.find((c) => c.code === paisDica.toUpperCase())
    : undefined;
  if (dica && digs.startsWith(dica.ddi)) {
    const resto = digs.slice(dica.ddi.length);
    if (plausivel(dica, resto)) return { country: dica, digits: resto };
  }

  const candidatos = COUNTRIES.filter((c) => digs.startsWith(c.ddi)).sort(
    (a, b) => b.ddi.length - a.ddi.length
  );
  for (const c of candidatos) {
    const resto = digs.slice(c.ddi.length);
    if (plausivel(c, resto)) return { country: c, digits: resto };
  }

  return { country: padrao, digits: digs };
}

/**
 * Divergência = os DOIS lados preenchidos e diferentes. Cadastro vazio + valor
 * digitado NÃO é conflito, é backfill (vai calado) — senão todo orçamento, que
 * cria o contratante só com nome/telefone/cidade, abriria popup à toa.
 */
function diferem(atual: string, novo: string, ignorarCaixa = false): boolean {
  const a = (atual ?? "").trim();
  const b = (novo ?? "").trim();
  if (!a || !b) return false;
  return ignorarCaixa ? a.toLowerCase() !== b.toLowerCase() : a !== b;
}

/** Cadastro vazio + valor digitado → grava sem perguntar. */
function ehBackfill(atual: string, novo: string): boolean {
  return !(atual ?? "").trim() && !!(novo ?? "").trim();
}

/** Data ISO (YYYY-MM-DD) + offset de dias → "DD/MM/YYYY" (vazio se inválida). */
function formatarDataOffset(iso: string, offsetDias: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(y, m - 1, d + offsetDias);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

export default function ConcretizarVenda({
  orcamentoId,
  dataInicial,
  vendaParaEditar,
  onSaved,
  onCancel,
}: Props) {
  const t = useT();
  const accent = MODULE_THEMES.vendas.color;
  const { contratantes, casas, cidades, addCasa, updateCasa } = useContatos();
  const { orcamentos } = useOrcamentos();
  const { criarVenda, atualizarVendaCompleta } = useVendas();
  const { confirmar, confirmador } = useConfirmar();

  // ---- Modo edição (D2) ----
  const v = vendaParaEditar;
  const emEdicao = !!v;
  /**
   * Parcela com histórico financeiro trava o recálculo (D5): regenerar destruiria
   * comprovante, "quem/quando pagou", o motivo do cancelamento, o log de
   * cobranças e o 📌. Preserva e avisa — na dúvida, o dado fica. Mesmo predicado
   * do servidor (`algumaParcelaTemHistorico`) pra não divergir do que ele faz.
   */
  const temParcelaComHistorico = v ? algumaParcelaTemHistorico(v.parcelas) : false;
  const [copiadoWA, setCopiadoWA] = useState(false);
  const [previewWA, setPreviewWA] = useState(false);
  const [resultadoColagem, setResultadoColagem] = useState<{
    preenchidos: string[];
    naoPreenchidos: string[];
    avisos: string[];
    erro?: string;
  } | null>(null);
  const artistas = useArtistas();
  const { podeUI } = useAuth();

  const orc = orcamentoId ? orcamentos.find((o) => o.id === orcamentoId) : undefined;
  const contratanteOrc = orc ? contratantes.find((c) => c.id === orc.contratanteId) : undefined;
  const cidadeOrc = orc ? cidades.find((c) => c.id === orc.cidadeId) : undefined;
  const casaOrc = orc?.casaId ? casas.find((c) => c.id === orc.casaId) : undefined;
  // Cadastros de origem na EDIÇÃO — âncoras equivalentes às do orçamento no
  // fluxo de criação (dedupe do contato e da casa dependem delas).
  const contratanteDaVenda = v ? contratantes.find((c) => c.id === v.contratanteId) : undefined;
  const casaDaVenda = v?.casaId ? casas.find((c) => c.id === v.casaId) : undefined;
  const contatoAncora = emEdicao ? contratanteDaVenda : contratanteOrc;
  const casaAncora = emEdicao ? casaDaVenda : casaOrc;
  // Fallback quando o dedupe da casa fica cego (rede/permissão): preserva o
  // vínculo que já existe em vez de zerar. Na edição é a casa da venda — e vale
  // o id CRU (a casa pode estar oculta pra este usuário, e aí `casaDaVenda` nem
  // resolve, mas o vínculo continua válido).
  const casaIdDegradado = emEdicao ? v?.casaId : orc?.casaId;
  // Orçamento detalhado: as infos do evento preenchidas lá têm prioridade no
  // pré-preenchimento (caem pra casa/base do orçamento quando não informadas).
  const det = orc?.detalhesEvento;

  // -------------------- Estado --------------------

  // Contratante
  // O telefone do cadastro vem em E.164 — separa DDI dos dígitos nacionais pra
  // que o campo remonte EXATAMENTE a mesma chave de dedupe (D1).
  // Na edição o snapshot da VENDA manda (é o que foi fechado com o
  // contratante), mas o país vem do CADASTRO — é ele que governa o documento.
  const telInicial = useMemo(
    () =>
      v
        ? separarTelefoneE164(v.contratanteTelefone ?? "", contratanteDaVenda?.pais)
        : separarTelefoneE164(contratanteOrc?.telefone ?? "", contratanteOrc?.pais),
    [v, contratanteDaVenda?.pais, contratanteOrc?.telefone, contratanteOrc?.pais]
  );
  const [contratanteNome, setContratanteNome] = useState(
    v?.contratanteNome ?? contratanteOrc?.nome ?? ""
  );
  const [contratanteEmail, setContratanteEmail] = useState(
    v?.contratanteEmail ?? contratanteOrc?.email ?? ""
  );
  const [country, setCountry] = useState<Country>(() => telInicial.country);
  // País de origem do contratante — define o documento fiscal pedido.
  const [paisOrigem, setPaisOrigem] = useState<Country>(() => {
    const code = (
      (emEdicao ? contratanteDaVenda?.pais : contratanteOrc?.pais) ?? getPaisPadraoCode()
    ).toUpperCase();
    return buscarPais(code).find((p) => p.code === code) ?? getPaisPadrao();
  });
  const [telDigits, setTelDigits] = useState(() => telInicial.digits);
  const [contratanteDocumento, setContratanteDocumento] = useState(
    v?.contratanteDocumento ?? contratanteOrc?.documento ?? ""
  );
  // Razão social do DOCUMENTO digitado (só existe quando ele é CNPJ). Reidrata
  // do snapshot da venda e, quando ele é vazio (venda fechada antes da migração
  // 91), do CADASTRO pela âncora — campo que não reidrata é APAGADO ao salvar.
  // Usa `||` e não `??`: snapshot vazio tem que cair pro cadastro.
  const [contratanteRazaoSocial, setContratanteRazaoSocial] = useState(
    v?.contratanteRazaoSocial || contatoAncora?.razaoSocial || ""
  );
  // Escolha manual PF/Empresa — só entra em cena em país AMBÍGUO (sem regra).
  // Reidrata (B4) do item do jsonb `documentos` do contato-âncora que casa com
  // o documento; sem item (venda pura, contato oculto), heurística pela razão.
  const [tipoManual, setTipoManual] = useState<"pf" | "pj">(() => {
    const docNorm = normalizarDocumento(paisOrigem.code, contratanteDocumento);
    return (
      contatoAncora?.documentos?.find((d) => d.documento === docNorm)?.tipo ??
      (contratanteRazaoSocial ? "pj" : "pf")
    );
  });
  // Pré-preenche do cadastro: sem isso o endereço digitado "divergiria" do
  // cadastro em toda conversão de orçamento.
  const [contratanteEndereco, setContratanteEndereco] = useState(
    v?.contratanteEndereco ?? contratanteOrc?.endereco ?? ""
  );

  // Evento — detalhes do orçamento detalhado (det) primeiro; senão casa/base.
  /**
   * Categoria do evento (D1) → vira o tipo da casa. Seed em 3 camadas:
   * edição → volta pela casa da venda (bar/arena/outro não têm categoria: fica
   * null e o campo é opcional, D6/O6); conversão de orçamento → HERDA o que já
   * foi escolhido lá (D2, o vendedor não redigita); venda direta pura → vazio.
   */
  const [tipoEvento, setTipoEvento] = useState<TipoEvento | null>(() => {
    if (emEdicao) return casaDaVenda?.tipo ? TIPO_EVENTO_POR_CASA[casaDaVenda.tipo] ?? null : null;
    return orc?.tipoEvento ?? null;
  });
  const [nomeEvento, setNomeEvento] = useState(v?.nomeEvento ?? det?.nomeEvento ?? "");
  const [eventoInstagram, setEventoInstagram] = useState(
    v ? v.eventoInstagram ?? "" : det?.instagram ?? ""
  );
  const [nomeLocal, setNomeLocal] = useState(v?.nomeLocal ?? det?.nomeLocal ?? casaOrc?.nome ?? "");
  const [capacidadePublico, setCapacidadePublico] = useState<string>(
    v
      ? v.capacidadePublico
        ? String(v.capacidadePublico)
        : ""
      : det?.capacidade
        ? String(det.capacidade)
        : casaOrc?.capacidade
          ? String(casaOrc.capacidade)
          : ""
  );
  const [enderecoLocal, setEnderecoLocal] = useState(
    v?.enderecoLocal ?? det?.enderecoLocal ?? casaOrc?.endereco ?? ""
  );
  const [dataShow, setDataShow] = useState(
    v?.dataShow ?? det?.dataShow ?? orc?.dataShow ?? dataInicial ?? ""
  );
  // "DD/MM" vindo da colagem SEM ano — pré-preenche o campo Data pro vendedor
  // completar só o ano.
  const [dataParcialColada, setDataParcialColada] = useState("");

  // Horário início e fim
  const [horarioInicio, setHorarioInicio] = useState(
    v ? v.horario ?? "" : det?.horarioInicio ?? orc?.horario ?? ""
  );
  const [horarioFim, setHorarioFim] = useState(v ? v.horarioFim ?? "" : det?.horarioFim ?? "");
  // Não persiste na venda — na edição nasce no padrão (o campo é derivado do
  // orçamento detalhado, que a venda não guarda).
  const [terminoDiaSeguinte, setTerminoDiaSeguinte] = useState(
    v ? false : det?.terminoDiaSeguinte ?? false
  );
  // "Horário a definir" — nasce desmarcado (venda de orçamento com horário
  // continua com horário). Na edição, reflete a venda: sem horário = a definir.
  // Marcado: limpa/desabilita os dois inputs, pula a validação de
  // obrigatoriedade e envia horário null no payload.
  const [horarioADefinir, setHorarioADefinir] = useState(v ? !v.horario : false);
  function toggleHorarioADefinir() {
    setHorarioADefinir((prev) => {
      const novo = !prev;
      if (novo) {
        setHorarioInicio("");
        setHorarioFim("");
        setDuracaoOverride(false);
        setErrors((e) => ({ ...e, horarioInicio: "", horarioFim: "" }));
      }
      return novo;
    });
  }

  // Cidade — pré-popula a partir do orçamento (ou da venda, na edição) se
  // houver ibge_id. Cidade legada resolve `null` e o validate força re-escolha.
  const [cidadeIbge, setCidadeIbge] = useState<CidadeEscolhida | null>(
    cidadeParaEscolhida(v ? cidades.find((c) => c.id === v.cidadeId) : cidadeOrc)
  );

  // Show — artistaId é uuid do artista (workspace.artistas).
  const [artistaId, setDjId] = useState<string | null>(v?.artistaId ?? orc?.artistaId ?? null);

  // Line-Up (outros artistas do evento)
  const [lineUp, setLineUp] = useState<string[]>(v?.lineUp ?? []);
  const [novoLineUp, setNovoLineUp] = useState("");

  // O `.` do Number vira separador de MILHAR no parseValorBR — `String(1400.5)`
  // ("1400.5") seria lido como 14005. Troca por vírgula decimal.
  const [cache, setCache] = useState<string>(
    v ? String(v.cache).replace(".", ",") : orc ? String(orc.valorCache) : ""
  );

  // Moeda: reidrata da venda (edição) ou do orçamento; caso contrário nasce na
  // moeda PADRÃO da agência. `moedaTocada` evita que o sync com a agência (que
  // só chega quando as prefs carregam) sobrescreva a escolha do usuário.
  const { preferencias } = useWorkspace();
  const moedaAgencia = moedaValida(preferencias.moeda);
  const [moeda, setMoeda] = useState<Moeda>(v?.moeda ?? orc?.moeda ?? moedaAgencia);
  const moedaTocada = useRef(false);
  useEffect(() => {
    // Só numa venda NOVA (sem v/orc) e enquanto o usuário não escolheu: segue a
    // agência quando as preferências terminam de carregar.
    if (!v && !orc && !moedaTocada.current) setMoeda(moedaAgencia);
  }, [moedaAgencia, v, orc]);

  // Duração — pode ser auto-calculada OU sobrescrita manualmente pelo usuário
  const [duracaoHorasManual, setDuracaoHorasManual] = useState<number>(
    v?.duracaoHoras ?? orc?.duracaoHoras ?? 1
  );
  const [duracaoMinutosManual, setDuracaoMinutosManual] = useState<number>(
    v ? v.duracaoMinutos ?? 0 : orc?.duracaoMinutos ?? 0
  );
  // Na edição já nasce "manual": sem isso o efeito de auto-cálculo esmagaria a
  // duração salva (que pode divergir de fim-menos-início de propósito).
  const [duracaoOverride, setDuracaoOverride] = useState<boolean>(emEdicao);

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
    v?.camarim ?? orc?.camarim ?? CATALOGO_CAMARIM.map((n) => ({ nome: n, qtd: 0 }))
  );
  const [efeitos, setEfeitos] = useState<ItemQuantidade[]>(
    v?.efeitos ?? orc?.efeitos ?? CATALOGO_EFEITOS.map((n) => ({ nome: n, qtd: 0 }))
  );
  const [hotel, setHotel] = useState<ItemQuantidade[]>(
    v?.hotel ?? orc?.hotel ?? CATALOGO_HOTEL.map((n) => ({ nome: n, qtd: 0 }))
  );
  const [logistica, setLogistica] = useState<LogisticaSelecao>(
    v?.logistica ?? orc?.logistica ?? { ...LOGISTICA_VAZIA }
  );

  const [observacoes, setObservacoes] = useState(v ? v.observacoes ?? "" : orc?.observacoes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Trava o submit: evita double-click criar duas vendas (bug que gerou
  // duas VND com o mesmo número a partir do mesmo orçamento).
  const [salvando, setSalvando] = useState(false);

  // ------- Popup de divergência do contato (D2) -------
  // O submit é async e roda dentro do guard `salvando`; o modal responde por
  // Promise pra não quebrar o fluxo em dois caminhos.
  const [divergencias, setDivergencias] = useState<Divergencia[] | null>(null);
  const [nomeContatoDiv, setNomeContatoDiv] = useState("");
  const [divCego, setDivCego] = useState(false);
  const responderDivergencia = useRef<((campos: string[]) => void) | null>(null);

  /**
   * Abre o popup e resolve com os campos que o usuário aceitou atualizar.
   * `cego` = contato fora da visibilidade derivada (veio do /existe): o popup
   * não imprime os valores do cadastro.
   */
  function perguntarDivergencias(
    nomeContato: string,
    divs: Divergencia[],
    cego = false
  ): Promise<string[]> {
    return new Promise((resolve) => {
      responderDivergencia.current = resolve;
      setNomeContatoDiv(nomeContato);
      setDivCego(cego);
      setDivergencias(divs);
    });
  }

  /** Fechar/Manter/Confirmar — sempre resolve (fechar = manter, nunca trava). */
  function fecharDivergencia(campos: string[]) {
    setDivergencias(null);
    const resolver = responderDivergencia.current;
    responderDivergencia.current = null;
    resolver?.(campos);
  }

  // ------- Popup de local parecido (dedupe difuso da casa) -------
  // Estados PRÓPRIOS (não reusa os do contato): o submit abre os dois popups em
  // sequência, então eles coexistem.
  const [casaParecida, setCasaParecida] = useState<{
    nomeDigitado: string;
    candidatas: CasaCandidata[];
  } | null>(null);
  const responderCasaParecida = useRef<((r: EscolhaCasaParecida) => void) | null>(null);

  /** Abre o popup e resolve com a escolha (vincular na existente x criar nova). */
  function perguntarCasaParecida(
    nomeDigitado: string,
    candidatas: CasaCandidata[]
  ): Promise<EscolhaCasaParecida> {
    return new Promise((resolve) => {
      responderCasaParecida.current = resolve;
      setCasaParecida({ nomeDigitado, candidatas });
    });
  }

  /**
   * Todo caminho de saída passa por aqui — deixar a Promise pendurada
   * congelaria o submit com `salvando = true` pra sempre.
   */
  function fecharCasaParecida(r: EscolhaCasaParecida) {
    setCasaParecida(null);
    const resolver = responderCasaParecida.current;
    responderCasaParecida.current = null;
    resolver?.(r);
  }

  // ------- Pagamento / Parcelas -------
  const cacheNumAtual = parseValorBR(cache) || 0;
  // Modo de pagamento: "padrao" = 1 parcela 100% na data do show | "detalhado" = parcelas customizadas
  // Na edição, só cai em "padrão" quando a venda REALMENTE é o padrão — senão o
  // modo padrão sobrescreveria um vencimento customizado calado.
  const [modoPagamento, setModoPagamento] = useState<"padrao" | "detalhado">(() => {
    if (!v) return "padrao";
    const ehPadrao =
      v.parcelas.length === 1 &&
      v.parcelas[0].percentual === 100 &&
      v.parcelas[0].dataVencimento === v.dataShow;
    return ehPadrao ? "padrao" : "detalhado";
  });
  const [modoParcela, setModoParcela] = useState<ModoParcela>("percentual");
  // Começa com 1 parcela de 100% (ou as parcelas reais da venda, na edição)
  const [parcelas, setParcelas] = useState<Parcela[]>(() =>
    v ? v.parcelas : [novaParcela(100, 0)]
  );

  // Recalcula os valores das parcelas quando o cachê muda
  useEffect(() => {
    // D5 — parcela com histórico não é recalculada: o valor dela é registro
    // financeiro (pagamento, isenção acordada…).
    if (temParcelaComHistorico) return;
    setParcelas((prev) =>
      prev.map((p) => ({
        ...p,
        // 2 casas (centavos), não real inteiro — `Math.round(x)/100` == round(x/100,2).
        valor: Math.round(cacheNumAtual * p.percentual) / 100,
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
    // Modo detalhado: a ÚLTIMA parcela absorve o resto do arredondamento pra
    // soma(parcelas) fechar EXATAMENTE o cachê (senão sobra 1 centavo/real de
    // drift em rateios não-divisíveis). As demais já vêm arredondadas a 2 casas.
    if (parcelas.length === 0) return parcelas;
    const outras = parcelas.slice(0, -1);
    const somaOutras = outras.reduce((a, p) => a + (p.valor || 0), 0);
    const ultima = parcelas[parcelas.length - 1];
    const restante = Math.round((cacheNumAtual - somaOutras) * 100) / 100;
    return [...outras, { ...ultima, valor: restante }];
  }

  // ------- Auto-fill tracking -------
  // Na edição não existe selo "auto": os campos são os da própria venda, não
  // herança de orçamento.
  const [autoFilled] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (orc && !vendaParaEditar) {
      if (contratanteOrc?.nome) set.add("contratanteNome");
      if (contratanteOrc?.email) set.add("contratanteEmail");
      if (contratanteOrc?.telefone) set.add("contratanteTelefone");
      if (contratanteOrc?.documento) set.add("contratanteDocumento");
      if (contratanteOrc?.razaoSocial) set.add("contratanteRazaoSocial");
      if (det?.nomeEvento) set.add("nomeEvento");
      if (det?.instagram) set.add("eventoInstagram");
      if (det?.nomeLocal || casaOrc?.nome) set.add("nomeLocal");
      if (det?.capacidade || casaOrc?.capacidade) set.add("capacidadePublico");
      if (det?.enderecoLocal || casaOrc?.endereco) set.add("enderecoLocal");
      if (det?.dataShow || orc.dataShow) set.add("dataShow");
      if (det?.horarioInicio || orc.horario) set.add("horarioInicio");
      if (det?.horarioFim) set.add("horarioFim");
      if (cidadeOrc) set.add("cidade");
      if (orc.artistaId) set.add("artistaId");
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

  // Venda DIRETA (sem orçamento): escolher/trocar o artista re-monta
  // Camarim/Efeitos a partir do rider DELE (sem rider → catálogo padrão).
  // Hotel fica no catálogo fixo. No fluxo vindo de orçamento os itens do
  // orçamento mandam, então não sobrescrevemos.
  function aplicarRiderVendaDireta(novoArtistaId: string) {
    // Na EDIÇÃO os itens são o que já foi acordado com o contratante — trocar o
    // artista não pode reescrevê-los calado (o usuário ajusta na mão se quiser).
    if (orc || emEdicao) return;
    const a = artistas.find((d) => d.id === novoArtistaId);
    setCamarim(itensDoRider(a?.riderCamarim, CATALOGO_CAMARIM));
    setEfeitos(itensDoRider(a?.riderEfeitos, CATALOGO_EFEITOS));
  }

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

  // Regra do país decide o tipo do documento. `detectEmpresa === null` = país
  // AMBÍGUO (sem regra): aí quem manda é a escolha manual. No BR/países com regra
  // o toggle nunca aparece e o fluxo segue idêntico ao de hoje.
  const detectEmpresa = detectarEmpresa(paisOrigem.code, contratanteDocumento);
  const docEhEmpresa = ehDocumentoEmpresa(
    paisOrigem.code,
    contratanteDocumento,
    tipoManual === "pj"
  );
  const mostrarToggleEmpresa = !!contratanteDocumento.trim() && detectEmpresa === null;

  // Fechou 14 dígitos → busca a razão social sozinha (nossos cadastros antes da
  // Receita). Só preenche campo VAZIO — o que veio do snapshot/cadastro na
  // edição, ou o que o vendedor colou, fica de pé. Falhar é não-evento.
  const buscaRazao = useRazaoSocialDoCnpj({
    pais: paisOrigem.code,
    documento: contratanteDocumento,
    valor: contratanteRazaoSocial,
    onPreencher: (r) => {
      setContratanteRazaoSocial(r);
      // Não é `marcarEditado`: quem preencheu foi a busca, não o vendedor.
      setErrors((p) => ({ ...p, contratanteRazaoSocial: "" }));
    },
  });

  // ------- Validação -------
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!contratanteNome.trim()) errs.contratanteNome = t("Nome obrigatório");
    if (!contratanteEmail.trim()) errs.contratanteEmail = t("E-mail obrigatório");
    const dig = contarDigitos(telDigits);
    if (dig === 0) errs.contratanteTelefone = t("Telefone obrigatório");
    else if (dig < country.minDigits) errs.contratanteTelefone = t("Faltam dígitos");
    if (!contratanteDocumento.trim()) errs.contratanteDocumento = t("CPF/CNPJ obrigatório");
    // Só na criação: venda antiga fechada no CNPJ não tem razão social gravada
    // e exigi-la travaria uma edição que nada tem a ver com isso (mesma regra
    // do tipo de evento, logo abaixo).
    if (docEhEmpresa && !contratanteRazaoSocial.trim() && !emEdicao)
      errs.contratanteRazaoSocial = t("Razão social obrigatória");
    if (!contratanteEndereco.trim()) errs.contratanteEndereco = t("Endereço obrigatório");

    // Só na criação: venda antiga cuja casa é bar/arena/outro reidrata sem
    // categoria, e exigi-la travaria uma edição que nada tem a ver com isso.
    if (!tipoEvento && !emEdicao) errs.tipoEvento = t("Selecione o tipo de evento");
    if (!nomeEvento.trim()) errs.nomeEvento = t("Nome do evento obrigatório");
    if (!nomeLocal.trim()) errs.nomeLocal = t("Nome do local obrigatório");
    if (!enderecoLocal.trim()) errs.enderecoLocal = t("Endereço do local obrigatório");
    if (!dataShow) errs.dataShow = t("Data obrigatória");
    if (!horarioADefinir) {
      if (!horarioInicio) errs.horarioInicio = t("Horário de início obrigatório");
      if (!horarioFim) errs.horarioFim = t("Horário de fim obrigatório");
    }
    if (!cidadeIbge) errs.cidade = t("Cidade obrigatória");

    // artistaId precisa apontar pra um artista ATIVO. Não basta ser != null
    // porque pode ter herdado de orçamento com id inválido (DJ deletado).
    const artistaIdValido =
      artistaId !== null && artistas.some((d) => d.id === artistaId);
    if (!artistaIdValido) {
      errs.artista = orc?.artistaId
        ? t("Selecione o artista atual da agência (o original do orçamento foi removido).")
        : t("Selecione o artista da agência");
    }
    const cacheNum = parseValorBR(cache);
    if (!cache || isNaN(cacheNum) || cacheNum <= 0) errs.cache = t("Cachê obrigatório");

    // Parcelas — só valida no modo detalhado.
    // No modo padrão, a parcela é gerada automaticamente (100% na data do show).
    // Com parcela com histórico (D5) elas nem são enviadas e a seção é
    // só-leitura: exigir que somem o cachê aqui TRAVARIA justamente a correção
    // de cachê que a pessoa veio fazer — o aviso na seção já explica que
    // revisar é no Financeiro.
    if (modoPagamento === "detalhado" && !temParcelaComHistorico) {
      if (parcelas.length === 0) {
        errs.parcelas = t("Defina ao menos uma parcela");
      } else {
        const somaPct = parcelas.reduce((a, p) => a + (p.percentual || 0), 0);
        const somaVal = parcelas.reduce((a, p) => a + (p.valor || 0), 0);
        const pctOk = Math.abs(somaPct - 100) < 0.01;
        const valOk = Math.abs(somaVal - cacheNum) < 0.01;
        if (modoParcela === "percentual" && !pctOk) {
          errs.parcelas = t("A soma das parcelas deve ser 100%");
        } else if (modoParcela === "valor" && !valOk) {
          errs.parcelas = t("A soma das parcelas deve bater com o cachê");
        }
        if (parcelas.some((p) => !p.dataVencimento)) {
          errs.parcelas = t("Defina a data de vencimento de todas as parcelas");
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
    // Guard de reentrada: se já está salvando, ignora cliques extras.
    if (salvando) return;
    if (!validate() || !cidadeIbge || artistaId === null) return;

    setSalvando(true);
    try {
      await submeter();
    } catch (e) {
      setErrors((p) => ({ ...p, geral: (e as Error).message }));
      setSalvando(false); // libera pra tentar de novo só em caso de erro
    }
  }

  /**
   * Qual contratante esta venda usa. Chave = TELEFONE em E.164 (D1): cada
   * número de telefone = 1 contato, nunca duplica.
   *
   * Ordem: telefone inalterado vindo de orçamento → é ele mesmo; senão procura
   * local e, por fim, no endpoint (que enxerga o workspace inteiro, inclusive
   * contato OCULTO por visibilidade derivada — o contexto local é cego pra ele).
   * Rede falhando não bloqueia a venda.
   */
  async function resolverContratanteAlvo(
    telefoneE164: string
  ): Promise<ContatoAlvo | null> {
    const telefoneValido = contarDigitos(telDigits) >= country.minDigits;

    if (contatoAncora && (!telefoneValido || contatoAncora.telefone === telefoneE164)) {
      return alvoDeContratante(contatoAncora);
    }
    if (!telefoneValido) return null;

    const local = contratantes.find((c) => c.telefone === telefoneE164);
    if (local) return alvoDeContratante(local);

    try {
      const resp = await fetch(
        `/api/contatos/contratantes/existe?telefone=${encodeURIComponent(telefoneE164)}`
      );
      // Sem a resposta do endpoint não existe dedupe possível (o contexto local
      // é cego pra contato fora da visibilidade derivada). Cair no ramo "novo"
      // aqui duplicaria o telefone, que é justamente o que D1 proíbe — então
      // propaga: handleSubmit mostra o erro e a pessoa tenta de novo.
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const j = await resp.json();
      if (j?.existe && j.contratante?.id) {
        const c = j.contratante;
        return {
          id: c.id as string,
          nome: (c.nome as string) ?? "",
          email: (c.email as string) ?? "",
          endereco: (c.endereco as string) ?? "",
          telefone: (c.telefone as string) ?? "",
          cidadeId: (c.cidade_id as string) ?? "",
          pais: (c.pais as string) ?? "",
          // Veio do /existe → fora da visibilidade derivada deste usuário.
          oculto: true,
        };
      }
    } catch {
      throw new Error(
        t("Não foi possível verificar se esse telefone já tem cadastro. Tente de novo.")
      );
    }

    // Telefone novo que não bate com ninguém: vindo de orçamento (ou editando
    // uma venda) é a MESMA pessoa com o número corrigido — o popup pergunta se
    // atualiza o cadastro. Sem âncora, é contato novo mesmo.
    return contatoAncora ? alvoDeContratante(contatoAncora) : null;
  }

  /**
   * D4 — a casa de shows nasce junto com a venda: antes, o local só existia
   * como texto em `nome_local` e a casa NUNCA era criada.
   *
   * Dedupe = (nome normalizado) + cidade. O endpoint é obrigatório no caminho:
   * `casas` do contexto é filtrado por visibilidade derivada, então pro artista
   * o dedupe local é cego e ele recriaria a casa.
   *
   * Best-effort: falhar aqui NÃO bloqueia a venda (o local segue como texto).
   */
  async function resolverCasaId(cidadeId: string): Promise<string | undefined> {
    const nome = nomeLocal.trim();
    // A casa do orçamento vale enquanto o nome do local não mudou. Se mudou (ou
    // se ela está OCULTA pra este usuário, e aí `casaOrc` nem resolve), cai na
    // busca por nome — que reencontra a mesma casa pelo endpoint em vez de
    // fixar a casa errada na venda.
    // A chave de dedupe é (nome, cidade) — a cidade entra aqui também: se o
    // usuário corrigiu a cidade na venda, a casa do orçamento é OUTRA casa
    // (mesmo nome, cidade diferente = casa diferente, D4). Deixa cair na busca.
    if (
      casaAncora &&
      casaAncora.cidadeId === cidadeId &&
      normalizar(casaAncora.nome) === normalizar(nome)
    )
      return casaAncora.id;
    if (!nome || !cidadeId) return casaIdDegradado;

    try {
      const alvo = normalizar(nome);
      const local = casas.find(
        (c) => normalizar(c.nome) === alvo && c.cidadeId === cidadeId
      );
      if (local) return local.id;

      const resp = await fetch(
        `/api/contatos/casas/existe?nome=${encodeURIComponent(nome)}&cidade_id=${encodeURIComponent(cidadeId)}`
      );
      // Resposta não-ok não pode virar `existe: undefined` e cair no addCasa:
      // isso criaria uma casa DUPLICADA sem erro nenhum. Sem poder consultar o
      // workspace inteiro, o dedupe é cego — degrada pra casa de origem.
      if (!resp.ok) return casaIdDegradado;
      const j = await resp.json();
      if (j?.existe && j.casa?.id) return j.casa.id as string;

      // Sem match EXATO: pode existir casa PARECIDA na mesma cidade ("Downtown"
      // cadastrado, digitou "Downtown Urban Club"). Busca best-effort e num
      // try/catch PRÓPRIO: falhar aqui não pode escorrer pro catch externo (a
      // venda viraria orc?.casaId em silêncio) — degrada pro fluxo de hoje.
      let candidatas: CasaCandidata[] = [];
      try {
        const r2 = await fetch(
          `/api/contatos/casas/parecidas?nome=${encodeURIComponent(nome)}&cidade_id=${encodeURIComponent(cidadeId)}&endereco=${encodeURIComponent(enderecoLocal.trim())}`
        );
        if (r2.ok) {
          const j2 = await r2.json();
          candidatas = Array.isArray(j2?.candidatas) ? j2.candidatas : [];
        }
      } catch {
        /* segue pro fluxo de hoje (cria nova) */
      }
      if (candidatas.length > 0) {
        const escolha = await perguntarCasaParecida(nome, candidatas);
        if (escolha.tipo === "vincular") {
          if (escolha.renomearPara) {
            // Best-effort: a casa pode estar fora da visibilidade (PATCH 404) ou
            // o PATCH ser barrado. O VÍNCULO é o valor real e não pode ser
            // perdido por um rename cosmético.
            try {
              await updateCasa(escolha.casaId, { nome: escolha.renomearPara });
            } catch {
              /* rename falhou → vincula assim mesmo */
            }
          }
          return escolha.casaId;
        }
      }

      // A casa nasce com a categoria escolhida no form (D1). O "outro" só é
      // alcançável na edição de venda antiga sem categoria (O6). Casa NÃO tem
      // telefone (o telefone é do contratante, não do local).
      const nova = await addCasa({
        nome,
        tipo: tipoEvento ? TIPO_CASA_POR_EVENTO[tipoEvento] : "outro",
        cidadeId,
        endereco: enderecoLocal.trim() || undefined,
        capacidade: Number(capacidadePublico) || undefined,
      });
      return nova.id;
    } catch {
      // Degrada pra casa de origem em vez de zerar: sem isso, falha de rede ou
      // addCasa barrado por permissão PERDE o vínculo que já existia.
      return casaIdDegradado;
    }
  }

  /**
   * D1 — casa JÁ existente com categoria "Outro" herda a do evento, PERGUNTANDO
   * antes. Categoria específica (club/festival/festa-privada/bar/arena) nunca é
   * tocada: a casa é registro compartilhado e quem cadastrou decidiu.
   *
   * O "Outro" é ambíguo de propósito e não dá pra desambiguar aqui: `rowParaCasa`
   * (mappers/contatos.ts:107) coage `tipo` NULL do banco pra "outro", então o
   * legado sem categoria e o "Outro" que a pessoa escolheu à mão no CasaForm
   * chegam idênticos no cliente. Como D1 proíbe sobrescrever em silêncio, a
   * saída é o mesmo padrão do CasaParecidaModal: pergunta, e o silêncio (ESC /
   * "Manter") preserva o cadastro.
   *
   * Best-effort: casa oculta (PATCH 404) ou sem permissão não pode custar a
   * venda — o tipo é enriquecimento, não o valor da operação.
   */
  async function backfillTipoCasa(casaId: string) {
    if (!tipoEvento) return;
    // Casa fora de `casas` (visibilidade derivada) não dá pra avaliar nem
    // PATCHear — e a recém-criada pelo addCasa já nasceu com o tipo certo.
    const casa = casas.find((c) => c.id === casaId);
    if (!casa || casa.tipo !== "outro") return;
    const ok = await confirmar({
      titulo: t("Atualizar a categoria do local?"),
      mensagem: t(
        'O local "{local}" está cadastrado como "Outro". Mudar a categoria dele para "{categoria}"? Isso vale para todos os shows deste local, não só para esta venda.',
        { local: casa.nome, categoria: t(LABELS_TIPO_EVENTO[tipoEvento]) }
      ),
      confirmarLabel: t("Mudar categoria"),
      cancelarLabel: t("Manter como está"),
    });
    if (!ok) return;
    try {
      await updateCasa(casaId, { tipo: TIPO_CASA_POR_EVENTO[tipoEvento] });
    } catch {
      /* segue: a casa fica sem categoria, a venda não */
    }
  }

  async function submeter() {
    // Re-narrowing pro TS (o guard real está em handleSubmit, mas o
    // type-checker não atravessa a fronteira de função).
    if (artistaId === null || !cidadeIbge) return;
    const cacheNum = parseValorBR(cache);
    // Canônico: pro BR completa o nono dígito que falta (número antigo) — o
    // que grava e o que o /existe busca ficam na mesma forma; as variantes do
    // endpoint cobrem os registros antigos sem o 9.
    const telefoneE164 = canonicalizarTelefoneBR(
      `${country.ddi}${telDigits.replace(/\D/g, "")}`
    );

    // Resolve a cidade IBGE → UUID local (cria se ainda não existe)
    let cidadeIdResolvido: string;
    try {
      const cid = await resolverCidade(cidadeIbge!);
      cidadeIdResolvido = cid.id;
    } catch (e) {
      setErrors((p) => ({ ...p, cidade: (e as Error).message }));
      setSalvando(false);
      return;
    }

    // ---- Contratante: a chave é o TELEFONE (D1) ----
    // O documento NÃO serve de chave: o mesmo contratante fecha um show no CPF
    // e outro no CNPJ de propósito — como chave, ele duplicaria. Aqui o
    // documento só acumula no histórico (D3, no servidor).
    const alvo = await resolverContratanteAlvo(telefoneE164);

    // O país do CADASTRO manda na normalização do documento. Em venda direta
    // `paisOrigem` nasce no padrão da agência (BR) e o país nem entra no popup
    // (D3 excluiu só o documento, mas o país segue junto dele) — normalizar um
    // CUIT argentino como "BR" corrompe o documento principal e o histórico.
    const paisDoDoc = alvo?.pais || paisOrigem.code;
    const docNorm = normalizarDocumento(paisDoDoc, contratanteDocumento);
    // A razão social pertence ao DOCUMENTO, não à pessoa: se o documento que
    // está indo é de pessoa física, não existe razão social pra ele. Usa o MESMO
    // país do `docNorm` — senão gravaríamos uma razão social num documento que o
    // cadastro não lê como empresa.
    const razaoSocialDoDoc = ehDocumentoEmpresa(paisDoDoc, contratanteDocumento, tipoManual === "pj")
      ? contratanteRazaoSocial.trim()
      : "";
    // Escolha manual PF/Empresa: só viaja quando o país do CADASTRO é ambíguo
    // (sem regra). País com regra deriva e o servidor ignora este campo.
    const documentoTipoManual: "pf" | "pj" | undefined =
      detectarEmpresa(paisDoDoc, contratanteDocumento) === null && docNorm ? tipoManual : undefined;

    let contratanteInput: NovaVendaInput["contratante"];
    if (alvo) {
      // Reusa SEMPRE (jamais duplica). Se algum dado digitado conflita com o
      // cadastro, o popup pergunta campo-a-campo o que atualizar (D2).
      const divs: Divergencia[] = [];
      if (diferem(alvo.nome, contratanteNome))
        divs.push({
          campo: "nome",
          rotulo: t("Nome"),
          atual: alvo.nome,
          novo: contratanteNome.trim(),
        });
      if (diferem(alvo.email, contratanteEmail, true))
        divs.push({
          campo: "email",
          rotulo: t("E-mail"),
          atual: alvo.email,
          novo: contratanteEmail.trim(),
        });
      if (diferem(alvo.endereco, contratanteEndereco))
        divs.push({
          campo: "endereco",
          rotulo: t("Endereço"),
          atual: alvo.endereco,
          novo: contratanteEndereco.trim(),
        });
      if (diferem(alvo.telefone, telefoneE164))
        divs.push({
          campo: "telefone",
          rotulo: t("Telefone"),
          atual: `+${alvo.telefone}`,
          novo: `+${telefoneE164}`,
        });
      // DOCUMENTO NUNCA ENTRA NO POPUP (D3) — ele acumula, não conflita.

      // Só pergunta o que dá pra gravar: o PATCH exige `contatos.editar`
      // (verificarMutacaoContato). Sem a permissão, o popup prometeria uma
      // atualização que o servidor 403a — a venda segue com o snapshot digitado.
      const podeEditarContato = podeUI(artistaId, "contatos.editar");
      // Contato oculto: o próprio NOME do cadastro é PII que este usuário não
      // pode ver — o popup se identifica pelo nome digitado.
      const aceitos =
        divs.length > 0 && podeEditarContato
          ? await perguntarDivergencias(
              alvo.oculto ? contratanteNome : alvo.nome || contratanteNome,
              divs,
              alvo.oculto
            )
          : [];

      const existente: Extract<NovaVendaInput["contratante"], { tipo: "existente" }> = {
        tipo: "existente",
        id: alvo.id,
        // Documento vai SEMPRE, inclusive em "Manter como está": o servidor
        // acumula o histórico e o principal vira o último usado (D3).
        // Persiste só dígitos do CPF/CNPJ — a UI re-aplica máscara pra exibir.
        documentoNovo: docNorm,
        // O snapshot da venda é o que foi DIGITADO agora — independente do que
        // o usuário decidiu gravar no cadastro.
        snapshot: {
          nome: contratanteNome.trim(),
          email: contratanteEmail.trim(),
          telefone: telefoneE164,
          documento: docNorm,
          razaoSocial: razaoSocialDoDoc,
        },
      };
      // Grava o campo se foi aceito no popup OU se o cadastro estava vazio
      // (backfill silencioso — não é conflito).
      if (aceitos.includes("nome") || ehBackfill(alvo.nome, contratanteNome))
        existente.nomeNovo = contratanteNome.trim();
      if (aceitos.includes("email") || ehBackfill(alvo.email, contratanteEmail))
        existente.emailNovo = contratanteEmail.trim();
      if (aceitos.includes("endereco") || ehBackfill(alvo.endereco, contratanteEndereco))
        existente.enderecoNovo = contratanteEndereco.trim();
      if (aceitos.includes("telefone") || ehBackfill(alvo.telefone, telefoneE164))
        existente.telefoneNovo = telefoneE164;
      // Razão social anda colada no documento (D6): CNPJ já cadastrado com razão
      // diferente = empresa renomeada/corrigida → atualiza calado, nunca vira
      // divergência. Em BRANCO ela NÃO vai: o campo pode estar escondido (o país
      // que a tela usa é o `paisOrigem`, o que grava é o do cadastro) e um branco
      // invisível apagaria a razão do cadastro. Trocar CNPJ→CPF continua zerando
      // pelo `documentoNovo` (o servidor deriva a razão do documento principal).
      if (razaoSocialDoDoc) existente.razaoSocialNovo = razaoSocialDoDoc;
      // Escolha manual PF/Empresa (país ambíguo): acompanha o documento (D6),
      // fora do popup. Só vai quando houve escolha manual de fato.
      if (documentoTipoManual) existente.documentoTipo = documentoTipoManual;
      // D5 — cidade só entra quando o cadastro NÃO tem (backfill-se-vazio):
      // o cidade_id alimenta geocode/mapa e não deve pular a cada venda.
      if (!alvo.cidadeId) existente.cidadeIdNovo = cidadeIdResolvido;
      // País, mesma regra: backfill-se-vazio. O seletor da venda direta nasce no
      // padrão da agência, então mandá-lo sempre trocaria o país do cadastro
      // calado (e o país não entra no popup pra ser confirmado).
      if (!alvo.pais) existente.paisNovo = paisOrigem.code;

      contratanteInput = existente;
    } else {
      contratanteInput = {
        tipo: "novo",
        nome: contratanteNome.trim(),
        email: contratanteEmail.trim(),
        telefone: telefoneE164,
        documento: docNorm,
        razaoSocial: razaoSocialDoDoc,
        documentoTipo: documentoTipoManual,
        pais: paisOrigem.code,
        cidadeId: cidadeIdResolvido,
      };
    }

    // D4 — a casa de shows nasce junto com a venda (best-effort).
    const casaIdResolvido = await resolverCasaId(cidadeIdResolvido);
    if (casaIdResolvido) await backfillTipoCasa(casaIdResolvido);

    const input: NovaVendaInput = {
      // A origem não muda numa edição — o PATCH nem aceita orcamento_id.
      orcamentoId: emEdicao ? undefined : orcamentoId,
      contratante: contratanteInput,
      contratanteEndereco,
      nomeEvento,
      eventoInstagram: eventoInstagram || undefined,
      nomeLocal,
      capacidadePublico: capacidadePublico ? Number(capacidadePublico) : undefined,
      enderecoLocal,
      dataShow,
      horario: horarioADefinir ? null : horarioInicio,
      horarioFim: horarioADefinir ? null : horarioFim,
      cidadeId: cidadeIdResolvido,
      casaId: casaIdResolvido,
      artistaId,
      lineUp: lineUp.length > 0 ? lineUp : undefined,
      cache: cacheNum,
      moeda,
      duracaoHoras,
      duracaoMinutos: duracaoMinutos > 0 ? duracaoMinutos : undefined,
      camarim,
      efeitos,
      hotel,
      logistica,
      // D5 — com parcela com histórico, omite as parcelas: o servidor não toca
      // em nada.
      parcelas: temParcelaComHistorico ? undefined : getParcelasEfetivas(),
      observacoes: observacoes || undefined,
    };

    if (v) {
      const r = await atualizarVendaCompleta(v.id, input);
      // O aviso NÃO pode morar aqui: o `onSaved` navega pro detalhe da venda e
      // este form desmonta no mesmo commit (auto-batching) — um Toast local
      // nunca chegaria a renderizar. Sobe a flag pro destino, que é justamente
      // onde o "revise no Financeiro" pode ser agido.
      onSaved(v.id, { parcelasPreservadas: r.parcelasPreservadas });
      return;
    }

    const venda = await criarVenda(input);
    onSaved(venda.id);
  }

  // Passo 3 (volta) — cola a lista que o contratante devolveu e auto-preenche.
  async function aplicarColagem() {
    let texto = "";
    try {
      texto = await navigator.clipboard.readText();
    } catch {
      setResultadoColagem({
        preenchidos: [],
        naoPreenchidos: [],
        avisos: [],
        erro: "Não consegui ler a área de transferência do navegador. Copie a lista de novo e tente.",
      });
      return;
    }
    if (!texto.trim()) {
      setResultadoColagem({
        preenchidos: [],
        naoPreenchidos: [],
        avisos: [],
        erro: "Não há nada copiado. Copie a lista que o contratante devolveu e clique de novo.",
      });
      return;
    }
    const { campos, naoPreenchidos, avisos } = parseFechamento(texto);
    const feitos: string[] = [];
    const set = (v: string | undefined, fn: (x: string) => void, rotulo: string) => {
      if (v) {
        fn(v);
        feitos.push(rotulo);
      }
    };
    set(campos.contratanteNome, setContratanteNome, "Nome");
    set(campos.contratanteEmail, setContratanteEmail, "E-mail");
    // Telefone: canonicaliza (remove DDI, formata, completa o nono dígito BR
    // que falta nos números antigos) e separa país + dígitos pro campo.
    if (campos.contratanteTelefone) {
      const canon = canonicalizarTelefoneBR(campos.contratanteTelefone);
      const tel = separarTelefoneE164(canon, paisOrigem.code);
      setCountry(tel.country);
      setTelDigits(tel.digits);
      feitos.push("Telefone");
    }
    set(campos.contratanteDocumento, setContratanteDocumento, "CPF/CNPJ");
    // Razão social só entra quando o documento é de empresa — senão o painel
    // anunciaria um campo que a tela não mostra (e cujo valor o submit descarta).
    // Reavalia com o documento COLADO agora: `docEhEmpresa` é do render anterior.
    if (
      ehDocumentoEmpresa(
        paisOrigem.code,
        campos.contratanteDocumento ?? contratanteDocumento,
        tipoManual === "pj"
      )
    ) {
      set(campos.contratanteRazaoSocial, setContratanteRazaoSocial, "Razão social");
      // Veio do contratante, não da nossa busca: o microtexto de origem não
      // pode reivindicar um valor que não preencheu.
      if (campos.contratanteRazaoSocial) buscaRazao.aoEditarManualmente();
    }
    set(campos.contratanteEndereco, setContratanteEndereco, "Endereço");
    set(campos.nomeEvento, setNomeEvento, "Evento");
    set(campos.eventoInstagram, setEventoInstagram, "Instagram");
    set(campos.nomeLocal, setNomeLocal, "Local");
    set(campos.capacidadePublico, setCapacidadePublico, "Capacidade");
    set(campos.enderecoLocal, setEnderecoLocal, "Endereço do evento");
    set(campos.dataShow, setDataShow, "Data");
    // Data sem ano ("17/07"): pré-preenche dia/mês no campo e avisa que falta
    // o ano. Colagem posterior COM ano completo substitui normalmente.
    if (campos.dataShow) {
      setDataParcialColada("");
    } else if (campos.dataShowParcial) {
      setDataParcialColada(campos.dataShowParcial);
      feitos.push("Data (sem ano)");
      avisos.push(
        `A data veio sem o ano (${campos.dataShowParcial}) — complete o ano no campo "Data do evento".`
      );
    }
    set(campos.horario, setHorarioInicio, "Horário");
    if (campos.horarioFim) setHorarioFim(campos.horarioFim);
    if (campos.lineUp && campos.lineUp.length) {
      setLineUp(campos.lineUp);
      feitos.push("Line-Up");
    }
    setResultadoColagem({ preenchidos: feitos, naoPreenchidos, avisos });
  }

  /**
   * Gate do botão salvar. Espelha o servidor pra não existir botão que toma 403:
   *  - criação/conversão: a permissão do fluxo, no artista escolhido.
   *  - edição: `editar_venda`/`editar_todos` no artista ATUAL da venda; e se a
   *    edição MOVE a venda pra outro artista, o PATCH exige também permissão de
   *    criar no DESTINO (route.ts:76-82 — IDOR de destino).
   */
  const podeSalvar = (() => {
    if (!v) return podeUI(artistaId, orcamentoId ? "vendas.converter" : "vendas.criar_venda");
    const podeEditar =
      podeUI(v.artistaId || null, "vendas.editar_venda") ||
      podeUI(v.artistaId || null, "vendas.editar_todos");
    if (!podeEditar) return false;
    if (artistaId !== null && artistaId !== v.artistaId)
      return podeUI(artistaId, "vendas.criar_venda");
    return true;
  })();

  const artistaSelecionado = artistaId !== null ? artistas.find((d) => d.id === artistaId) : undefined;

  // Resolve o DJ a ser usado quando vem de orçamento:
  //  1. orc.artistaId bate com um ativo → usa direto (caso comum)
  //  2. orc.artistaId está inválido (DJ original foi pra lixeira ou foi
  //     recriado com outro id) E o workspace tem só 1 DJ ativo →
  //     assume que é ele (auto-fix silencioso). Cobre o caso típico
  //     do plano Individual.
  //  3. Caso contrário → caller mostra grid / erro pra resolver.
  const artistaDoOrcamento = orc?.artistaId
    ? artistas.find((d) => d.id === orc.artistaId)
    : null;
  const artistaAutoFallback =
    !artistaDoOrcamento && orc?.artistaId && artistas.length === 1
      ? artistas[0]
      : null;
  const artistaEfetivoOrc = artistaDoOrcamento ?? artistaAutoFallback;

  // Sincroniza artistaId com o artistaEfetivoOrc quando ele resolve (admin não
  // precisa clicar — a venda é gravada com o id certo).
  useEffect(() => {
    if (artistaEfetivoOrc && artistaId !== artistaEfetivoOrc.id) {
      setDjId(artistaEfetivoOrc.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistaEfetivoOrc?.id]);

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8 pb-32">
      <button
        onClick={onCancel}
        className="btn-ghost mb-4 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={14} />
        {t("Voltar")}
      </button>

      <PageHeader
        title={
          v
            ? `Editar Venda · ${v.numero}`
            : orc
              ? `Concretizar Venda · ${orc.numero}`
              : "Nova Venda Direta"
        }
        subtitle={
          v
            ? t("Altere o que precisar e salve — o show e o financeiro acompanham.")
            : orc
              ? "Dados do orçamento já preenchidos. Complete o restante e confirme."
              : "Preencha todos os dados para fechar uma venda sem orçamento prévio."
        }
        accentColor={accent}
      />

      {orc && !emEdicao && (
        <div
          className="card mb-4 flex items-start gap-3"
          style={{ borderColor: accent, backgroundColor: `${accent}08` }}
        >
          <Sparkles size={16} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
          <div className="text-sm text-secondary">
            {t("Os campos com selo")}{" "}
            <span className="badge badge-neutral text-[0.6rem]">auto</span> {t("vieram do orçamento")}{" "}
            <strong>{orc.numero}</strong>. {t("Você pode alterar qualquer um — o selo some quando edita.")}
          </div>
        </div>
      )}

      {/* Lista de fechamento pro contratante — no TOPO: cola a resposta dele
          e o formulário se auto-preenche. Reflete o formulário atual. */}
      {(() => {
        const dadosFechamento = {
          contratanteNome,
          contratanteEmail,
          contratanteTelefone: telDigits.replace(/\D/g, "")
            ? `${country.ddi}${telDigits.replace(/\D/g, "")}`
            : "",
          contratanteDocumento,
          contratanteRazaoSocial,
          contratanteEndereco,
          nomeEvento,
          eventoInstagram,
          nomeLocal,
          capacidadePublico: capacidadePublico ? Number(capacidadePublico) : undefined,
          enderecoLocal,
          dataShow,
          horario: horarioInicio,
          horarioFim,
          cache: cache ? parseValorBR(cache) : undefined,
          moeda,
          lineUp,
          efeitos,
          camarim,
          hotel,
          logistica,
        };
        const texto = textoFechamentoVenda(dadosFechamento);
        return (
          <div
            className="card mb-4 flex items-start gap-3"
            style={{ borderColor: "var(--success)", backgroundColor: "var(--success-weak)" }}
          >
            <MessageCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-secondary">
                {t("Lista de fechamento pro contratante — copie e mande no WhatsApp pra ele completar só o que falta (e-mail, CPF, endereço…).")}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(texto);
                      setCopiadoWA(true);
                      setTimeout(() => setCopiadoWA(false), 2500);
                    } catch {
                      /* clipboard indisponível */
                    }
                  }}
                  className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
                >
                  {copiadoWA ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copiadoWA ? t("Copiado!") : t("Copiar para WhatsApp")}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewWA((v) => !v)}
                  className="btn-ghost text-xs"
                >
                  {previewWA ? t("Ocultar prévia") : t("Ver prévia")}
                </button>
                <button
                  type="button"
                  onClick={aplicarColagem}
                  className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
                >
                  <ClipboardPaste size={14} />
                  {t("Colar resposta e preencher")}
                </button>
              </div>
              {previewWA && (
                <textarea
                  readOnly
                  value={texto}
                  rows={14}
                  className="w-full mt-2 bg-elevated border border-border rounded-md px-3 py-2 text-xs text-secondary font-sans whitespace-pre-wrap resize-none leading-relaxed"
                />
              )}

              {resultadoColagem && (
                <div className="mt-2 flex flex-col gap-1 text-xs">
                  {resultadoColagem.erro ? (
                    <div style={{ color: "var(--danger)" }}>{resultadoColagem.erro}</div>
                  ) : (
                    <>
                      {resultadoColagem.preenchidos.length > 0 ? (
                        <div style={{ color: "var(--success)" }}>
                          ✓ {t("Preenchi:")} {resultadoColagem.preenchidos.join(", ")}.
                        </div>
                      ) : (
                        <div className="text-muted">
                          {t("Não encontrei campos reconhecíveis no que estava copiado.")}
                        </div>
                      )}
                      {[...resultadoColagem.naoPreenchidos, ...resultadoColagem.avisos].length > 0 && (
                        <div style={{ color: "var(--warning)" }}>
                          ⚠ {t("Não preenchi (confira/preencha manual):")}{" "}
                          {[...resultadoColagem.naoPreenchidos, ...resultadoColagem.avisos].join(", ")}.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ============ 🖋️ INFORMAÇÕES DO CONTRATANTE ============ */}
      <SectionCard icon={<User size={16} />} title={t("Informações do Contratante")} accent={accent}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <Field label="País de origem">
            <SeletorPais
              value={paisOrigem}
              onChange={(p) => {
                setPaisOrigem(p);
                setCountry(p);
                // Cada país tem sua regra — a escolha manual do anterior não vale.
                setTipoManual("pf");
              }}
            />
          </Field>

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
            label={configDocumento(paisOrigem.code).label}
            required
            error={errors.contratanteDocumento}
            showAuto={showAutoBadge("contratanteDocumento")}
          >
            <InputDocumento
              pais={paisOrigem.code}
              value={contratanteDocumento}
              onChange={(novo) => {
                setContratanteDocumento(novo);
                marcarEditado("contratanteDocumento");
                // Limpou o documento → a escolha manual perde o sentido.
                if (!novo.trim()) setTipoManual("pf");
              }}
            />
          </FieldWithAuto>

          {/* País ambíguo (sem regra) com documento preenchido: o vendedor diz se
              é pessoa física ou empresa. BR/países com regra nunca veem isto. */}
          {mostrarToggleEmpresa && (
            <div className="sm:col-span-2">
              <span className="text-xs font-medium text-secondary mb-1.5 block">
                {t("Tipo de documento")}
              </span>
              <div className="flex w-full overflow-hidden rounded-md border border-border bg-elevated">
                {[
                  { v: "pf" as const, label: "Pessoa física" },
                  { v: "pj" as const, label: "Empresa" },
                ].map((opt, i) => {
                  const ativo = tipoManual === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setTipoManual(opt.v)}
                      className={`flex-1 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                        i === 1 ? "border-l border-border" : ""
                      }`}
                      style={
                        ativo
                          ? {
                              color: accent,
                              background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                            }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      {t(opt.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {docEhEmpresa && (
            <div className="sm:col-span-2">
              {paisOrigem.code === "BR" ? (
                <FieldWithAuto
                  label={<LabelRazaoSocial busca={buscaRazao} />}
                  required={!emEdicao}
                  error={errors.contratanteRazaoSocial}
                  showAuto={showAutoBadge("contratanteRazaoSocial")}
                >
                  <TextInput
                    value={contratanteRazaoSocial}
                    onChange={(e) => {
                      setContratanteRazaoSocial(e.target.value);
                      buscaRazao.aoEditarManualmente();
                      marcarEditado("contratanteRazaoSocial");
                    }}
                    placeholder="Ex: Silva Produções Artísticas LTDA"
                  />
                  <DicaRazaoSocial busca={buscaRazao} valor={contratanteRazaoSocial} />
                </FieldWithAuto>
              ) : (
                <FieldWithAuto
                  label={t(rotuloEmpresa(paisOrigem.code))}
                  required={!emEdicao}
                  error={errors.contratanteRazaoSocial}
                  showAuto={showAutoBadge("contratanteRazaoSocial")}
                >
                  <TextInput
                    value={contratanteRazaoSocial}
                    onChange={(e) => {
                      setContratanteRazaoSocial(e.target.value);
                      marcarEditado("contratanteRazaoSocial");
                    }}
                    placeholder={t(rotuloEmpresa(paisOrigem.code))}
                  />
                </FieldWithAuto>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <Field
              label="Endereço do Contratante / Empresa"
              required
              error={errors.contratanteEndereco}
            >
              <TextInput
                value={contratanteEndereco}
                onChange={(e) => setContratanteEndereco(e.target.value)}
                placeholder={exemploEndereco(paisOrigem.code)}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* ============ 📌 INFORMAÇÕES DO EVENTO ============ */}
      <SectionCard icon={<MapPin size={16} />} title={t("Informações do Evento")} accent={accent}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-secondary mb-2">
              {t("Tipo de evento")}
              {!emEdicao && <span className="text-danger ml-0.5">*</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIPOS_EVENTO.map(({ value, label, icon: Icon, desc }) => {
                const isActive = tipoEvento === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setTipoEvento(value);
                      setErrors((p) => ({ ...p, tipoEvento: "" }));
                    }}
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
                      <div className="text-sm font-semibold text-primary">{t(label)}</div>
                      <div className="text-xs text-muted">{t(desc)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.tipoEvento && <p className="text-xs text-danger mt-2">{errors.tipoEvento}</p>}
          </div>

          <div className="sm:col-span-2">
            <FieldWithAuto
              label="Cidade do evento"
              required
              error={errors.cidade}
              showAuto={showAutoBadge("cidade")}
            >
              <CidadeGlobalAutocomplete
                value={cidadeIbge}
                onChange={(c) => {
                  setCidadeIbge(c);
                  marcarEditado("cidade");
                  if (c) setErrors((p) => ({ ...p, cidade: "" }));
                }}
                placeholder={t("Ex: São Paulo, Belo Horizonte...")}
              />
            </FieldWithAuto>
          </div>

          <Field label="Nome do evento" required error={errors.nomeEvento}>
            <TextInput
              value={nomeEvento}
              onChange={(e) => setNomeEvento(e.target.value)}
              placeholder="Ex: Réveillon Club Laroc 2026"
            />
          </Field>

          <Field label="@ Instagram do evento" hint="Opcional">
            <TextInput
              value={eventoInstagram}
              onChange={(e) => setEventoInstagram(e.target.value)}
              placeholder="@evento"
            />
          </Field>

          <FieldWithAuto
            label="Nome do local"
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
            label="Capacidade do público"
            showAuto={showAutoBadge("capacidadePublico")}
          >
            <InputCapacidade
              value={capacidadePublico}
              onChange={(digitos) => {
                setCapacidadePublico(digitos);
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
                placeholder={exemploEndereco(cidadeIbge?.pais ?? "BR")}
              />
            </FieldWithAuto>
          </div>

          <FieldWithAuto
            label="Data do evento"
            required
            error={errors.dataShow}
            showAuto={showAutoBadge("dataShow")}
          >
            <InputDataBR
              value={dataShow}
              sugestaoParcial={dataParcialColada}
              onChange={(iso) => {
                setDataShow(iso);
                marcarEditado("dataShow");
              }}
            />
          </FieldWithAuto>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">
              {t("Data da apresentação")}
            </span>
            <div className="flex w-full overflow-hidden rounded-md border border-border bg-elevated">
              {[
                { v: false, label: "Mesmo dia do evento" },
                { v: true, label: "Dia seguinte ao evento" },
              ].map((opt, i) => {
                const ativo = terminoDiaSeguinte === opt.v;
                return (
                  <button
                    key={String(opt.v)}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setTerminoDiaSeguinte(opt.v)}
                    className={`flex-1 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      i === 1 ? "border-l border-border" : ""
                    }`}
                    style={
                      ativo
                        ? {
                            color: accent,
                            background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {t(opt.label)}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-muted">
              {dataShow
                ? t("Apresentação em {data}.", { data: formatarDataOffset(dataShow, terminoDiaSeguinte ? 1 : 0) })
                : t("Dia seguinte = vira a madrugada (depois da meia-noite).")}
            </span>
          </div>

          {/* Horário da apresentação — segmentado no MESMO padrão do
              "Data da apresentação" logo acima. "A definir" esconde os
              campos de hora e salva sem horário (pendência no show).
              No desktop, seletor + Início + Término dividem UMA linha. */}
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">
              {t("Horário da apresentação")}
            </span>
            <div className="flex w-full overflow-hidden rounded-md border border-border bg-elevated">
              {[
                { v: false, label: "Definir horário" },
                { v: true, label: "A definir" },
              ].map((opt, i) => {
                const ativo = horarioADefinir === opt.v;
                return (
                  <button
                    key={String(opt.v)}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => {
                      if (horarioADefinir !== opt.v) toggleHorarioADefinir();
                    }}
                    className={`flex-1 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      i === 1 ? "border-l border-border" : ""
                    }`}
                    style={
                      ativo
                        ? {
                            color: accent,
                            background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {t(opt.label)}
                  </button>
                );
              })}
            </div>
            {horarioADefinir && (
              <span className="text-xs text-muted">
                {t("Você define depois — o show fica com a pendência de horário.")}
              </span>
            )}
          </div>

          {!horarioADefinir && (
            <>
              <FieldWithAuto
                label="Início da apresentação"
                required
                error={errors.horarioInicio}
                showAuto={showAutoBadge("horarioInicio")}
              >
                <InputHora
                  value={horarioInicio}
                  accent={accent}
                  onChange={(v) => {
                    setHorarioInicio(v);
                    marcarEditado("horarioInicio");
                    setDuracaoOverride(false);
                  }}
                />
              </FieldWithAuto>

              <Field label="Término da apresentação" required error={errors.horarioFim}>
                <InputHora
                  value={horarioFim}
                  accent={accent}
                  onChange={(v) => {
                    setHorarioFim(v);
                    setDuracaoOverride(false);
                  }}
                />
              </Field>
            </>
          )}
          </div>

          {duracaoAuto && (
            <p className="text-xs text-muted sm:col-span-2 -mt-1">
              {t("Duração calculada:")}{" "}
              <span className="font-semibold text-secondary">
                {formatarDuracao(duracaoAuto.horas, duracaoAuto.minutos)}
              </span>
              {duracaoOverride && (
                <span className="ml-2 text-warning">
                  {t("(substituída manualmente — limpe os horários ou ajuste para recalcular)")}
                </span>
              )}
            </p>
          )}
        </div>
      </SectionCard>

      {/* ============ 🎵 SHOW ============ */}
      <SectionCard icon={<Music size={16} />} title={t("Informações do Show")} accent={accent}>
        {/* Artista da agência:
            (1) Vem de orçamento E artistaEfetivoOrc resolveu (bate direto
                OU auto-fix de workspace 1-DJ) → card simples travado.
            (2) Vem de orçamento, artistaEfetivoOrc não resolveu (multi-DJ
                + DJ original deletado) → grid + aviso, força escolha.
            (3) Sem orçamento → grid normal. */}
        {artistaEfetivoOrc ? (
          <FieldWithAuto
            label="Artista da agência (quem vai se apresentar)"
            required
            error={errors.artista}
            showAuto={showAutoBadge("artistaId")}
          >
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-elevated mt-1"
              style={{
                borderColor: accent,
                boxShadow: `0 0 0 1px ${accent}`,
              }}
            >
              <span
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  backgroundColor: artistaEfetivoOrc.color,
                  color: "#fff",
                }}
              >
                {artistaEfetivoOrc.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-primary truncate flex-1">
                {artistaEfetivoOrc.name}
              </span>
            </div>
          </FieldWithAuto>
        ) : (
          <FieldWithAuto
            label="Artista da agência (quem vai se apresentar)"
            required
            error={errors.artista}
            showAuto={showAutoBadge("artistaId")}
          >
            {orc?.artistaId &&
              !artistaDoOrcamento &&
              !artistaAutoFallback &&
              !(artistaId && artistas.some((a) => a.id === artistaId)) && (
                <p
                  className="text-xs mt-1 mb-2"
                  style={{ color: "var(--danger)" }}
                >
                  {t("O artista original do orçamento não está mais ativo. Selecione um substituto abaixo.")}
                </p>
              )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {artistas.map((d) => {
                const isActive = artistaId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDjId(d.id);
                      marcarEditado("artistaId");
                      aplicarRiderVendaDireta(d.id);
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md border bg-elevated transition-all text-left"
                    style={{
                      borderColor: isActive ? accent : "var(--border-color)",
                      boxShadow: isActive
                        ? `0 0 0 1px ${accent}`
                        : undefined,
                    }}
                  >
                    <span
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0"
                      style={{
                        backgroundColor: isActive
                          ? d.color
                          : "var(--bg-surface-2)",
                        color: isActive ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {d.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-primary truncate">
                      {d.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </FieldWithAuto>
        )}

        {/* Line-Up — outros artistas do evento */}
        <div className="mt-5">
          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                <Users size={12} />
                {t("Line-Up")} <span className="text-muted font-normal">{t("(outros artistas do evento)")}</span>
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
                {t("Adicionar")}
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
                    aria-label={t("Remover {nome} do line-up", { nome })}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Cachê + Duração */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end mt-5">
          <FieldWithAuto
            label="Cachê"
            required
            error={errors.cache}
            showAuto={showAutoBadge("cache")}
          >
            <div className="flex items-stretch gap-2">
              {/* Moeda da venda — o símbolo vem ANTES do valor e é o seletor. */}
              <select
                value={moeda}
                onChange={(e) => {
                  moedaTocada.current = true;
                  setMoeda(e.target.value as Moeda);
                }}
                aria-label={t("Moeda")}
                title={t("Moeda")}
                className="campo-input w-auto font-semibold shrink-0"
              >
                {MOEDAS.map((m) => (
                  <option key={m} value={m}>
                    {SIMBOLO_MOEDA[m]}
                  </option>
                ))}
              </select>
              <div className="flex-1">
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
              </div>
            </div>
          </FieldWithAuto>

          {/* Horas + minutos numa célula só → sempre na mesma linha,
              inclusive no mobile (o grid da linha é 1 coluna lá). */}
          <div className="flex items-end gap-3">
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
        </div>

        {cache && (
          <div className="bg-elevated/40 border border-border rounded-md p-3 text-sm mt-4 mb-4">
            <span className="text-muted">{t("Cachê:")}</span>{" "}
            <span className="font-bold text-primary tabular-nums">
              {formatarMoeda(parseValorBR(cache) || 0, moeda)}
            </span>{" "}
            <span className="text-muted">
              {t("por")} {formatarDuracao(duracaoHoras, duracaoMinutos)}
              {artistaSelecionado && (
                <>
                  {" "}{t("para")}{" "}
                  <span className="font-semibold text-primary">
                    {artistaSelecionado.name}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Camarim/Efeitos/Hotel/Logística só aparecem com o artista
            escolhido — os itens vêm do rider DELE (venda direta) ou do
            orçamento (conversão). */}
        {artistaId === null ? (
          <p className="text-xs text-muted mt-4">
            {t("Selecione o artista para ver camarim, efeitos, hotel e logística.")}
          </p>
        ) : (
        <div className="flex flex-col gap-4 mt-4">
          <SubSection
            title={t("Camarim / Consumação")}
            autoBadge={showAutoBadge("camarim")}
            items={camarim}
            onChange={(c) => {
              setCamarim(c);
              marcarEditado("camarim");
            }}
          />
          <SubSection
            title={t("Efeitos")}
            autoBadge={showAutoBadge("efeitos")}
            items={efeitos}
            onChange={(c) => {
              setEfeitos(c);
              marcarEditado("efeitos");
            }}
          />
          <SubSection
            title={t("Hotel")}
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
        )}
      </SectionCard>

      {/* ============ 💳 FORMA DE PAGAMENTO ============ */}
      <SectionCard icon={<CreditCard size={16} />} title={t("Forma de Pagamento")} accent={accent}>
        {/* D5 — parcela com histórico: a seção inteira fica só-leitura. Mexer
            aqui apagaria comprovante/quem-pagou-quando, o motivo do
            cancelamento, o log de cobranças e o 📌. */}
        {temParcelaComHistorico && (
          <div
            className="card mb-4 flex items-start gap-3"
            style={{ borderColor: "var(--warning)", backgroundColor: "var(--warning-weak)" }}
          >
            <Lock size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
            <div className="text-sm text-secondary">
              {t("Esta venda tem parcela com histórico financeiro (paga, cancelada, cobrada ou fixada) — as parcelas não serão recalculadas ao salvar. Se mudar o cachê, revise as parcelas no Financeiro.")}
            </div>
          </div>
        )}
        {/* Escolha: Padrão x Detalhado */}
        <fieldset disabled={temParcelaComHistorico} className="contents">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setModoPagamento("padrao")}
            className="card-interactive flex items-start gap-3 text-left disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="text-sm font-semibold text-primary">{t("Pagamento Padrão")}</div>
              <div className="text-xs text-muted">
                {t("Valor único (100%) com vencimento na data do show")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModoPagamento("detalhado")}
            className="card-interactive flex items-start gap-3 text-left disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="text-sm font-semibold text-primary">{t("Pagamento Detalhado")}</div>
              <div className="text-xs text-muted">
                {t("Divida em parcelas com % ou valor e datas próprias")}
              </div>
            </div>
          </button>
        </div>

        {/* Modo Padrão — resumo simples */}
        {modoPagamento === "padrao" && (
          <div className="bg-elevated/40 border border-border rounded-md p-3 text-sm">
            {cacheNumAtual > 0 ? (
              <>
                <span className="text-muted">{t("Pagamento único de")} </span>
                <span className="font-bold text-primary tabular-nums">
                  {formatarMoeda(cacheNumAtual, moeda)}
                </span>
                <span className="text-muted">
                  {" "}
                  {t("(100%) com vencimento")}{" "}
                  {dataShow ? (
                    <>
                      {t("em")}{" "}
                      <span className="text-primary font-semibold">
                        {new Date(dataShow + "T12:00:00").toLocaleDateString("pt-BR")}
                      </span>{" "}
                      {t("(data do show)")}
                    </>
                  ) : (
                    <span className="text-warning">
                      {t("na data do show — preencha a data do evento acima")}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span className="text-warning">
                {t("Preencha o cachê acima para definir o pagamento.")}
              </span>
            )}
          </div>
        )}

        {/* Modo Detalhado — editor completo de parcelas */}
        {modoPagamento === "detalhado" && (
          <>
            <p className="text-xs text-muted mb-3">
              {t("Divida o cachê em parcelas. Cada parcela tem uma data de vencimento para o controle no Financeiro.")}
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
                moeda={moeda}
              />
            </div>
          </>
        )}
        </fieldset>
      </SectionCard>

      {/* Observações */}
      <SectionCard icon={null} title={t("Observações internas")} accent={accent}>
        <TextArea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={6}
          placeholder="Notas internas sobre a venda (não aparecem em documentos públicos)"
        />
      </SectionCard>

      {/* Ações sticky */}
      {/* `errors.geral` era gravado no catch do handleSubmit mas nunca chegava
          à tela: a venda falhava e o botão só voltava a "Concretizar Venda",
          sem dizer nada. */}
      {errors.geral && (
        <p
          className="text-xs text-danger mt-6 -mb-2 text-right"
          role="alert"
        >
          {errors.geral}
        </p>
      )}
      <div className="sticky bottom-4 mt-6 flex justify-between items-center gap-2 bg-surface border border-border rounded-lg px-4 py-3 shadow-lg">
        <button onClick={onCancel} className="btn btn-secondary">
          <ArrowLeft size={14} />
          {t("Cancelar")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={salvando || !podeSalvar}
          title={!podeSalvar ? "Você não tem permissão para isso." : undefined}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: accent, color: "#fff" }}
        >
          <CheckCircle2 size={14} />
          {emEdicao
            ? salvando
              ? t("Salvando...")
              : t("Salvar alterações")
            : salvando
              ? t("Concretizando...")
              : t("Concretizar Venda")}
        </button>
      </div>

      {divergencias && (
        <DivergenciaContatoModal
          aberto
          nomeContato={nomeContatoDiv}
          divergencias={divergencias}
          cego={divCego}
          onConfirmar={(campos) => fecharDivergencia(campos)}
          onManter={() => fecharDivergencia([])}
          onFechar={() => fecharDivergencia([])}
        />
      )}

      {casaParecida && (
        <CasaParecidaModal
          aberto
          nomeDigitado={casaParecida.nomeDigitado}
          candidatas={casaParecida.candidatas}
          podeRenomear={podeUI(artistaId, "contatos.editar")}
          onEscolher={fecharCasaParecida}
          // Fechar/ESC/clique-fora = "É outro local": o caminho seguro é o de
          // hoje (cria nova). Nunca vincula sem clique explícito.
          onFechar={() => fecharCasaParecida({ tipo: "nova" })}
        />
      )}

      {confirmador}
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
  const t = useT();
  return (
    <label className="flex flex-col gap-1.5" data-has-error={!!error}>
      <span className="text-xs font-medium text-secondary inline-flex items-center gap-2">
        {typeof label === "string" ? t(label) : label}
        {required && <span className="text-danger">*</span>}
        {showAuto && <span className="badge badge-neutral text-[0.55rem] py-0">auto</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{t(error)}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{t(hint)}</span>
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
  const t = useT();
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="stat-label">{t(title)}</span>
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
  const t = useT();
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="stat-label">{t("Logística")}</span>
        {showAuto && <span className="badge badge-neutral text-[0.55rem] py-0">auto</span>}
      </div>
      <p className="text-xs text-muted mb-3">
        {t("Não marque nada se a logística estiver inclusa no cachê.")}
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
          <span className="text-sm flex-1">{t("Logística Aérea (Ida e Volta)")}</span>
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
            <span className="font-medium">{t("Translado Terrestre")}</span>
            <span className="block text-xs text-muted mt-0.5">
              {t("Motorista executivo ou van: Aeroporto → Hotel → Evento → Hotel → Aeroporto")}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
