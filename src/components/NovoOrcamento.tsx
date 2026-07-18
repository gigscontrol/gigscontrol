"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
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
  Users,
  AlertCircle,
  Pencil,
  Zap,
  ClipboardList,
} from "lucide-react";
import PageHeader from "./PageHeader";
import Modal from "./Modal";
import Stepper from "./Stepper";
import QuantitySelector from "./QuantitySelector";
import ExistenteOuNovo from "./ExistenteOuNovo";
import ContratanteBuscaModal from "./ContratanteBuscaModal";
import DivergenciaContatoModal, { type Divergencia } from "./DivergenciaContatoModal";
import { useAviso, useConfirmar } from "./ConfirmarModal";
import CasaParecidaModal, {
  type CasaCandidata,
  type EscolhaCasaParecida,
} from "./CasaParecidaModal";
import HistoricoContratante from "./HistoricoContratante";
import PhoneInput, { DEFAULT_COUNTRY, contarDigitos, type Country } from "./PhoneInput";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "./CidadeGlobalAutocomplete";
import InputHora from "./inputs/InputHora";
import InputDataBR from "./inputs/InputDataBR";
import { resolverCidade } from "@/lib/cidade-helpers";
import { normalizar } from "@/lib/normalizar";
import { itensDoRider } from "@/lib/rider";
import { parseValorBR } from "@/lib/valor";
import { exemploEndereco } from "@/lib/data/exemplos";
import { Field, TextInput, TextArea, Select } from "./Field";
import { useContatos } from "@/lib/contatos-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useArtistas, useWorkspace } from "@/lib/workspace-context";
import { moedaValida } from "@/lib/mappers/venda";
import { SIMBOLO_MOEDA, formatarMoeda } from "@/lib/formatters";
import { useAuth } from "@/lib/auth-context";
import { gerarTextoWhatsApp, montarLinkWhatsApp, formatBRL, formatarDuracao } from "@/lib/whatsapp";
import { montarTelefoneE164 } from "@/lib/data/countries";
import { canonicalizarTelefoneBR, telefonesIguais } from "@/lib/telefone";
import {
  CATALOGO_CAMARIM,
  CATALOGO_EFEITOS,
  CATALOGO_HOTEL,
  LABELS_TIPO_EVENTO,
  LOGISTICA_VAZIA,
  MODULE_THEMES,
  TIPO_CASA_POR_EVENTO,
  MOEDAS,
  type ItemQuantidade,
  type LogisticaSelecao,
  type TipoEvento,
  type Artista,
  type Contratante,
  type DetalhesEvento,
  type Moeda,
} from "@/types";
import type { ContratanteInput, CasaInput, CidadeInput } from "@/lib/orcamentos-context";

type Props = {
  onSaved: (orcamentoIds: string[]) => void;
  onCancel: () => void;
  onDone: () => void;
};

/** Card picker das 3 categorias — reusado pelo ConcretizarVenda (mesmas opções). */
export const TIPOS_EVENTO: { value: TipoEvento; label: string; icon: typeof PartyPopper; desc: string }[] = [
  {
    value: "social",
    label: LABELS_TIPO_EVENTO.social,
    icon: PartyPopper,
    desc: "Festa privada, aniversário, casamento",
  },
  { value: "casa-noturna", label: LABELS_TIPO_EVENTO["casa-noturna"], icon: Building2, desc: "Club, bar, balada" },
  { value: "festival", label: LABELS_TIPO_EVENTO.festival, icon: Sparkles, desc: "Festival, arena, evento grande" },
];

type DjBlock = {
  artistaId: string;
  valorCache: string;
  duracaoHoras: number;
  duracaoMinutos: number;
  camarim: ItemQuantidade[];
  efeitos: ItemQuantidade[];
  hotel: ItemQuantidade[];
  logistica: LogisticaSelecao;
  /** Texto livre opcional anexado ao fim do orçamento deste artista. */
  infoExtra: string;
};

function novoBlocoDj(artistaId: string): DjBlock {
  return {
    artistaId,
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

/** Patch de bloco ao escolher um artista: id + Camarim/Efeitos do rider DELE. */
function patchDoArtista(artista: Artista | undefined, artistaId: string): Partial<DjBlock> {
  return {
    artistaId,
    camarim: itensDoRider(artista?.riderCamarim, CATALOGO_CAMARIM),
    efeitos: itensDoRider(artista?.riderEfeitos, CATALOGO_EFEITOS),
  };
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

export default function NovoOrcamento({ onSaved, onCancel, onDone }: Props) {
  const t = useT();
  const accent = MODULE_THEMES.vendas.color;
  const { contratantes, updateContratante, casas, addCasa, updateCasa, cidades } =
    useContatos();
  const { criarOrcamentoComContatos } = useOrcamentos();
  const artistas = useArtistas();
  const { preferencias } = useWorkspace();
  // Moeda do orçamento (um evento = uma moeda). Nasce na moeda da agência.
  const moedaAgencia = moedaValida(preferencias.moeda);
  const [moeda, setMoeda] = useState<Moeda>(moedaAgencia);
  const moedaTocada = useRef(false);
  useEffect(() => {
    // Segue a agência quando as prefs terminam de carregar, até o usuário escolher.
    if (!moedaTocada.current) setMoeda(moedaAgencia);
  }, [moedaAgencia]);
  const { podeUI } = useAuth();
  const { confirmar, confirmador } = useConfirmar();
  const { avisar, avisador } = useAviso();

  const [step, setStep] = useState(1);

  // ----- ETAPA 1 -----
  const [tipoEvento, setTipoEvento] = useState<TipoEvento | null>(null);
  const [contratanteMode, setContratanteMode] = useState<"existente" | "novo">("novo");
  const [contratanteId, setContratanteId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [telDigits, setTelDigits] = useState("");
  // Quando o telefone "novo" bate com um contato já cadastrado e o usuário opta
  // por reusá-lo (corrigindo o nome) — guarda o id, sem criar duplicado.
  const [vinculadoId, setVinculadoId] = useState<string | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [cidadeIbge, setCidadeIbge] = useState<CidadeEscolhida | null>(null);

  // Orçamento simples (padrão) x detalhado. No detalhado capturamos infos do
  // evento que NÃO vão pro WhatsApp — ficam salvas pra pré-preencher a venda.
  const [modoOrcamento, setModoOrcamento] = useState<"simples" | "detalhado">("simples");
  const [evNome, setEvNome] = useState("");
  const [evInstagram, setEvInstagram] = useState("");
  const [evLocal, setEvLocal] = useState("");
  const [evCapacidade, setEvCapacidade] = useState("");
  const [evEndereco, setEvEndereco] = useState("");
  const [evData, setEvData] = useState("");
  const [evInicio, setEvInicio] = useState("");
  const [evFim, setEvFim] = useState("");
  // Padrão = DIA SEGUINTE (pedido do dono): show que vira a madrugada é a
  // regra do negócio, não a exceção. O usuário desmarca quando for mesmo-dia.
  const [evTerminoDiaSeguinte, setEvTerminoDiaSeguinte] = useState(true);

  // ----- ETAPA 2 -----
  const [blocos, setBlocos] = useState<DjBlock[]>([novoBlocoDj("")]);
  const [modalAddDj, setModalAddDj] = useState(false);

  // O bloco inicial nasce com artistaId "" (vazio) DE PROPÓSITO: ao entrar na
  // etapa 2, o usuário escolhe o 1º artista no MESMO popup de seleção (em vez
  // de um dropdown pré-selecionado). NÃO pré-selecionar o primeiro da lista.

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ------- Popup de divergência do contato (D2) -------
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

  // Trava o submit: um 2º clique com o popup aberto sobrescreveria o ref de
  // resposta (Promise pendurada) e ainda criaria orçamento duplicado.
  const [salvando, setSalvando] = useState(false);

  // Tela 3
  const [salvos, setSalvos] = useState<Array<{
    id: string;
    numero: string;
    artistaNome: string;
    artistaCor: string;
    telefoneE164: string;
    texto: string;
    linkWA: string;
  }> | null>(null);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!tipoEvento) errs.tipoEvento = t("Selecione o tipo de evento");
    if (contratanteMode === "existente") {
      if (!contratanteId) errs.contratante = t("Selecione um contratante");
    } else {
      if (!novoNome.trim()) errs.contratanteNome = t("Nome obrigatório");
      const dig = contarDigitos(telDigits);
      if (dig === 0) errs.contratanteTel = t("Telefone obrigatório");
      else if (dig < country.minDigits) errs.contratanteTel = t("Faltam dígitos");
    }
    if (!cidadeIbge) errs.cidade = t("Selecione a cidade do evento");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    blocos.forEach((b, i) => {
      if (!b.artistaId) errs[`artista-${i}`] = t("Selecione um artista");
      const valor = parseValorBR(b.valorCache);
      if (!b.valorCache || isNaN(valor) || valor <= 0) errs[`valor-${i}`] = t("Valor obrigatório");
      if (b.duracaoHoras < 1 && b.duracaoMinutos < 15) errs[`dur-${i}`] = t("Duração mínima 15 min");
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validateStep1()) return;
    setStep(2);
    // Antes de iniciar de fato a etapa 2, escolhe o 1º artista no mesmo popup
    // de seleção (mesmo design de "Adicionar artista ao orçamento").
    if (blocos.length === 1 && !blocos[0].artistaId && artistas.length > 0) {
      setModalAddDj(true);
    }
  }
  function handleBack() {
    setStep(1);
    setErrors({});
  }

  function adicionarDj(artistaId: string) {
    // Escolher o artista puxa o RIDER dele (camarim/efeitos) pro bloco.
    const patch = patchDoArtista(artistas.find((d) => d.id === artistaId), artistaId);
    setBlocos((prev) => {
      // 1ª seleção: preenche o bloco inicial ainda vazio em vez de criar outro.
      const idxVazio = prev.findIndex((b) => !b.artistaId);
      if (idxVazio !== -1) {
        return prev.map((b, i) => (i === idxVazio ? { ...b, ...patch } : b));
      }
      return [...prev, { ...novoBlocoDj(""), ...patch }];
    });
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
    // Canônico: completa o nono dígito BR faltante — grava e compara na mesma forma.
    if (contratanteMode === "novo")
      return canonicalizarTelefoneBR(montarTelefoneE164(country, telDigits));
    const c = contratantes.find((x) => x.id === contratanteId);
    return c?.telefone ?? "";
  }

  /** Contato já cadastrado com o telefone digitado (modo novo) — evita duplicar. */
  function contratanteDuplicado(): Contratante | null {
    if (contratanteMode !== "novo" || vinculadoId) return null;
    if (contarDigitos(telDigits) < country.minDigits) return null;
    const e164 = montarTelefoneE164(country, telDigits);
    // telefonesIguais atravessa a formatação: com/sem 9, com/sem DDI —
    // registro antigo sem o nono dígito continua sendo o MESMO contato.
    return contratantes.find((c) => telefonesIguais(c.telefone, e164)) ?? null;
  }

  /** Usa o contato existente como está (passa pro modo "existente"). */
  function usarContratanteExistente(c: Contratante) {
    setContratanteMode("existente");
    setContratanteId(c.id);
    setVinculadoId(null);
    setErrors((p) => ({
      ...p,
      contratanteNome: "",
      contratanteTel: "",
      contratante: "",
    }));
  }

  /** Reusa o contato existente (sem duplicar), mas deixa corrigir o nome. */
  function usarEVincular(c: Contratante) {
    setVinculadoId(c.id);
    setNovoNome(c.nome);
    setErrors((p) => ({ ...p, contratanteNome: "" }));
  }

  /**
   * Monta os detalhes do evento (orçamento detalhado). Só inclui os campos
   * preenchidos; retorna undefined no modo simples ou se nada foi informado.
   */
  function montarDetalhesEvento(): DetalhesEvento | undefined {
    if (modoOrcamento !== "detalhado") return undefined;
    const d: DetalhesEvento = {};
    if (evNome.trim()) d.nomeEvento = evNome.trim();
    if (evInstagram.trim()) d.instagram = evInstagram.trim();
    if (evLocal.trim()) d.nomeLocal = evLocal.trim();
    const cap = parseInt(evCapacidade.replace(/\D/g, ""), 10);
    if (!isNaN(cap) && cap > 0) d.capacidade = cap;
    if (evEndereco.trim()) d.enderecoLocal = evEndereco.trim();
    if (evData) d.dataShow = evData;
    if (evInicio) d.horarioInicio = evInicio;
    if (evFim) d.horarioFim = evFim;
    if (evFim && evTerminoDiaSeguinte) d.terminoDiaSeguinte = true;
    return Object.keys(d).length > 0 ? d : undefined;
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
   * "Manter") preserva o cadastro. Espelha o ConcretizarVenda.
   *
   * Best-effort: casa oculta (PATCH 404) ou sem permissão não pode custar o
   * orçamento — o tipo é enriquecimento, não o valor da operação.
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
        'O local "{local}" está cadastrado como "Outro". Mudar a categoria dele para "{categoria}"? Isso vale para todos os shows deste local, não só para este orçamento.',
        { local: casa.nome, categoria: t(LABELS_TIPO_EVENTO[tipoEvento]) }
      ),
      confirmarLabel: t("Mudar categoria"),
      cancelarLabel: t("Manter como está"),
    });
    if (!ok) return;
    try {
      await updateCasa(casaId, { tipo: TIPO_CASA_POR_EVENTO[tipoEvento] });
    } catch {
      /* segue: a casa fica sem categoria, o orçamento não */
    }
  }

  /**
   * D4 — casa do evento (dedupe por nome normalizado + cidade). O endpoint é
   * obrigatório no caminho: `casas` do contexto é filtrado por visibilidade
   * derivada, então pro artista o dedupe local é cego e ele recriaria a casa.
   * Best-effort: falhar aqui não bloqueia o orçamento (fica sem casa).
   */
  async function resolverCasaId(cidadeId: string): Promise<string | undefined> {
    const nome = evLocal.trim();
    if (!nome || !cidadeId) return undefined;
    try {
      const alvo = normalizar(nome);
      const local = casas.find(
        (c) => normalizar(c.nome) === alvo && c.cidadeId === cidadeId
      );
      if (local) return local.id;

      const resp = await fetch(
        `/api/contatos/casas/existe?nome=${encodeURIComponent(nome)}&cidade_id=${encodeURIComponent(cidadeId)}`
      );
      // Endpoint fora do ar = dedupe cego, mas aqui NÃO existe casa anterior pra
      // degradar (diferente do ConcretizarVenda, que cai no `orc?.casaId`):
      // abortar deixaria o orçamento SEM casa nenhuma em silêncio, perdendo o
      // vínculo que o fluxo veio criar. Segue pro addCasa — no pior caso nasce
      // uma duplicata visível, que é melhor que um orçamento sem local.
      if (resp.ok) {
        const j = await resp.json();
        if (j?.existe && j.casa?.id) return j.casa.id as string;
      }

      // Sem match EXATO: pode existir casa PARECIDA na mesma cidade ("Downtown"
      // cadastrado, digitou "Downtown Urban Club"). Busca best-effort num
      // try/catch PRÓPRIO — falhar aqui degrada pro fluxo de hoje (cria nova).
      let candidatas: CasaCandidata[] = [];
      try {
        const r2 = await fetch(
          `/api/contatos/casas/parecidas?nome=${encodeURIComponent(nome)}&cidade_id=${encodeURIComponent(cidadeId)}&endereco=${encodeURIComponent(evEndereco.trim())}`
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
            // Best-effort: casa oculta (PATCH 404) ou sem permissão não pode
            // custar o VÍNCULO, que é o valor real.
            try {
              await updateCasa(escolha.casaId, { nome: escolha.renomearPara });
            } catch {
              /* rename falhou → vincula assim mesmo */
            }
          }
          return escolha.casaId;
        }
      }

      // Casa NÃO tem telefone (o telefone é do contratante, não do local).
      const cap = parseInt(evCapacidade.replace(/\D/g, ""), 10);
      const nova = await addCasa({
        nome,
        tipo: tipoEvento ? TIPO_CASA_POR_EVENTO[tipoEvento] : "outro",
        cidadeId,
        endereco: evEndereco.trim() || undefined,
        capacidade: !isNaN(cap) && cap > 0 ? cap : undefined,
      });
      return nova.id;
    } catch {
      return undefined;
    }
  }

  // ----- Salvar todos os blocos -----
  async function handleSubmit() {
    // Guard de reentrada: o submit é async e ainda pode PARAR num popup
    // (divergência / local parecido). Sem o guard, um 2º clique sobrescreve o
    // ref de resposta — Promise pendurada + orçamento duplicado.
    if (salvando) return;
    setSalvando(true);
    try {
      await submeter();
    } finally {
      setSalvando(false);
    }
  }

  async function submeter() {
    if (!validateStep1()) { setStep(1); return; }
    if (!validateStep2()) return;
    if (!tipoEvento || !cidadeIbge) return;

    // Resolve a cidade IBGE → UUID local (cria se ainda não existe;
    // geocoda lat/lng via OSM no caminho).
    let cidadeResolvida;
    try {
      cidadeResolvida = await resolverCidade(cidadeIbge);
    } catch (e) {
      setErrors((p) => ({ ...p, cidade: (e as Error).message }));
      return;
    }

    let vinculoResolvido = vinculadoId;
    // Dados do contato vinculado quando ele NÃO está na lista local (contato
    // OCULTO por visibilidade derivada, vindo do endpoint).
    let alvoRemoto: { nome: string; cidadeId: string } | null = null;

    // "Cada telefone = 1 contato" (D1): antes de criar, procura pelo telefone —
    // primeiro local, depois no backend (workspace inteiro, enxerga contato
    // OCULTO por visibilidade derivada). Achou → REUSA, jamais duplica (D2).
    // One-shot no submit (sem efeito/lifecycle). Rede falha → segue.
    if (
      contratanteMode === "novo" &&
      !vinculoResolvido &&
      contarDigitos(telDigits) >= country.minDigits
    ) {
      const e164 = montarTelefoneE164(country, telDigits);
      const localMatch = contratantes.find((c) => c.telefone === e164);
      if (localMatch) {
        // O banner de duplicata da etapa 1 oferece isso, mas ignorá-lo não pode
        // criar um contato com telefone repetido.
        vinculoResolvido = localMatch.id;
      } else {
        // Sem a resposta do endpoint não existe dedupe possível: o contexto
        // local é cego pra contato fora da visibilidade derivada. Seguir e
        // criar "no escuro" duplicaria o telefone (quebra D1) — e duplicata de
        // contato é dor de cabeça manual pra desfazer. Então: erro claro e
        // retentável, em vez de sujeira silenciosa no cadastro.
        let checou = false;
        try {
          const resp = await fetch(
            `/api/contatos/contratantes/existe?telefone=${encodeURIComponent(e164)}`
          );
          if (resp.ok) {
            const j = await resp.json();
            checou = true;
            if (j?.existe && j.contratante?.id) {
              vinculoResolvido = j.contratante.id as string;
              alvoRemoto = {
                nome: (j.contratante.nome as string) ?? "",
                cidadeId: (j.contratante.cidade_id as string) ?? "",
              };
            }
          }
        } catch {
          /* rede caiu → `checou` segue false */
        }
        if (!checou) {
          setErrors((p) => ({
            ...p,
            contratanteTel: t(
              "Não foi possível verificar se esse telefone já tem cadastro. Tente de novo."
            ),
          }));
          setStep(1);
          return;
        }
      }
    }

    // Telefone "novo" vinculado a um contato existente: reusa o id (sem
    // duplicar). Se o nome digitado diverge do cadastro, PERGUNTA (D2) — nunca
    // sobrescreve calado. Cadastro sem nome → backfill silencioso.
    if (contratanteMode === "novo" && vinculoResolvido) {
      const existente = contratantes.find((c) => c.id === vinculoResolvido);
      const nomeAtual = existente?.nome ?? alvoRemoto?.nome ?? "";
      const nomeDigitado = novoNome.trim();
      let gravarNome = false;
      if (nomeDigitado && nomeAtual && nomeDigitado !== nomeAtual) {
        const aceitos = await perguntarDivergencias(nomeAtual, [
          { campo: "nome", rotulo: t("Nome"), atual: nomeAtual, novo: nomeDigitado },
        ]);
        gravarNome = aceitos.includes("nome");
      } else if (nomeDigitado && !nomeAtual) {
        gravarNome = true;
      }
      if (gravarNome) {
        try {
          await updateContratante(vinculoResolvido, { nome: nomeDigitado });
        } catch {
          /* contato oculto (PATCH 404) ou falha → não bloqueia o orçamento */
        }
      }
    }

    // D5 — cidade do contratante REUSADO: backfill só se o cadastro não tem
    // (o cidade_id alimenta geocode/mapa, não deve pular a cada orçamento).
    const alvoReuso =
      vinculoResolvido ?? (contratanteMode === "existente" ? contratanteId : null);
    if (alvoReuso) {
      const existente = contratantes.find((c) => c.id === alvoReuso);
      const temCidade = existente ? !!existente.cidadeId : !!alvoRemoto?.cidadeId;
      if (!temCidade) {
        try {
          await updateContratante(alvoReuso, { cidadeId: cidadeResolvida.id });
        } catch {
          /* contato oculto (PATCH 404) → best-effort, não bloqueia */
        }
      }
    }

    const contratanteInputInicial: ContratanteInput =
      contratanteMode === "existente"
        ? { tipo: "existente", id: contratanteId! }
        : vinculoResolvido
          ? { tipo: "existente", id: vinculoResolvido }
          : {
              tipo: "novo",
              dados: {
                nome: novoNome,
                telefone: montarTelefoneE164(country, telDigits),
              },
            };

    // D4 — a casa de shows nasce junto (antes o local só existia como texto).
    // Resolvida UMA VEZ, ANTES do loop de blocos: cada artista gera um
    // orçamento, e resolver dentro do loop criaria N casas idênticas.
    // Só no detalhado: no simples não há nome de local (nasceria casa sem nome).
    let casaInput: CasaInput = { tipo: "nenhuma" };
    if (modoOrcamento === "detalhado" && evLocal.trim()) {
      const casaId = await resolverCasaId(cidadeResolvida.id);
      if (casaId) {
        casaInput = { tipo: "existente", id: casaId };
        await backfillTipoCasa(casaId);
      }
    }

    const cidadeInputInicial: CidadeInput = {
      tipo: "existente",
      id: cidadeResolvida.id,
    };

    const resultados: NonNullable<typeof salvos> = [];
    let contratanteIdResolvido: string | null = null;
    let cidadeIdResolvido: string | null = null;

    // Mesmos detalhes de evento pra todos os artistas — o evento é o mesmo, muda só o artista.
    const detalhesEvento = montarDetalhesEvento();

    // for-of sequencial — precisamos resolver contratante/cidade do bloco 0
    // antes de criar os próximos, e cada criação é async (API).
    for (let idx = 0; idx < blocos.length; idx++) {
      const b = blocos[idx];
      const valor = parseValorBR(b.valorCache);

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
        artistaId: b.artistaId,
        valorCache: valor,
        moeda,
        duracaoHoras: b.duracaoHoras,
        duracaoMinutos: b.duracaoMinutos > 0 ? b.duracaoMinutos : undefined,
        camarim: b.camarim,
        efeitos: b.efeitos,
        hotel: b.hotel,
        logistica: b.logistica,
        infoExtra: b.infoExtra.trim() || undefined,
        detalhesEvento,
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
      const artista = artistas.find((d) => d.id === b.artistaId);
      const e164 = getTelefoneSelecionadoE164();
      const texto = gerarTextoWhatsApp(orc, { cidade: cidadeObj, artista });

      resultados.push({
        id: orc.id,
        numero: orc.numero,
        artistaNome: artista?.name ?? "—",
        artistaCor: artista?.color ?? "#888",
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
        avisar(t("Não foi possível copiar."));
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
              : "Um orçamento por artista — envie cada um separadamente"
          }
          accentColor={accent}
        />

        {salvos.map((s, idx) => (
          <div key={s.id} className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${s.artistaCor}25`, color: s.artistaCor }}
                >
                  <User size={14} />
                </div>
                <span className="text-sm font-semibold text-primary truncate">{s.artistaNome}</span>
                <span className="text-xs font-mono tabular-nums" style={{ color: accent }}>
                  {s.numero}
                </span>
              </div>
            </div>

            <div className="card mb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="section-title text-sm">{t("Mensagem")}</div>
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
                      {t("Copiado!")}
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      {t("Copiar")}
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
                {t("Enviar pelo WhatsApp")}
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
                {salvos.length > 1 ? t("Códigos criados") : t("Código criado")}
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
            {t("Concluir")}
          </button>
        </div>

        {salvos[0]?.telefoneE164 && (
          <div className="mt-3 text-xs text-muted">
            {t("Destino:")}{" "}<strong>+{salvos[0].telefoneE164}</strong>
          </div>
        )}

        {avisador}
      </div>
    );
  }

  // ============ WIZARD ============
  const djsDisponiveis = artistas.filter((d) => !blocos.some((b) => b.artistaId === d.id));

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Novo Orçamento"
        subtitle="Você pode incluir mais de um artista — cada um gera um orçamento próprio"
        accentColor={accent}
        actions={
          <button onClick={onCancel} className="btn btn-ghost">
            {t("Cancelar")}
          </button>
        }
      />

      <Stepper
        steps={[
          { num: 1, label: t("Contato") },
          { num: 2, label: t("Orçamento") },
        ]}
        current={step}
        accent={accent}
      />

      {/* ============ ETAPA 1 ============ */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          {/* Modo do orçamento: simples (padrão) x detalhado */}
          <div className="card">
            <div className="section-title mb-3">{t("Tipo de orçamento")}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  value: "simples" as const,
                  icon: Zap,
                  label: "Orçamento simples",
                  desc: "Rápido — contato, cidade e valores. O que você já usa hoje.",
                },
                {
                  value: "detalhado" as const,
                  icon: ClipboardList,
                  label: "Orçamento detalhado",
                  desc: "Inclui infos do evento (local, data, horários) pra pré-preencher a venda.",
                },
              ].map(({ value, icon: Icon, label, desc }) => {
                const isActive = modoOrcamento === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setModoOrcamento(value)}
                    className="card-interactive flex items-start gap-3 text-left"
                    style={{
                      borderColor: isActive ? accent : undefined,
                      boxShadow: isActive ? `0 0 0 1px ${accent}` : undefined,
                    }}
                  >
                    <div
                      className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
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
          </div>

          <div className="card">
            <div className="section-title mb-3">
              {t("Tipo de evento")} <span className="text-danger">*</span>
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
                      <div className="text-sm font-semibold text-primary">{t(label)}</div>
                      <div className="text-xs text-muted">{t(desc)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.tipoEvento && <p className="text-xs text-danger mt-2">{errors.tipoEvento}</p>}
          </div>

          <div className="card">
            <ExistenteOuNovo
              label={t("Contratante")}
              required
              options={contratantes.map((c) => {
                const cid = cidades.find(
                  (x) => String(x.id) === String(c.cidadeId)
                );
                const sub = [c.telefone ? `+${c.telefone}` : null, cid?.nome]
                  .filter(Boolean)
                  .join(" · ");
                return { id: c.id, label: c.nome, sublabel: sub || undefined };
              })}
              selectedId={contratanteId}
              onSelectExisting={(id) => setContratanteId(id)}
              mode={contratanteMode}
              newLabel={t("Novo contratante")}
              onSwitchToNew={() => setContratanteMode("novo")}
              onPesquisaAvancada={() => setBuscaAberta(true)}
              newFormChildren={(() => {
                const dup = contratanteDuplicado();
                const vinc = vinculadoId
                  ? contratantes.find((c) => c.id === vinculadoId)
                  : null;
                return (
                  <>
                    {vinc && (
                      <div
                        className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
                        style={{
                          borderColor: `${accent}55`,
                          backgroundColor: `${accent}14`,
                        }}
                      >
                        <Check
                          size={14}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: accent }}
                        />
                        <span className="flex-1 text-secondary">
                          {t("Vinculado ao contato")}{" "}
                          <strong className="text-primary">{vinc.nome}</strong> {t("— sem criar duplicado. Corrija o nome abaixo se precisar (será atualizado no contato).")}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setVinculadoId(null);
                            setNovoNome("");
                            setTelDigits("");
                          }}
                          className="btn-ghost rounded px-1.5 py-0.5 text-xs flex-shrink-0"
                        >
                          {t("Desvincular")}
                        </button>
                      </div>
                    )}

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
                          onChange={(v) => {
                            setTelDigits(v);
                            if (vinculadoId) setVinculadoId(null);
                          }}
                          error={errors.contratanteTel}
                        />
                      </Field>
                    </div>

                    {dup && (
                      <div
                        className="rounded-md border px-3 py-2.5"
                        style={{
                          borderColor: "var(--warning)",
                          backgroundColor: "rgba(245,158,11,0.08)",
                        }}
                      >
                        <div className="flex items-start gap-2 text-xs text-secondary">
                          <AlertCircle
                            size={14}
                            className="flex-shrink-0 mt-0.5"
                            style={{ color: "var(--warning)" }}
                          />
                          <span>
                            {t("Esse número já está cadastrado como")}{" "}
                            <strong className="text-primary">{dup.nome}</strong>. {t("Quer usar esse contato em vez de criar outro?")}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={() => usarContratanteExistente(dup)}
                            className="btn btn-secondary text-xs py-1.5"
                          >
                            <Check size={13} /> {t("Usar {nome}", { nome: dup.nome })}
                          </button>
                          <button
                            type="button"
                            onClick={() => usarEVincular(dup)}
                            className="btn-ghost text-xs py-1.5 inline-flex items-center gap-1.5"
                          >
                            <Pencil size={13} /> {t("Usar e corrigir o nome")}
                          </button>
                        </div>
                      </div>
                    )}

                    {!vinculadoId && (
                      <button
                        type="button"
                        onClick={() => setContratanteMode("existente")}
                        className="btn btn-secondary w-full justify-center text-sm"
                      >
                        <Users size={15} /> {t("Usar um contratante já cadastrado")}
                      </button>
                    )}
                  </>
                );
              })()}
            />
            {errors.contratante && <p className="text-xs text-danger mt-2">{errors.contratante}</p>}
            {/* Passo 2 — histórico comercial do contratante (só quando existente). */}
            {contratanteMode === "existente" && (
              <HistoricoContratante contratanteId={contratanteId} />
            )}
          </div>

          <ContratanteBuscaModal
            isOpen={buscaAberta}
            onClose={() => setBuscaAberta(false)}
            contratantes={contratantes}
            cidades={cidades}
            selectedId={contratanteId}
            onSelect={(id) => {
              setContratanteMode("existente");
              setContratanteId(id);
              setVinculadoId(null);
              setBuscaAberta(false);
            }}
          />

          {/* Cidade — no modo simples fica num card próprio; no detalhado ela
              entra no painel "Informações do Evento" (abaixo), pra ser um só. */}
          {modoOrcamento === "simples" && (
            <div className="card">
              <div className="section-title mb-3">
                {t("Cidade do evento")} <span className="text-danger">*</span>
              </div>
              <CidadeGlobalAutocomplete
                value={cidadeIbge}
                onChange={(c) => {
                  setCidadeIbge(c);
                  if (c) setErrors((p) => ({ ...p, cidade: "" }));
                }}
                placeholder={t("Ex: São Paulo, Belo Horizonte...")}
              />
              {errors.cidade && (
                <p className="text-xs text-danger mt-1">{errors.cidade}</p>
              )}
            </div>
          )}

          {/* Informações do Evento — só no modo detalhado. Inclui a cidade
              (obrigatória) no topo + campos opcionais que não vão pro WhatsApp. */}
          {modoOrcamento === "detalhado" && (
            <div className="card">
              <div className="section-title mb-1">{t("Informações do Evento")}</div>
              <p className="text-xs text-muted mb-4">
                {t("A cidade é obrigatória. Os demais campos são opcionais e não aparecem no WhatsApp — ficam salvos pra pré-preencher a venda.")}
              </p>

              <div className="mb-3">
                <Field label="Cidade do evento" required error={errors.cidade}>
                  <CidadeGlobalAutocomplete
                    value={cidadeIbge}
                    onChange={(c) => {
                      setCidadeIbge(c);
                      if (c) setErrors((p) => ({ ...p, cidade: "" }));
                    }}
                    placeholder={t("Ex: São Paulo, Belo Horizonte...")}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome do evento">
                  <TextInput
                    value={evNome}
                    onChange={(e) => setEvNome(e.target.value)}
                    placeholder="Ex: Réveillon 2027"
                  />
                </Field>
                <Field label="@ Instagram do evento">
                  <TextInput
                    value={evInstagram}
                    onChange={(e) => setEvInstagram(e.target.value)}
                    placeholder="@nomedoevento"
                  />
                </Field>
                <Field label="Nome do local">
                  <TextInput
                    value={evLocal}
                    onChange={(e) => setEvLocal(e.target.value)}
                    placeholder="Ex: Club XYZ"
                  />
                </Field>
                <Field label="Capacidade do público">
                  <TextInput
                    type="text"
                    inputMode="numeric"
                    value={evCapacidade}
                    onChange={(e) => setEvCapacidade(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ex: 500"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Endereço do local">
                    <TextInput
                      value={evEndereco}
                      onChange={(e) => setEvEndereco(e.target.value)}
                      placeholder={exemploEndereco(cidadeIbge?.pais ?? "BR")}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Data do evento">
                    <InputDataBR value={evData} onChange={setEvData} />
                  </Field>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-secondary">
                      {t("Data da apresentação")}
                    </span>
                    <div className="flex w-full overflow-hidden rounded-md border border-border bg-elevated">
                      {[
                        { v: false, label: "Mesmo dia do evento" },
                        { v: true, label: "Dia seguinte ao evento" },
                      ].map((opt, i) => {
                        const ativo = evTerminoDiaSeguinte === opt.v;
                        return (
                          <button
                            key={String(opt.v)}
                            type="button"
                            aria-pressed={ativo}
                            onClick={() => setEvTerminoDiaSeguinte(opt.v)}
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
                      {evData
                        ? t("Apresentação em {data}.", { data: formatarDataOffset(evData, evTerminoDiaSeguinte ? 1 : 0) })
                        : t("Dia seguinte = vira a madrugada (depois da meia-noite).")}
                    </span>
                  </div>
                  <Field label="Início da apresentação">
                    <InputHora value={evInicio} onChange={setEvInicio} accent={accent} />
                  </Field>
                  <Field label="Término da apresentação">
                    <InputHora value={evFim} onChange={setEvFim} accent={accent} />
                  </Field>
                </div>
              </div>
            </div>
          )}
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
              moeda={moeda}
              onMoedaChange={(m) => {
                moedaTocada.current = true;
                setMoeda(m);
              }}
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
              {t("Adicionar outro artista ao orçamento")}
              <span className="text-xs text-muted font-normal">
                {t("· gera um orçamento separado")}
              </span>
            </button>
          )}

          {/* Modal de seleção de artista — via Portal */}
          <Modal
            isOpen={modalAddDj}
            onClose={() => setModalAddDj(false)}
            title={t("Adicionar artista ao orçamento")}
            subtitle={t("Cada artista gera um orçamento separado (ORC-XXXX)")}
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
          {step === 1 ? t("Cancelar") : t("Voltar")}
        </button>

        {step === 1 ? (
          <button onClick={handleNext} className="btn btn-primary">
            {t("Próximo")}
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={
              salvando ||
              blocos.every((b) => !podeUI(b.artistaId || null, "vendas.criar_orcamento"))
            }
            title={
              blocos.every((b) => !podeUI(b.artistaId || null, "vendas.criar_orcamento"))
                ? "Você não tem permissão para isso."
                : undefined
            }
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: accent, color: "#fff" }}
          >
            <Save size={14} />
            {blocos.length > 1
              ? t("Salvar {n} orçamentos", { n: blocos.length })
              : t("Salvar orçamento")}
          </button>
        )}
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

      {confirmador}

      {casaParecida && (
        <CasaParecidaModal
          aberto
          nomeDigitado={casaParecida.nomeDigitado}
          candidatas={casaParecida.candidatas}
          // O rename é best-effort e o enforcement real é do servidor; gateia
          // pelo artista do 1º bloco (o evento é o mesmo pra todos).
          podeRenomear={podeUI(blocos[0]?.artistaId || null, "contatos.editar")}
          onEscolher={fecharCasaParecida}
          // Fechar/ESC/clique-fora = "É outro local": o caminho seguro é o de
          // hoje (cria nova). Nunca vincula sem clique explícito.
          onFechar={() => fecharCasaParecida({ tipo: "nova" })}
        />
      )}
    </div>
  );
}

// ============ Bloco de Artista ============

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
  moeda,
  onMoedaChange,
}: {
  bloco: DjBlock;
  indice: number;
  totalBlocos: number;
  accent: string;
  artistas: Artista[];
  onChange: (patch: Partial<DjBlock>) => void;
  onRemove: () => void;
  moeda: Moeda;
  onMoedaChange: (m: Moeda) => void;
  errors: Record<string, string>;
  ufCidade?: string;
  nomeCidade?: string;
  tipoEvento: TipoEvento | null;
}) {
  const t = useT();
  const artista = artistas.find((d) => d.id === bloco.artistaId);
  const valor = parseValorBR(bloco.valorCache);

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface overflow-hidden">
      {/* Cabeçalho com cor do artista */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border"
        style={{
          background: artista
            ? `linear-gradient(90deg, ${artista.color}15 0%, transparent 60%)`
            : "var(--bg-surface-2)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: artista?.color ?? "var(--bg-elevated)", color: "#fff" }}
          >
            {indice + 1}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary truncate">
              {artista?.name ?? "—"}
            </div>
            <div className="text-[0.7rem] text-muted">
              {t("Orçamento {n} de {m}", { n: indice + 1, m: totalBlocos })}
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
            {t("Remover")}
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Artista + Valor + Duração */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <Field label="Artista" required error={errors[`artista-${indice}`]}>
            <Select
              value={bloco.artistaId}
              onChange={(e) => {
                const id = e.target.value;
                if (id === bloco.artistaId) return;
                // Trocar o artista re-puxa o rider DELE (camarim/efeitos zerados).
                onChange(patchDoArtista(artistas.find((d) => d.id === id), id));
              }}
            >
              <option value="">{t("Selecione um artista")}</option>
              {artistas.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Valor do cachê" required error={errors[`valor-${indice}`]}>
            <div className="flex items-stretch gap-2">
              {/* Moeda do orçamento — símbolo ANTES do valor e seletor (compartilhado). */}
              <select
                value={moeda}
                onChange={(e) => onMoedaChange(e.target.value as Moeda)}
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
                  value={bloco.valorCache}
                  onChange={(e) => onChange({ valorCache: e.target.value.replace(/[^\d.,]/g, "") })}
                  placeholder="15000"
                />
              </div>
            </div>
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
            <span className="text-muted">{t("Cachê:")}</span>{" "}
            <span className="font-bold text-primary tabular-nums">{formatarMoeda(valor, moeda)}</span>{" "}
            <span className="text-muted">
              {t("por")} {formatarDuracao(bloco.duracaoHoras, bloco.duracaoMinutos)}
              {nomeCidade && (
                <>
                  {" "}{t("em")}{" "}
                  <span className="text-primary font-semibold">{nomeCidade}</span>
                  {ufCidade && `, ${ufCidade}`}
                </>
              )}
              {tipoEvento && (
                <>
                  {" · "}
                  <span style={{ color: accent }}>{t(LABELS_TIPO_EVENTO[tipoEvento])}</span>
                </>
              )}
            </span>
          </div>
        )}

        <SectionItens title={t("Camarim / Consumação")} items={bloco.camarim} onChange={(camarim) => onChange({ camarim })} />
        <SectionItens title={t("Efeitos")} items={bloco.efeitos} onChange={(efeitos) => onChange({ efeitos })} />
        <SectionItens title={t("Hotel")} items={bloco.hotel} onChange={(hotel) => onChange({ hotel })} />

        {/* Logística - multi-seleção */}
        <div>
          <div className="section-title mb-2">{t("Logística")}</div>
          <p className="text-xs text-muted mb-3">
            {t("Não marque nenhuma se a logística estiver inclusa no cachê.")}
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
              <span className="text-sm flex-1">{t("Logística Aérea (Ida e Volta)")}</span>
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
                <span className="font-medium">{t("Translado Terrestre")}</span>
                <span className="block text-xs text-muted mt-0.5">
                  {t("Motorista executivo ou van: Aeroporto → Hotel → Evento → Hotel → Aeroporto")}
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

