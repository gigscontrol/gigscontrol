"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import PresetsRiderEditor from "@/components/artistas/PresetsRiderEditor";
import { gradienteSutil } from "@/lib/gradiente";
import {
  Music,
  Plus,
  Trash2,
  X,
  AlertCircle,
  PauseCircle,
  RotateCcw,
  Copy,
  Check,
  CheckCircle2,
  KeyRound,
  MapPin,
  Percent,
  DollarSign,
  AtSign,
  Pencil,
  Mail,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  GripVertical,
  Lock,
  Eye,
  EyeOff,
  Search,
  Users,
  FileText,
  User,
  Home,
  Phone,
  Building2,
} from "lucide-react";
import Toast from "../Toast";
import PageHeader from "../PageHeader";
import ConfirmarSaidaModal from "../ConfirmarSaidaModal";
import { useConfirmar } from "../ConfirmarModal";
import { useNavegacaoOpcional } from "../NavOverlay";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "../CidadeGlobalAutocomplete";
import ColorPicker from "../ColorPicker";
import CardGoogleCalendar from "./CardGoogleCalendar";
import EquipeDoArtista from "./EquipeDoArtista";
import InputDocumento from "../inputs/InputDocumento";
import PhoneInput from "../PhoneInput";
import { configDocumento } from "@/lib/data/documentos";
import { resolverCidade, cidadeParaEscolhida } from "@/lib/cidade-helpers";
import InputDataBR, { haDataPendente } from "@/components/inputs/InputDataBR";
import { exemploEndereco } from "@/lib/data/exemplos";
import { BRASIL, buscarPais, montarTelefoneE164, type Country } from "@/lib/data/countries";
import Modal from "../Modal";
import {
  useWorkspace,
  type NovoArtistaInput,
} from "@/lib/workspace-context";
import { PRIVACIDADE_DJ_PADRAO, type PrivacidadeDj } from "@/lib/permissoes";
import { PERFIS } from "@/lib/permissoes/perfis";
import { formatEndereco } from "@/lib/endereco";
import { useAuth } from "@/lib/auth-context";
import { getPlano } from "@/lib/planos";
import { iniciaisDoNome } from "@/lib/iniciais";
import {
  LABELS_TAXA_MODO,
  CATALOGO_CAMARIM,
  CATALOGO_EFEITOS,
  CATALOGO_TECNICO,
  LIMITE_RIDER_CAMARIM,
  LIMITE_RIDER_EFEITOS,
  LIMITE_RIDER_TECNICO,
  type TaxaAgenciaModo,
  type DocumentoTipo,
  type Cidade,
} from "@/types";

/**
 * Aba "Artistas" das Configurações.
 *
 * Versão expandida (etapa 21+): o cadastro de artista agora é um modal
 * com 5 seções — dados, acesso (login+senha gerada), cidade IBGE, taxa
 * de agência (5 modos), rider de camarim e rider de efeitos.
 */

/**
 * 10 cores padrão pro identificador visual do artista. Curadas pra
 * serem bem distinguíveis entre si em dark mode (matiz separados ≥30°).
 * Pra ter dezenas de artistas, o admin também pode escolher cor
 * customizada via color picker.
 */
export const CORES = [
  "#ef4444", // vermelho
  "#f97316", // laranja
  "#f59e0b", // âmbar
  "#eab308", // amarelo
  "#22c55e", // verde
  "#14b8a6", // teal
  "#06b6d4", // ciano
  "#3b82f6", // azul
  "#a855f7", // roxo
  "#ec4899", // rosa
];

/**
 * Snapshot do artista usado pra abrir o modal de edição com os dados
 * pré-preenchidos. ArtistaWS (=DJ) já tem tudo que precisamos.
 */
type ArtistaParaEdicao = {
  id: string;
  nome: string;
  cor: string;
  usernameAtual: string; // ex: brunosocek-twobookings
  cidadeIbgeId?: string;
  cidadeNome?: string;
  cidadeUf?: string;
  cidadeId?: string;
  cidade?: Cidade;
  pais?: string;
  nomeLegal?: string;
  documentoTipo?: DocumentoTipo;
  documento?: string;
  razaoSocial?: string;
  endereco?: string;
  telefone?: string;
  dataNascimento?: string;
  email?: string;
  pix?: string;
  taxaModo: TaxaAgenciaModo;
  taxaValor?: number;
  riderCamarim: string[];
  riderEfeitos: string[];
  riderTecnico: string[];
  privacidade: PrivacidadeDj;
  /** Acesso do artista ao sistema — true = suspenso/bloqueado. */
  acessoSuspenso?: boolean;
};

const MODOS_TAXA: TaxaAgenciaModo[] = [
  "sem-taxa",
  "perc-fixa",
  "perc-variavel",
  "valor-fixo",
  "valor-variavel",
];

export default function AbaArtistas() {
  const t = useT();
  const {
    artistas,
    adicionarArtista,
    atualizarArtista,
    removerArtista,
    resetarSenhaArtista,
    reordenarArtistas,
    lixeiraArtistas,
    recarregarLixeira,
    restaurarDaLixeira,
  } = useWorkspace();
  const { sessao } = useAuth();

  // Drag & drop pra reordenar — guarda o ID que está sendo arrastado
  // e o ID atualmente sob o ponteiro (alvo do drop).
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [sobreId, setSobreId] = useState<string | null>(null);

  function aoSoltar(targetId: string) {
    if (!arrastandoId || arrastandoId === targetId) {
      setArrastandoId(null);
      setSobreId(null);
      return;
    }
    const idsAtuais = artistas.map((a) => a.id);
    const from = idsAtuais.indexOf(arrastandoId);
    const to = idsAtuais.indexOf(targetId);
    if (from < 0 || to < 0) return;
    // Reordena: tira o item de from e insere em to
    const nova = [...idsAtuais];
    const [movido] = nova.splice(from, 1);
    nova.splice(to, 0, movido);
    setArrastandoId(null);
    setSobreId(null);
    void reordenarArtistas(nova).catch((e) => {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    });
  }

  const plano = sessao?.workspace ? getPlano(sessao.workspace.plano) : null;
  const slugAgencia = sessao?.workspace?.slug ?? "";
  const limite = plano?.maxArtistas ?? 0;
  const usados = artistas.length;
  const noLimite = usados >= limite;

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<ArtistaParaEdicao | null>(null);
  const [equipeDe, setEquipeDe] = useState<{ id: string; nome: string } | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{
    nomeArtista: string;
    username: string;
    senha: string;
  } | null>(null);

  const [acaoLixeira, setAcaoLixeira] = useState<string | null>(null);
  const [usernameCopiado, setUsernameCopiado] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);

  function copiarUsername(username: string) {
    navigator.clipboard.writeText(username).then(() => {
      setUsernameCopiado(username);
      setTimeout(() => setUsernameCopiado(null), 1800);
    });
  }

  useEffect(() => {
    void recarregarLixeira();
  }, [recarregarLixeira]);

  async function aoRestaurar(id: string, nomeArt: string) {
    setAcaoLixeira(`restaurar-${id}`);
    try {
      await restaurarDaLixeira("artista", id);
      setToast({ msg: t("{nome} restaurado.", { nome: nomeArt }), tipo: "sucesso" });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setAcaoLixeira(null);
    }
  }

  // ---- Top bar de DJs + perfil (redesign) ----
  const ultimoVistoRef = useRef<string | null>(null);
  const [artistaSelecionadoId, setArtistaSelecionadoId] = useState<string | null>(null);
  const [conta, setConta] = useState<DadosConta | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(false);
  // Membros da equipe vinculados ao artista selecionado (modelo NOVO:
  // membros_artista). Substitui o legado profiles.funcoes, que morreu.
  const [membrosDoArtista, setMembrosDoArtista] = useState<
    { userId: string; nome: string; perfis: string[]; permissoes: string[] }[]
  >([]);
  const [modoReordenar, setModoReordenar] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "suspensos">("todos");
  const [copiouSenhaCard, setCopiouSenhaCard] = useState(false);
  // Senha mascarada por padrão no card de acesso; o olhinho revela. Reseta ao
  // trocar de DJ pra não vazar a senha de um artista ao abrir o próximo.
  const [senhaReveladaCard, setSenhaReveladaCard] = useState(false);
  useEffect(() => {
    setSenhaReveladaCard(false);
  }, [artistaSelecionadoId]);

  // Retorno do OAuth do Google: /api/google/callback redireciona pra cá com
  // ?google=ok|erro (&artista &email &msg). Mostra um toast, seleciona o
  // artista conectado e limpa os parâmetros da URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (!g) return;
    const artista = params.get("artista");
    if (artista) setArtistaSelecionadoId(artista);
    if (g === "ok") {
      const email = params.get("email");
      setToast({
        msg: email ? t("Google conectado: {email}", { email }) : t("Google conectado!"),
        tipo: "sucesso",
      });
    } else {
      setToast({
        msg: params.get("msg") ?? t("Falha ao conectar o Google."),
        tipo: "erro",
      });
    }
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém uma seleção válida (default = primeiro, ou o último visto).
  useEffect(() => {
    if (artistas.length === 0) {
      if (artistaSelecionadoId !== null) setArtistaSelecionadoId(null);
      return;
    }
    const existe = artistaSelecionadoId && artistas.some((a) => a.id === artistaSelecionadoId);
    if (!existe) {
      const fb =
        ultimoVistoRef.current &&
        artistas.some((a) => a.id === ultimoVistoRef.current)
          ? ultimoVistoRef.current
          : artistas[0].id;
      setArtistaSelecionadoId(fb);
    }
  }, [artistas, artistaSelecionadoId]);

  useEffect(() => {
    if (artistaSelecionadoId) ultimoVistoRef.current = artistaSelecionadoId;
  }, [artistaSelecionadoId]);

  // Carrega email/senha da conta do DJ selecionado (igual o modal de editar).
  useEffect(() => {
    if (!artistaSelecionadoId) {
      setConta(null);
      return;
    }
    let ativo = true;
    setCarregandoConta(true);
    setConta(null);
    fetch(`/api/artistas/${artistaSelecionadoId}/conta`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DadosConta;
      })
      .then((d) => {
        if (ativo) setConta(d);
      })
      .catch(() => {
        if (ativo) setConta(null);
      })
      .finally(() => {
        if (ativo) setCarregandoConta(false);
      });
    return () => {
      ativo = false;
    };
  }, [artistaSelecionadoId]);

  // Carrega os VÍNCULOS (membros_artista) do DJ selecionado para o card
  // "Membros da equipe". No modelo novo quem atende o artista sai daqui, não
  // mais de profiles.funcoes. Recarrega ao editar a equipe pelo modal.
  useEffect(() => {
    if (!artistaSelecionadoId) {
      setMembrosDoArtista([]);
      return;
    }
    let ativo = true;
    setMembrosDoArtista([]);
    fetch(`/api/artistas/${artistaSelecionadoId}/equipe`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as {
          membros?: { userId: string; nome: string; perfis: string[]; permissoes: string[] }[];
        };
      })
      .then((d) => {
        if (ativo) setMembrosDoArtista(d.membros ?? []);
      })
      .catch(() => {
        if (ativo) setMembrosDoArtista([]);
      });
    return () => {
      ativo = false;
    };
    // equipeDe entra na dep pra recarregar quando o modal de equipe fecha.
  }, [artistaSelecionadoId, equipeDe]);

  const artistaSelecionado = useMemo(
    () => artistas.find((a) => a.id === artistaSelecionadoId) ?? null,
    [artistas, artistaSelecionadoId]
  );

  // Fila de chips: tudo no modo Reordenar; filtra por busca/status só com
  // muitos DJs (pra não poluir agências pequenas).
  const muitosDJs = artistas.length > 8;
  const filaChips = useMemo(() => {
    if (modoReordenar || !muitosDJs) return artistas;
    let lista = artistas;
    if (filtroStatus === "ativos") lista = lista.filter((a) => !a.acessoSuspenso);
    else if (filtroStatus === "suspensos") lista = lista.filter((a) => !!a.acessoSuspenso);
    const q = busca.trim().toLowerCase();
    if (q)
      lista = lista.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.username ?? "").toLowerCase().includes(q)
      );
    return lista;
  }, [artistas, modoReordenar, muitosDJs, filtroStatus, busca]);

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header padrão do site — barra de uso no slot actions. */}
      <PageHeader
        title="Artistas"
        subtitle={
          plano
            ? t("Plano {nome} — {usados} de {limite} em uso", { nome: plano.nome, usados, limite })
            : t("Artistas da sua agência")
        }
        accentColor="var(--brand)"
        actions={
          <div className="min-w-[160px]">
            <div className="text-right">
              <span className="text-2xl font-bold tabular-nums text-primary">{usados}</span>
              <span className="text-muted text-base font-normal"> / {limite}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${limite > 0 ? Math.min(100, (usados / limite) * 100) : 0}%`,
                  background: noLimite ? "var(--danger)" : "var(--grad-signal)",
                }}
              />
            </div>
          </div>
        }
      />

      {noLimite && (
        <div
          className="flex items-start gap-2 text-sm rounded-md px-3 py-2.5"
          style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "var(--warning)" }}
        >
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            {t("Você atingiu o limite de artistas do plano {nome}. Para adicionar mais, faça upgrade do plano ou remova um artista.", { nome: plano?.nome ?? "" })}
          </span>
        </div>
      )}

      {/* Top bar de troca de DJ — painel arredondado igual aos cards
          (cantos 10px + borda completa), alinhado com o conteúdo. Sticky
          pra continuar trocando de DJ enquanto rola o perfil. */}
      <div className="sticky top-0 z-20 px-3 py-2 bg-surface border border-border rounded">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1">
            {filaChips.map((a) => {
              const suspenso = !!a.acessoSuspenso;
              const ativo = a.id === artistaSelecionadoId;
              const sendoArrastado = arrastandoId === a.id;
              const ehAlvo = sobreId === a.id && arrastandoId && arrastandoId !== a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  draggable={modoReordenar}
                  onClick={() => {
                    if (!modoReordenar) {
                      setEditando(null);
                      setArtistaSelecionadoId(a.id);
                    }
                  }}
                  onDragStart={(e) => {
                    if (!modoReordenar) return;
                    setArrastandoId(a.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", a.id);
                  }}
                  onDragOver={(e) => {
                    if (!modoReordenar) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (sobreId !== a.id) setSobreId(a.id);
                  }}
                  onDragLeave={() => {
                    if (sobreId === a.id) setSobreId(null);
                  }}
                  onDrop={(e) => {
                    if (!modoReordenar) return;
                    e.preventDefault();
                    aoSoltar(a.id);
                  }}
                  onDragEnd={() => {
                    setArrastandoId(null);
                    setSobreId(null);
                  }}
                  title={a.name}
                  className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full flex-shrink-0 transition-colors ${
                    ativo ? "bg-elevated" : "hover:bg-surface-2"
                  }`}
                  style={{
                    opacity: sendoArrastado ? 0.4 : suspenso && !ativo ? 0.7 : 1,
                    borderLeft: ehAlvo
                      ? "2px solid var(--brand)"
                      : "2px solid transparent",
                    cursor: modoReordenar ? "grab" : "pointer",
                  }}
                >
                  <span className="relative flex-shrink-0">
                    <span
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[0.7rem] font-bold text-white"
                      style={{
                        background: suspenso
                          ? "var(--border-strong)"
                          : `linear-gradient(135deg, ${a.color}, ${a.color}99)`,
                        boxShadow: ativo
                          ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${a.color}`
                          : undefined,
                      }}
                    >
                      {iniciaisDoNome(a.name)}
                    </span>
                    {suspenso && (
                      <PauseCircle
                        size={12}
                        className="absolute -bottom-0.5 -right-0.5"
                        style={{ color: "var(--warning)" }}
                      />
                    )}
                  </span>
                  <span
                    className={`hidden sm:block text-sm truncate max-w-[110px] ${
                      ativo ? "text-primary font-medium" : "text-secondary"
                    }`}
                  >
                    {a.name}
                  </span>
                </button>
              );
            })}

            {/* Novo artista */}
            <button
              type="button"
              onClick={() => setCriando(true)}
              disabled={noLimite}
              title={noLimite ? t("Limite do plano atingido") : t("Adicionar artista")}
              className="h-9 w-9 rounded-full border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 transition-colors hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "var(--brand)" }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Busca + filtro (só com muitos DJs) */}
          {muitosDJs && !modoReordenar && (
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-elevated border border-border rounded-md px-2 py-1.5 w-40 focus-within:border-border-strong">
                <Search size={13} className="text-muted flex-shrink-0" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={t("Buscar")}
                  className="bg-transparent outline-none text-sm text-primary placeholder:text-muted w-full min-w-0"
                />
              </div>
              <div className="pill-group">
                {(["todos", "ativos", "suspensos"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroStatus(f)}
                    className={`pill ${filtroStatus === f ? "active" : ""}`}
                  >
                    {f === "todos" ? t("Todos") : f === "ativos" ? t("Ativos") : t("Suspensos")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reordenar */}
          {artistas.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setModoReordenar((v) => !v);
                setArrastandoId(null);
                setSobreId(null);
              }}
              className={`text-sm inline-flex items-center gap-1.5 flex-shrink-0 ${
                modoReordenar ? "btn btn-secondary" : "btn-ghost px-2 py-1.5 rounded"
              }`}
            >
              {modoReordenar ? (
                <>
                  <Check size={14} />
                  {t("Concluir")}
                </>
              ) : (
                <>
                  <GripVertical size={14} />
                  {t("Reordenar")}
                </>
              )}
            </button>
          )}
        </div>
        {modoReordenar && (
          <p className="text-xs text-muted mt-2">
            {t("Arraste os avatares pra reordenar — reflete na sidebar e nos filtros do app.")}
          </p>
        )}
      </div>

      {/* Perfil do DJ selecionado */}
      {!artistaSelecionado ? (
        <div className="card flex flex-col items-center justify-center text-center gap-3 py-16">
          <div
            className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center"
            style={{ color: "var(--brand)" }}
          >
            <Music size={22} />
          </div>
          <div className="section-title">{t("Nenhum artista cadastrado")}</div>
          <p className="text-sm text-muted max-w-sm">
            {t("Cadastre o primeiro artista da sua agência pra começar.")}
          </p>
          <button
            onClick={() => setCriando(true)}
            disabled={noLimite}
            className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> {t("Adicionar artista")}
          </button>
        </div>
      ) : editando && editando.id === artistaSelecionado.id ? (
        <ModalEditarArtista
          modoInline
          artista={editando}
          slugAgencia={slugAgencia}
          onCancelar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            setToast({ msg: t("Artista atualizado."), tipo: "sucesso" });
          }}
          onResetarSenha={async () => {
            const novaSenha = await resetarSenhaArtista(editando.id);
            setEditando(null);
            setCredenciaisGeradas({
              nomeArtista: editando.nome,
              username: "—",
              senha: novaSenha,
            });
          }}
          nomesExistentes={artistas
            .filter((a) => a.id !== editando.id)
            .map((a) => a.name.toLowerCase())}
          nomesNaLixeira={lixeiraArtistas
            .filter((it) => it.artista.id !== editando.id)
            .map((it) => it.artista.name.toLowerCase())}
          usernamesExistentes={artistas
            .filter((a) => a.id !== editando.id)
            .map((a) => extrairRaizUsername(a.username, slugAgencia))
            .filter(Boolean)}
          usernamesNaLixeira={lixeiraArtistas
            .filter((it) => it.artista.id !== editando.id)
            .map((it) =>
              extrairRaizUsername(it.artista.username, slugAgencia)
            )
            .filter(Boolean)}
        />
      ) : (
        <>
          {/* Header do perfil */}
          <div className="card p-0 overflow-hidden">
            <div
              style={{
                height: 4,
                background: `linear-gradient(90deg, ${artistaSelecionado.color}, ${artistaSelecionado.color}66)`,
              }}
            />
            <div className="p-5 flex items-start gap-4 flex-wrap">
              <span
                className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{
                  background: artistaSelecionado.acessoSuspenso
                    ? "var(--border-strong)"
                    : `linear-gradient(135deg, ${artistaSelecionado.color}, ${artistaSelecionado.color}99)`,
                }}
              >
                {iniciaisDoNome(artistaSelecionado.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="page-title">{artistaSelecionado.name}</div>
                  {artistaSelecionado.acessoSuspenso && (
                    <span className="badge badge-warning">{t("Acesso suspenso")}</span>
                  )}
                </div>
                {/* Identidade — login · cidade · cor */}
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted mt-2">
                  {artistaSelecionado.username && (
                    <button
                      type="button"
                      onClick={() => copiarUsername(artistaSelecionado.username!)}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors group"
                      title={t("Copiar login")}
                    >
                      <AtSign size={11} />
                      <span className="font-mono">{artistaSelecionado.username}</span>
                      {usernameCopiado === artistaSelecionado.username ? (
                        <CheckCircle2 size={11} style={{ color: "var(--success)" }} />
                      ) : (
                        <Copy
                          size={11}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                    </button>
                  )}
                  {artistaSelecionado.cidadeNome && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} />
                      {artistaSelecionado.cidadeNome}
                      {artistaSelecionado.cidadeUf ? `/${artistaSelecionado.cidadeUf}` : ""}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: artistaSelecionado.color }}
                    />
                    <span className="font-mono uppercase">{artistaSelecionado.color}</span>
                  </span>
                </div>

                {/* Dados para contrato — chips organizados: pessoa · empresa ·
                    documento · endereço · telefone */}
                {(artistaSelecionado.nomeLegal ||
                  artistaSelecionado.razaoSocial ||
                  artistaSelecionado.documento ||
                  artistaSelecionado.endereco ||
                  artistaSelecionado.telefone) && (
                  <div className="flex items-center gap-2 flex-wrap mt-2.5">
                    {artistaSelecionado.nomeLegal && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-secondary">
                        <User size={11} className="text-muted flex-shrink-0" />
                        {artistaSelecionado.nomeLegal}
                      </span>
                    )}
                    {artistaSelecionado.documentoTipo === "cnpj" &&
                      artistaSelecionado.razaoSocial && (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-secondary">
                          <Building2 size={11} className="text-muted flex-shrink-0" />
                          {artistaSelecionado.razaoSocial}
                        </span>
                      )}
                    {artistaSelecionado.documento && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-secondary">
                        <FileText size={11} className="text-muted flex-shrink-0" />
                        <span className="text-muted">
                          {artistaSelecionado.documentoTipo === "cnpj" ? "CNPJ" : "CPF"}
                        </span>
                        <span className="font-mono">{artistaSelecionado.documento}</span>
                      </span>
                    )}
                    {artistaSelecionado.endereco && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-secondary">
                        <Home size={11} className="text-muted flex-shrink-0" />
                        {formatEndereco(artistaSelecionado.endereco)}
                      </span>
                    )}
                    {artistaSelecionado.telefone && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-secondary">
                        <Phone size={11} className="text-muted flex-shrink-0" />
                        <span className="font-mono">+{artistaSelecionado.telefone}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Ações */}
              {removendo === artistaSelecionado.id ? (
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted">
                    {t("Remover {nome}?", { nome: artistaSelecionado.name })}
                  </span>
                  <button
                    onClick={() => {
                      removerArtista(artistaSelecionado.id);
                      setRemovendo(null);
                    }}
                    className="btn text-xs px-2.5 py-1"
                    style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                  >
                    {t("Sim")}
                  </button>
                  <button
                    onClick={() => setRemovendo(null)}
                    className="btn-ghost text-xs px-2.5 py-1"
                  >
                    {t("Não")}
                  </button>
                </div>
              ) : (
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() =>
                      setEditando({
                        id: artistaSelecionado.id,
                        nome: artistaSelecionado.name,
                        cor: artistaSelecionado.color,
                        usernameAtual: artistaSelecionado.username ?? "",
                        cidadeIbgeId: artistaSelecionado.cidadeIbgeId,
                        cidadeNome: artistaSelecionado.cidadeNome,
                        cidadeUf: artistaSelecionado.cidadeUf,
                        cidadeId: artistaSelecionado.cidadeId,
                        cidade: artistaSelecionado.cidade,
                        pais: artistaSelecionado.pais,
                        nomeLegal: artistaSelecionado.nomeLegal,
                        documentoTipo: artistaSelecionado.documentoTipo,
                        documento: artistaSelecionado.documento,
                        razaoSocial: artistaSelecionado.razaoSocial,
                        endereco: artistaSelecionado.endereco,
                        telefone: artistaSelecionado.telefone,
                        dataNascimento: artistaSelecionado.dataNascimento,
                        email: artistaSelecionado.email,
                        pix: artistaSelecionado.pix,
                        taxaModo: artistaSelecionado.taxaModo ?? "sem-taxa",
                        taxaValor: artistaSelecionado.taxaValor,
                        riderCamarim: artistaSelecionado.riderCamarim ?? [],
                        riderEfeitos: artistaSelecionado.riderEfeitos ?? [],
                        riderTecnico: artistaSelecionado.riderTecnico ?? [],
                        privacidade: artistaSelecionado.privacidade ?? PRIVACIDADE_DJ_PADRAO,
                        acessoSuspenso: artistaSelecionado.acessoSuspenso,
                      })
                    }
                    className="btn btn-secondary text-xs inline-flex items-center gap-1"
                  >
                    <Pencil size={13} /> {t("Editar")}
                  </button>
                  <button
                    onClick={() =>
                      setEquipeDe({ id: artistaSelecionado.id, nome: artistaSelecionado.name })
                    }
                    className="btn btn-secondary text-xs inline-flex items-center gap-1"
                  >
                    <Users size={13} /> {t("Equipe")}
                  </button>
                  <button
                    onClick={() => setRemovendo(artistaSelecionado.id)}
                    className="btn-ghost p-1.5 rounded"
                    style={{ color: "var(--danger)" }}
                    aria-label={t("Remover artista")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Grid de cards do perfil */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Acesso */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <KeyRound size={12} style={{ color: "var(--brand)" }} />
                {t("Acesso ao sistema")}
              </div>
              {artistaSelecionado.username && (
                <div>
                  <div className="text-[0.7rem] text-muted mb-1">{t("Login")}</div>
                  <button
                    type="button"
                    onClick={() => copiarUsername(artistaSelecionado.username!)}
                    className="w-full flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 hover:border-border-strong transition-colors text-left"
                  >
                    <span className="font-mono text-sm text-primary flex-1 truncate">
                      {artistaSelecionado.username}
                    </span>
                    {usernameCopiado === artistaSelecionado.username ? (
                      <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                    ) : (
                      <Copy size={14} className="text-muted" />
                    )}
                  </button>
                </div>
              )}
              {carregandoConta ? (
                <div className="flex items-center gap-2 text-sm text-muted py-1">
                  <Loader2 size={14} className="animate-spin" />
                  {t("Carregando dados da conta…")}
                </div>
              ) : !conta ? (
                <p className="text-xs" style={{ color: "var(--danger)" }}>
                  {t("Não foi possível carregar a conta.")}
                </p>
              ) : (
                <>
                  <div>
                    <div className="text-[0.7rem] text-muted mb-1">{t("E-mail")}</div>
                    {conta.emailFakeInterno ? (
                      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                        <Mail size={14} className="text-muted flex-shrink-0" />
                        <span className="flex-1 text-sm text-muted italic">
                          {t("Usuário não cadastrou nenhum email")}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                          <Mail size={14} className="text-muted flex-shrink-0" />
                          <span className="flex-1 text-sm text-secondary break-all">
                            {conta.email}
                          </span>
                        </div>
                        <div className="mt-1 text-[0.7rem]">
                          {conta.emailVerificado ? (
                            <span
                              className="inline-flex items-center gap-1"
                              style={{ color: "var(--success)" }}
                            >
                              <ShieldCheck size={11} /> {t("Verificado")}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1"
                              style={{ color: "var(--warning)" }}
                            >
                              <AlertTriangle size={11} /> {t("Não verificado")}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <div className="text-[0.7rem] text-muted mb-1">{t("Senha")}</div>
                    {conta.senhaPadrao && conta.senhaPadraoValor ? (
                      <>
                        <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                          <Lock size={14} className="text-muted flex-shrink-0" />
                          <span
                            className={`font-mono text-sm text-primary flex-1 break-all ${
                              senhaReveladaCard ? "select-all" : "tracking-widest"
                            }`}
                          >
                            {senhaReveladaCard ? conta.senhaPadraoValor : "••••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSenhaReveladaCard((v) => !v)}
                            className="btn-ghost p-1 rounded flex-shrink-0"
                            aria-label={senhaReveladaCard ? t("Ocultar senha") : t("Revelar senha")}
                            title={senhaReveladaCard ? t("Ocultar senha") : t("Revelar senha")}
                          >
                            {senhaReveladaCard ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(conta.senhaPadraoValor!)
                                .then(() => {
                                  setCopiouSenhaCard(true);
                                  setTimeout(() => setCopiouSenhaCard(false), 2000);
                                });
                            }}
                            className="btn-ghost p-1 rounded flex-shrink-0"
                            aria-label={t("Copiar senha")}
                          >
                            {copiouSenhaCard ? (
                              <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        <div
                          className="text-[0.7rem] mt-1 inline-flex items-center gap-1"
                          style={{ color: "var(--warning)" }}
                        >
                          <AlertTriangle size={11} /> {t("Senha padrão — usuário ainda não trocou.")}
                        </div>
                      </>
                    ) : conta.senhaPadrao ? (
                      <div
                        className="flex items-start gap-2 text-xs rounded-md px-3 py-2 leading-relaxed"
                        style={{
                          backgroundColor: "rgba(245,158,11,0.08)",
                          color: "var(--warning)",
                          border: "1px solid rgba(245,158,11,0.2)",
                        }}
                      >
                        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                        <span>
                          {t('Senha padrão sem valor disponível. Use “Resetar senha” pra gerar uma nova.')}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
                        style={{
                          backgroundColor: "rgba(34,197,94,0.08)",
                          color: "var(--success)",
                          border: "1px solid rgba(34,197,94,0.2)",
                        }}
                      >
                        <Lock size={13} className="flex-shrink-0" />
                        <span>{t("Senha já alterada pelo usuário.")}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Permissões (read-only; edita no formulário) */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <ShieldCheck size={12} style={{ color: "var(--brand)" }} />
                {t("Permissões")}
              </div>
              {(() => {
                const priv = artistaSelecionado.privacidade ?? PRIVACIDADE_DJ_PADRAO;
                // Nível "sem acesso / só vê / acesso total" pra cada módulo.
                type NivelBadge = { label: string; cls: string; forte: boolean };
                const nivelBadge = (ver: boolean, agiu: boolean): NivelBadge =>
                  agiu
                    ? { label: t("Acesso total"), cls: "badge-success", forte: true }
                    : ver
                    ? { label: t("Somente leitura"), cls: "badge-info", forte: true }
                    : { label: t("Sem acesso"), cls: "badge-neutral", forte: false };
                const orcamentos = nivelBadge(priv.orcamentosVer, priv.orcamentosCriar);
                const vendas = nivelBadge(priv.vendasVer, priv.vendasCriar);
                const grupos: { label: string; badge: NivelBadge }[] = [
                  {
                    label: t("Agenda"),
                    badge: priv.agendaTotal
                      ? { label: t("Acesso total"), cls: "badge-success", forte: true }
                      : priv.agendaVerDetalhado
                      ? { label: t("Somente leitura"), cls: "badge-info", forte: true }
                      : { label: t("Básico"), cls: "badge-neutral", forte: false },
                  },
                  { label: t("Orçamentos"), badge: orcamentos },
                  { label: t("Vendas"), badge: vendas },
                  { label: t("Financeiro"), badge: nivelBadge(priv.financeiroVer, priv.financeiroInformar) },
                  { label: t("Contratos"), badge: nivelBadge(priv.contratosVer, priv.contratosCriar) },
                ];
                return (
                  <div className="flex flex-col gap-2">
                    {grupos.map((g) => (
                      <div key={g.label} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-secondary">{g.label}</span>
                        <span
                          className={`badge ${g.badge.cls}`}
                          style={g.badge.forte ? undefined : { opacity: 0.55 }}
                        >
                          {g.badge.label}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-secondary">{t("Contatos")}</span>
                      <span
                        className={`badge ${
                          priv.contatos === "todos"
                            ? "badge-info"
                            : priv.contatos === "proprios"
                            ? "badge-info"
                            : "badge-neutral"
                        }`}
                        style={priv.contatos === "nenhum" ? { opacity: 0.55 } : undefined}
                      >
                        {priv.contatos === "todos"
                          ? t("Todos os contatos da agência")
                          : priv.contatos === "proprios"
                          ? t("Somente os seus contatos")
                          : t("Sem acesso")}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Membros da equipe que atendem o DJ */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <Users size={12} style={{ color: "var(--brand)" }} />
                {t("Membros da equipe")}
              </div>
              {(() => {
                // Modelo NOVO: quem atende o artista vem dos VÍNCULOS
                // (membros_artista), carregados em membrosDoArtista.
                if (membrosDoArtista.length === 0)
                  return (
                    <div className="text-sm text-muted">
                      {t("Nenhum membro da equipe atende este artista ainda.")}
                    </div>
                  );
                return (
                  <div className="flex flex-col gap-2">
                    {membrosDoArtista.map((m) => {
                      const perfis = m.perfis
                        .map((id) => PERFIS.find((p) => p.id === id))
                        .filter((p): p is (typeof PERFIS)[number] => !!p);
                      return (
                        <div key={m.userId} className="flex items-center gap-2">
                          <span
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white flex-shrink-0"
                            style={{ background: "var(--border-strong)" }}
                          >
                            {iniciaisDoNome(m.nome)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-primary truncate">{m.nome}</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {perfis.length > 0 ? (
                                perfis.map((p) => (
                                  <span
                                    key={p.id}
                                    className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                                    style={{
                                      backgroundColor: `${p.cor}22`,
                                      color: p.cor,
                                    }}
                                  >
                                    {t(p.nome)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[0.6rem] text-muted">
                                  {t("Personalizado")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Google Calendar — conexão da conta por artista (sync de shows) */}
            <CardGoogleCalendar artistaId={artistaSelecionado.id} />

            {/* Rider de camarim */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("Rider de Camarim")} ({(artistaSelecionado.riderCamarim ?? []).length}/
                {LIMITE_RIDER_CAMARIM})
              </div>
              {(artistaSelecionado.riderCamarim ?? []).length === 0 ? (
                <div className="text-sm text-muted">{t("Nenhum item configurado.")}</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(artistaSelecionado.riderCamarim ?? []).map((item, i) => (
                    <span
                      key={i}
                      className="text-xs bg-elevated border border-border rounded-md px-2 py-1 text-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Rider de efeitos */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("Rider de Efeitos")} ({(artistaSelecionado.riderEfeitos ?? []).length}/
                {LIMITE_RIDER_EFEITOS})
              </div>
              {(artistaSelecionado.riderEfeitos ?? []).length === 0 ? (
                <div className="text-sm text-muted">{t("Nenhum item configurado.")}</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(artistaSelecionado.riderEfeitos ?? []).map((item, i) => (
                    <span
                      key={i}
                      className="text-xs bg-elevated border border-border rounded-md px-2 py-1 text-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Rider técnico */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t("Rider técnico")} ({(artistaSelecionado.riderTecnico ?? []).length}/
                {LIMITE_RIDER_TECNICO})
              </div>
              {(artistaSelecionado.riderTecnico ?? []).length === 0 ? (
                <div className="text-sm text-muted">{t("Nenhum item configurado.")}</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(artistaSelecionado.riderTecnico ?? []).map((item, i) => (
                    <span
                      key={i}
                      className="text-xs bg-elevated border border-border rounded-md px-2 py-1 text-secondary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Presets de rider (mig 97) — combinações prontas com quantidade,
                aplicáveis com 1 clique no Novo Orçamento / Concretizar Venda. */}
            <PresetsRiderEditor
              artista={artistaSelecionado}
              podeEditar
              onSalvar={async (presets) => {
                await atualizarArtista(artistaSelecionado.id, { presets });
              }}
            />

            {/* Taxa de agência */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                {(artistaSelecionado.taxaModo ?? "sem-taxa").startsWith("perc") ? (
                  <Percent size={12} style={{ color: "var(--brand)" }} />
                ) : (
                  <DollarSign size={12} style={{ color: "var(--brand)" }} />
                )}
                {t("Taxa de agência")}
              </div>
              {(() => {
                const modo = artistaSelecionado.taxaModo ?? "sem-taxa";
                if (modo === "sem-taxa")
                  return <div className="text-sm text-muted">{t("Sem taxa")}</div>;
                const val = artistaSelecionado.taxaValor;
                const sufixo =
                  modo === "perc-fixa" && val !== undefined
                    ? ` ${val}%`
                    : modo === "valor-fixo" && val !== undefined
                    ? ` R$ ${val.toFixed(2)}`
                    : "";
                return (
                  <div>
                    <div className="text-base font-semibold text-primary">
                      {t(LABELS_TAXA_MODO[modo])}
                      {sufixo}
                    </div>
                    {(modo === "perc-variavel" || modo === "valor-variavel") && (
                      <div className="text-xs text-muted mt-0.5">
                        {t("Valor definido a cada orçamento.")}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Mini-lixeira */}
      {lixeiraArtistas.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Trash2 size={14} style={{ color: "var(--brand)" }} />
              <div className="section-title">
                {t("Na lixeira ({n})", { n: lixeiraArtistas.length })}
              </div>
            </div>
            <span className="text-xs text-muted">{t("Recuperáveis por 30 dias")}</span>
          </div>
          <div className="divide-y divide-border">
            {lixeiraArtistas.map((item) => {
              const urgente = item.diasRestantes <= 3;
              return (
                <div
                  key={item.artista.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: item.artista.color, opacity: 0.6 }}
                  >
                    {iniciaisDoNome(item.artista.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {item.artista.name}
                    </div>
                    <div
                      className="text-xs font-medium"
                      style={{
                        color: urgente ? "var(--danger)" : "var(--warning)",
                      }}
                    >
                      {item.diasRestantes === 0
                        ? t("Expira hoje")
                        : t("{n} dia{s} restantes", { n: item.diasRestantes, s: item.diasRestantes === 1 ? "" : "s" })}
                    </div>
                  </div>
                  <button
                    onClick={() => aoRestaurar(item.artista.id, item.artista.name)}
                    disabled={acaoLixeira === `restaurar-${item.artista.id}`}
                    className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1 disabled:opacity-50"
                    style={{ color: "var(--success)" }}
                  >
                    <RotateCcw size={13} />
                    {t("Restaurar")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-elevated/50 p-3 text-xs text-secondary leading-relaxed">
        <strong className="text-primary">{t("Ordem:")}</strong> {t("clique em")}{" "}
        <span className="inline-flex items-center gap-0.5 font-medium">
          <GripVertical size={11} /> {t("Reordenar")}
        </span>{" "}
        {t("na barra de cima e arraste os avatares — a ordem reflete na sidebar de artistas e em todos os filtros do app.")}
        <br />
        <strong className="text-primary">{t("Login do artista:")}</strong> {t("aparece ao lado do nome (clique pra copiar). Fica salvo no sistema e você consegue acessar sempre que precisar.")}{" "}
        <br />
        <strong className="text-primary">{t("Senha:")}</strong> {t("só aparece uma vez ao criar. Se o artista perder, abra")}{" "}
        <span className="inline-flex items-center gap-1 font-medium">
          <Pencil size={11} /> {t("Editar")}
        </span>{" "}
        {t("e gere uma nova lá dentro.")}{" "}
        <br />
        <strong className="text-primary">{t("Suspender:")}</strong> {t("artista fica visível mas em cinza e sem editar nada.")}{" "}
        <strong className="text-primary">{t("Remover:")}</strong> {t("manda pra Lixeira (recuperável por 30 dias).")}
      </div>

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />

      {/* Modal de cadastro completo */}
      {criando && (
        <ModalNovoArtista
          slugAgencia={slugAgencia}
          nomeAgencia={sessao?.workspace?.nome ?? ""}
          onCancelar={() => setCriando(false)}
          onCriado={(resultado) => {
            setCriando(false);
            setCredenciaisGeradas(resultado);
          }}
          adicionarArtista={adicionarArtista}
          nomesExistentes={artistas.map((a) => a.name.toLowerCase())}
          nomesNaLixeira={lixeiraArtistas.map((it) =>
            it.artista.name.toLowerCase()
          )}
          usernamesExistentes={artistas
            .map((a) => extrairRaizUsername(a.username, slugAgencia))
            .filter(Boolean)}
          usernamesNaLixeira={lixeiraArtistas
            .map((it) =>
              extrairRaizUsername(it.artista.username, slugAgencia)
            )
            .filter(Boolean)}
        />
      )}

      {/* A edição do artista é renderizada inline dentro do perfil (acima). */}

      {/* Modal de credenciais geradas */}
      {credenciaisGeradas && (
        <ModalCredenciais
          nomeArtista={credenciaisGeradas.nomeArtista}
          username={credenciaisGeradas.username}
          senha={credenciaisGeradas.senha}
          onFechar={() => setCredenciaisGeradas(null)}
        />
      )}

      {/* Equipe do artista — permissões por-vínculo (novo modelo) */}
      <Modal
        isOpen={!!equipeDe}
        onClose={() => setEquipeDe(null)}
        title={t("Equipe do artista")}
        subtitle={equipeDe?.nome}
        maxWidth={720}
      >
        {equipeDe && (
          <EquipeDoArtista artistaId={equipeDe.id} artistaNome={equipeDe.nome} />
        )}
      </Modal>
    </div>
  );
}

// ============================================================
// Modal — Novo artista (form completo, 5 seções)
// ============================================================

type Props = {
  slugAgencia: string;
  nomeAgencia: string;
  onCancelar: () => void;
  onCriado: (r: { nomeArtista: string; username: string; senha: string }) => void;
  adicionarArtista: (input: NovoArtistaInput) => Promise<{
    artista: { id: string; name: string };
    senhaTemporaria: string;
    usernameCompleto: string;
  }>;
  /**
   * Nomes dos artistas que já existem NO WORKSPACE atual (lowercase).
   * Usado pra bloquear duplicata dentro da mesma agência — o admin não
   * pode ter dois "Bruno" no próprio CRM porque vira confusão. Mas
   * agências diferentes podem ter "Bruno" sem problema (cada
   * `nomesExistentes` é escopado pelo workspace que monta a lista).
   */
  nomesExistentes: string[];
  /** Nomes dos artistas que estão na lixeira do workspace (lowercase). */
  nomesNaLixeira: string[];
  /**
   * Raízes de username dos artistas ATIVOS no workspace (lowercase, sem
   * o sufixo "-slugAgencia"). Usado pra warning inline antes do submit.
   */
  usernamesExistentes: string[];
  /** Raízes de username dos artistas na lixeira. */
  usernamesNaLixeira: string[];
  /**
   * Quando true, renderiza inline (sem overlay fixed, sem botão X,
   * sem botão Cancelar). Usado pelo onboarding wizard, onde o cadastro
   * do 1º artista é obrigatório e fica embedado na Etapa 4.
   */
  modoInline?: boolean;
};

/**
 * Extrai a "raiz" do username completo, removendo o sufixo "-slugAgencia".
 *   "djlunar-twobookings", slug "twobookings" → "djlunar"
 * Se não tiver sufixo (ou username for vazio), devolve o que recebeu
 * em lowercase. Usado nas checagens de colisão inline do form.
 */
function extrairRaizUsername(
  usernameCompleto: string | undefined | null,
  slugAgencia: string
): string {
  if (!usernameCompleto) return "";
  const u = usernameCompleto.toLowerCase();
  const sufixo = `-${slugAgencia.toLowerCase()}`;
  return u.endsWith(sufixo) ? u.slice(0, -sufixo.length) : u;
}

/**
 * Normaliza um texto pra virar username:
 *   "DJ Lúnar" → "djlunar"
 *   "Black Drumm!" → "blackdrumm"
 * Remove acentos, lowercase, mantém só [a-z0-9-].
 */
function normalizarUsername(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ModalNovoArtista({
  slugAgencia,
  nomeAgencia,
  onCancelar,
  onCriado,
  adicionarArtista,
  nomesExistentes,
  nomesNaLixeira,
  usernamesExistentes,
  usernamesNaLixeira,
  modoInline = false,
}: Props) {
  const t = useT();
  // Seção 1 — dados básicos
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(null);

  // Seção 2 — acesso
  // Auto-preenche a partir do nome enquanto o usuário não toca no campo.
  // Quando ele edita manualmente o username, paramos de espelhar.
  const [usernameRaiz, setUsernameRaiz] = useState("");
  const [usernameFoiEditado, setUsernameFoiEditado] = useState(false);

  // Seção 3 — taxa
  const [taxaModo, setTaxaModo] = useState<TaxaAgenciaModo>("sem-taxa");
  const [taxaValor, setTaxaValor] = useState<string>("");

  // Seção 4, 5 e 6 — rider (apenas nomes; quantidade vai no orçamento)
  const [riderCamarim, setRiderCamarim] = useState<string[]>([]);
  const [riderEfeitos, setRiderEfeitos] = useState<string[]>([]);
  const [riderTecnico, setRiderTecnico] = useState<string[]>([]);

  // Seção — Privacidade (o que o artista pode ver/fazer). Começa no padrão.
  const [privacidade, setPrivacidade] = useState<PrivacidadeDj>(PRIVACIDADE_DJ_PADRAO);

  // Seção — Dados pessoais (CONTRATADO)
  const [pais, setPais] = useState<Country>(BRASIL);
  const [nomeLegal, setNomeLegal] = useState("");
  const [documentoTipo, setDocumentoTipo] = useState<DocumentoTipo>("cpf");
  const [documento, setDocumento] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [pix, setPix] = useState("");

  // Validação: Set das CHAVES de campo obrigatório faltando (borda vermelha +
  // contador). `erroGeral` guarda mensagens que não são de campo (ex.: falha
  // de rede no submit, ou a regra de % > 100).
  const [erros, setErros] = useState<Set<string>>(new Set());
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Feedback do botão de copiar username completo.
  const [copiouUsername, setCopiouUsername] = useState(false);

  // Remove uma chave do Set de erros (chamado no onChange de cada campo — a
  // borda vermelha some assim que o usuário mexe no campo).
  function limparErro(chave: string) {
    setErros((prev) => {
      if (!prev.has(chave)) return prev;
      const n = new Set(prev);
      n.delete(chave);
      return n;
    });
  }

  // Mapa chave→mensagem específica, mostrada quando falta exatamente 1 campo.
  const MSG_ERRO_CAMPO: Record<string, string> = {
    nome: t("Nome obrigatório"),
    username: t("Login obrigatório"),
    cidade: t("Cidade obrigatória"),
    nomeLegal: t("Nome completo obrigatório"),
    documento: t("CPF/CNPJ obrigatório"),
    razaoSocial: t("Razão social obrigatória"),
    taxaValor: t("Valor da taxa obrigatório"),
  };
  // Mensagem derivada do Set (live): some ao zerar, específica quando é 1 só,
  // "N informações faltando" quando são vários.
  const msgErros =
    erros.size === 0
      ? null
      : erros.size === 1
      ? MSG_ERRO_CAMPO[[...erros][0]] ?? t("{n} informações faltando", { n: 1 })
      : t("{n} informações faltando", { n: erros.size });

  const usernameCompleto = useMemo(() => {
    if (!usernameRaiz.trim()) return "";
    return `${usernameRaiz.trim().toLowerCase()}-${slugAgencia}`;
  }, [usernameRaiz, slugAgencia]);

  const usernameValido = useMemo(() => {
    const v = usernameRaiz.trim();
    if (v.length < 3) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v);
  }, [usernameRaiz]);

  // Colisões em tempo real — checa contra ativos E lixeira. "ativo"
  // bloqueia direto; "lixeira" também bloqueia mas com mensagem
  // diferente (admin precisa restaurar ou apagar).
  const colisaoNome: "ativo" | "lixeira" | null = useMemo(() => {
    const n = nome.trim().toLowerCase();
    if (!n) return null;
    if (nomesExistentes.includes(n)) return "ativo";
    if (nomesNaLixeira.includes(n)) return "lixeira";
    return null;
  }, [nome, nomesExistentes, nomesNaLixeira]);

  const colisaoUsername: "ativo" | "lixeira" | null = useMemo(() => {
    const u = usernameRaiz.trim().toLowerCase();
    if (!u) return null;
    if (usernamesExistentes.includes(u)) return "ativo";
    if (usernamesNaLixeira.includes(u)) return "lixeira";
    return null;
  }, [usernameRaiz, usernamesExistentes, usernamesNaLixeira]);

  const temColisao = colisaoNome !== null || colisaoUsername !== null;

  // Validação: percorre TODAS as regras acumulando as CHAVES dos campos
  // obrigatórios que faltam (não para no primeiro). As colisões de nome/login
  // seguem separadas — avisos inline + bloqueio por `temColisao`.
  // Nome do artista NÃO precisa ser único globalmente — duas agências
  // diferentes podem ter "Bruno" cada uma. Mas DENTRO da mesma agência
  // bloqueamos duplicata (via temColisao) pra não confundir o admin.
  function validarTudo(): Set<string> {
    const faltando = new Set<string>();
    if (!nome.trim()) faltando.add("nome");
    if (!usernameValido) faltando.add("username");
    if (!cidade) faltando.add("cidade");
    if (!nomeLegal.trim()) faltando.add("nomeLegal");
    if (!documentoValido(documento, documentoTipo)) faltando.add("documento");
    if (documentoTipo === "cnpj" && !razaoSocial.trim()) faltando.add("razaoSocial");
    // Taxa obrigatória nos modos fixos
    if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) faltando.add("taxaValor");
    }
    return faltando;
  }

  async function salvar() {
    setErroGeral(null);
    // TRAVA: data digitada pela metade não vira ISO e sumiria em silêncio.
    if (haDataPendente()) {
      setErroGeral(t("Complete a data (dd/mm/aaaa) antes de salvar — o campo em vermelho está incompleto."));
      return;
    }
    const faltando = validarTudo();
    // Regra extra: % fixa não pode passar de 100% — mantém a mensagem
    // específica de antes (via erroGeral), marcando o campo em vermelho.
    if (taxaModo === "perc-fixa" && !faltando.has("taxaValor")) {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (Number.isFinite(v) && v > 100) {
        faltando.add("taxaValor");
        setErroGeral(t("Porcentagem não pode ser maior que 100%."));
      }
    }
    if (faltando.size > 0) {
      setErros(faltando);
      return;
    }
    setErros(new Set());
    setEnviando(true);
    try {
      const input: NovoArtistaInput = {
        nome: nome.trim(),
        cor,
        usernameRaiz: usernameRaiz.trim().toLowerCase(),
      };
      if (cidade) {
        input.cidadeIbgeId = cidade.ibgeId ?? "";
        input.cidadeNome = cidade.nome;
        input.cidadeUf = cidade.uf;
        // Cidade global canônica: resolve pro UUID do catálogo (qualquer país).
        try {
          input.cidadeId = (await resolverCidade(cidade)).id;
        } catch {
          /* segue sem cidade_id se não resolver */
        }
      }
      input.taxaModo = taxaModo;
      if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
        input.taxaValor = parseFloat(taxaValor.replace(",", "."));
      }
      if (riderCamarim.length > 0) input.riderCamarim = riderCamarim;
      if (riderEfeitos.length > 0) input.riderEfeitos = riderEfeitos;
      if (riderTecnico.length > 0) input.riderTecnico = riderTecnico;
      input.privacidade = privacidade;

      // Dados do CONTRATADO (obrigatórios — validados acima)
      input.pais = pais.code;
      input.nomeLegal = nomeLegal.trim();
      input.documento = documento.trim();
      input.documentoTipo = documentoTipo;
      if (dataNascimento) input.dataNascimento = dataNascimento;
      if (pais.code === "BR" && pix.trim()) input.pix = pix.trim();
      if (documentoTipo === "cnpj" && razaoSocial.trim())
        input.razaoSocial = razaoSocial.trim();
      if (endereco.trim()) input.endereco = endereco.trim();
      if (telefone.trim()) input.telefone = telefone.trim();

      const resultado = await adicionarArtista(input);
      onCriado({
        nomeArtista: nome.trim(),
        username: resultado.usernameCompleto,
        senha: resultado.senhaTemporaria,
      });
    } catch (e) {
      setErroGeral((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  // Conteúdo do formulário — usado tanto no modal quanto inline.
  const conteudo = (
    <div
      className={
        modoInline
          ? "bg-surface border border-border rounded w-full"
          : "bg-surface border border-border rounded w-full max-w-[560px] max-h-[92vh] overflow-y-auto"
      }
      style={modoInline ? undefined : { boxShadow: "0 24px 60px var(--shadow-color)" }}
      onClick={modoInline ? undefined : (e) => e.stopPropagation()}
    >
      {!modoInline && (
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Music size={16} style={{ color: "var(--brand)" }} />
            <div className="section-title">{t("Novo artista")}</div>
          </div>
          <button onClick={onCancelar} className="btn-ghost p-1.5 rounded" aria-label={t("Fechar")}>
            <X size={18} />
          </button>
        </div>
      )}

        <div className="p-4 flex flex-col gap-5">
          {/* Seção 1 — Dados básicos */}
          <Secao titulo={t("Dados básicos")}>
            <Campo label={t("Nome do artista")} erro={erros.has("nome")}>
              <input
                value={nome}
                onChange={(e) => {
                  const v = e.target.value;
                  setNome(v);
                  if (v.trim()) limparErro("nome");
                  // Espelha o username enquanto o usuário não tiver
                  // mexido manualmente no campo de login
                  if (!usernameFoiEditado) {
                    setUsernameRaiz(normalizarUsername(v));
                    limparErro("username");
                  }
                }}
                placeholder={t("Ex: DJ Lunar")}
                className={`campo-input${erros.has("nome") ? " erro" : ""}`}
                autoFocus
              />
              {colisaoNome === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  {t("Já existe um artista ATIVO com esse nome. Escolha outro.")}
                </p>
              )}
              {colisaoNome === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  {t("Existe um artista na")} <strong>{t("lixeira")}</strong> {t("com esse nome. Restaure ou apague pra reutilizar.")}
                </p>
              )}
            </Campo>

            <Campo label={t("País e cidade onde reside")} erro={erros.has("cidade")}>
              <CidadeGlobalAutocomplete
                value={cidade}
                onChange={(c) => {
                  setCidade(c);
                  if (c) limparErro("cidade");
                }}
                onPaisChange={setPais}
                erro={erros.has("cidade")}
                placeholder={t("Ex: São Paulo, Belo Horizonte...")}
              />
            </Campo>
          </Secao>

          {/* Seção — Dados pessoais (CONTRATADO) */}
          <SecaoDadosContrato
            pais={pais}
            setPais={setPais}
            nomeLegal={nomeLegal}
            setNomeLegal={(v) => {
              setNomeLegal(v);
              if (v.trim()) limparErro("nomeLegal");
            }}
            documentoTipo={documentoTipo}
            setDocumentoTipo={setDocumentoTipo}
            documento={documento}
            setDocumento={(v) => {
              setDocumento(v);
              if (documentoValido(v, tipoDocumentoPorDigitos(v))) limparErro("documento");
              // Voltou a ser CPF → some o campo razão social (limpa o erro dele).
              if (tipoDocumentoPorDigitos(v) !== "cnpj") limparErro("razaoSocial");
            }}
            razaoSocial={razaoSocial}
            setRazaoSocial={(v) => {
              setRazaoSocial(v);
              if (v.trim()) limparErro("razaoSocial");
            }}
            endereco={endereco}
            setEndereco={setEndereco}
            telefone={telefone}
            setTelefone={setTelefone}
            dataNascimento={dataNascimento}
            setDataNascimento={setDataNascimento}
            pix={pix}
            setPix={setPix}
            erros={{
              nomeLegal: erros.has("nomeLegal"),
              documento: erros.has("documento"),
              razaoSocial: erros.has("razaoSocial"),
            }}
          />

          <SeletorDeCor cor={cor} onChange={setCor} />

          {/* Tag visual do tipo de cadastro */}
          <div className="flex items-center gap-2">
            <span
              className="text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {t("Artista")}
            </span>
          </div>

          {/* Seção 2 — Acesso ao sistema */}
          <Secao titulo={t("Acesso ao sistema")}>
            <Campo label={t("Login (username)")} erro={erros.has("username")}>
              <div
                className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong"
                style={erros.has("username") ? { borderColor: "var(--danger)" } : undefined}
              >
                {/* Input cresce conforme o usuário digita (largura em `ch`
                    casa com a font-mono — sem espaço sobrando entre o
                    que foi digitado e o sufixo da agência). */}
                <input
                  value={usernameRaiz}
                  onChange={(e) => {
                    setUsernameFoiEditado(true);
                    setUsernameRaiz(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    );
                    limparErro("username");
                  }}
                  placeholder="djlunar"
                  style={{
                    width: `${Math.max(
                      usernameRaiz.length || "djlunar".length,
                      4
                    )}ch`,
                  }}
                  className="bg-transparent outline-none text-sm text-primary placeholder:text-muted font-mono"
                />
                <span className="text-sm text-muted font-mono whitespace-nowrap">
                  -{slugAgencia || "agencia"}
                </span>
                {/* Botão copiar — só ativa quando o username completo é
                    válido. Copia "raiz-slug" pronto pra colar. */}
                <button
                  type="button"
                  onClick={() => {
                    if (!usernameValido || !usernameCompleto) return;
                    navigator.clipboard
                      .writeText(usernameCompleto)
                      .then(() => {
                        setCopiouUsername(true);
                        setTimeout(() => setCopiouUsername(false), 2000);
                      });
                  }}
                  disabled={!usernameValido}
                  className="ml-auto btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={t("Copiar username completo")}
                  title={
                    usernameValido
                      ? t("Copiar username completo")
                      : t("Preencha um username válido pra copiar")
                  }
                >
                  {copiouUsername ? (
                    <CheckCircle2
                      size={14}
                      style={{ color: "var(--success)" }}
                    />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              {usernameCompleto && !usernameValido && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--danger)" }}
                >
                  {t("Use 3+ chars (letras, números, hífen)")}
                </p>
              )}
              {usernameValido && colisaoUsername === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  {t("Esse login já está em uso por outro artista ATIVO.")}
                </p>
              )}
              {usernameValido && colisaoUsername === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  {t("Esse login pertence a um artista na")} <strong>{t("lixeira")}</strong>.
                  {t("Restaure ou apague pra reutilizar.")}
                </p>
              )}
              {usernameValido && !colisaoUsername && usernameCompleto && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--success)" }}
                >
                  {t("Login completo:")}{" "}
                  <strong className="font-mono text-primary">
                    {usernameCompleto}
                  </strong>
                </p>
              )}
            </Campo>

            <div
              className="text-xs rounded-md px-3 py-2 leading-relaxed"
              style={{
                backgroundColor: "color-mix(in srgb, var(--brand) 8%, transparent)",
                color: "var(--text-secondary)",
              }}
            >
              <strong>{t("Login:")}</strong> {t("fica salvo e você consegue ver depois na lista de artistas.")}
              <br />
              <strong>{t("Senha:")}</strong> {t("será gerada automaticamente (algo tipo")} <span className="font-mono">Lyra-Bravo-7421</span>) {t("e mostrada")} <strong>{t("só uma vez")}</strong> {t("ao final pra você copiar. Se perder, dá pra gerar uma nova clicando em")}{" "}
              <span className="inline-flex items-center gap-1 font-medium">
                <KeyRound size={11} /> {t("Senha")}
              </span>{" "}
              {t("na lista.")}
            </div>
          </Secao>

          {/* Seção 3 — Taxa de agência */}
          <Secao titulo={t("Taxa de agência")}>
            <div className="flex flex-col gap-1.5">
              {MODOS_TAXA.map((m) => {
                const sel = taxaModo === m;
                return (
                  <label
                    key={m}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${
                      sel
                        ? "border-border-strong bg-elevated"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="taxaModo"
                      checked={sel}
                      onChange={() => {
                        setTaxaModo(m);
                        if (m !== "perc-fixa" && m !== "valor-fixo") {
                          setTaxaValor("");
                          limparErro("taxaValor");
                          setErroGeral(null);
                        }
                      }}
                      className="mt-0"
                    />
                    <span className="text-sm flex-1">{t(LABELS_TAXA_MODO[m])}</span>
                    {sel && (m === "perc-fixa" || m === "valor-fixo") && (
                      <div className="flex items-center gap-1">
                        {m === "valor-fixo" && (
                          <span className="text-xs text-muted">R$</span>
                        )}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={taxaValor}
                          onChange={(e) => {
                            setTaxaValor(e.target.value);
                            limparErro("taxaValor");
                            setErroGeral(null);
                          }}
                          placeholder={m === "perc-fixa" ? "15" : "500"}
                          className="bg-main border border-border rounded px-2 py-0.5 text-sm w-20 text-right outline-none focus:border-border-strong"
                          style={
                            erros.has("taxaValor")
                              ? { borderColor: "var(--danger)" }
                              : undefined
                          }
                          onClick={(e) => e.preventDefault()}
                        />
                        {m === "perc-fixa" && (
                          <span className="text-xs text-muted">%</span>
                        )}
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {t("Nos modos")} <strong>{t("variáveis")}</strong>, {t("vendedor/admin define o valor da taxa a cada orçamento.")}
            </p>
          </Secao>

          {/* Seção 4 — Rider de camarim */}
          <Secao titulo={`${t("Rider de Camarim")} (${riderCamarim.length}/${LIMITE_RIDER_CAMARIM})`}>
            <ListaRider
              itens={riderCamarim}
              onChange={setRiderCamarim}
              catalogoSugestoes={CATALOGO_CAMARIM}
              placeholderItem="Ex: Jack Daniels"
              limite={LIMITE_RIDER_CAMARIM}
            />
          </Secao>

          {/* Seção 5 — Rider de efeitos */}
          <Secao titulo={`${t("Rider de Efeitos")} (${riderEfeitos.length}/${LIMITE_RIDER_EFEITOS})`}>
            <ListaRider
              itens={riderEfeitos}
              onChange={setRiderEfeitos}
              catalogoSugestoes={CATALOGO_EFEITOS}
              placeholderItem="Ex: CO²"
              limite={LIMITE_RIDER_EFEITOS}
            />
          </Secao>

          {/* Seção 6 — Rider técnico */}
          <Secao titulo={`${t("Rider técnico")} (${riderTecnico.length}/${LIMITE_RIDER_TECNICO})`}>
            <ListaRider
              itens={riderTecnico}
              onChange={setRiderTecnico}
              catalogoSugestoes={CATALOGO_TECNICO}
              placeholderItem="Ex: CDJ-3000"
              limite={LIMITE_RIDER_TECNICO}
            />
          </Secao>

          {/* Seção 7 — Privacidade (permissões do DJ) */}
          <Secao titulo={t("Permissões — o que ele pode ver/fazer")}>
            <PrivacidadePills valor={privacidade} onChange={setPrivacidade} />
          </Secao>

          {(erroGeral || msgErros) && (
            <div
              className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                color: "var(--danger)",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              <AlertCircle size={13} className="flex-shrink-0" />
              {erroGeral ?? msgErros}
            </div>
          )}
        </div>

        <div
          className={
            modoInline
              ? "flex justify-end gap-2 p-4 border-t border-border bg-surface"
              : "flex justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-surface"
          }
        >
          {!modoInline && (
            <button onClick={onCancelar} className="btn btn-secondary text-sm">
              {t("Cancelar")}
            </button>
          )}
          <button
            onClick={salvar}
            disabled={enviando || temColisao}
            className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              temColisao
                ? t("Resolva os avisos de nome/login antes de cadastrar")
                : undefined
            }
          >
            <Plus size={14} />
            {enviando
              ? t("Cadastrando...")
              : t("Cadastrar em {nome}", { nome: nomeAgencia || t("agência") })}
          </button>
        </div>
      </div>
  );

  if (modoInline) return conteudo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay-scrim)" }}
      onClick={onCancelar}
    >
      {conteudo}
    </div>
  );
}

// ============================================================
// Modal — Editar artista
// ============================================================

type EditarProps = {
  artista: ArtistaParaEdicao;
  slugAgencia: string;
  onCancelar: () => void;
  onSalvo: () => void;
  /** Dispara o reset de senha — o caller mostra modal de credenciais. */
  onResetarSenha: () => Promise<void>;
  /**
   * Mesmas listas usadas no cadastro novo, MAS já excluindo o próprio
   * artista sendo editado (pra que ele não colida consigo mesmo).
   */
  nomesExistentes: string[];
  nomesNaLixeira: string[];
  usernamesExistentes: string[];
  usernamesNaLixeira: string[];
  /** Render inline (sem overlay de modal) — usado dentro do perfil da Agência. */
  modoInline?: boolean;
};

type DadosConta = {
  email: string;
  emailVerificado: boolean;
  emailFakeInterno: boolean;
  senhaPadrao: boolean;
  /** Senha em plaintext — só vem quando senhaPadrao=true E foi gerada após migration 28. */
  senhaPadraoValor: string | null;
};

function ModalEditarArtista({
  artista,
  slugAgencia,
  onCancelar,
  onSalvo,
  onResetarSenha,
  nomesExistentes,
  nomesNaLixeira,
  usernamesExistentes,
  usernamesNaLixeira,
  modoInline = false,
}: EditarProps) {
  const t = useT();
  const { atualizarArtista } = useWorkspace();
  const { confirmar, confirmador } = useConfirmar();

  // Username "raiz" — o que aparece antes do "-slug". Derivado do
  // username completo no banco. Ex: "brunosocek-twobookings" → "brunosocek"
  const usernameRaizInicial = useMemo(
    () =>
      artista.usernameAtual.endsWith(`-${slugAgencia}`)
        ? artista.usernameAtual.slice(0, -`-${slugAgencia}`.length)
        : artista.usernameAtual,
    [artista.usernameAtual, slugAgencia]
  );

  // Estado dos campos editáveis
  const [nome, setNome] = useState(artista.nome);
  const [cor, setCor] = useState(artista.cor);
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(
    () =>
      // Prefere a cidade GLOBAL (join por cidade_id — qualquer país); cai no
      // denormalizado legado (só-BR) pra artistas antigos sem cidade_id.
      cidadeParaEscolhida(artista.cidade ?? null) ??
      (artista.cidadeIbgeId && artista.cidadeNome && artista.cidadeUf
        ? {
            ibgeId: artista.cidadeIbgeId,
            nome: artista.cidadeNome,
            uf: artista.cidadeUf,
            pais: "BR",
          }
        : null)
  );
  const [usernameRaiz, setUsernameRaiz] = useState(usernameRaizInicial);
  // Feedback do botão de copiar senha aleatória do bloco "Senha".
  const [copiouSenhaPadrao, setCopiouSenhaPadrao] = useState(false);
  const [taxaModo, setTaxaModo] = useState<TaxaAgenciaModo>(artista.taxaModo);
  const [taxaValor, setTaxaValor] = useState<string>(
    artista.taxaValor !== undefined ? String(artista.taxaValor) : ""
  );
  const [riderCamarim, setRiderCamarim] = useState<string[]>(artista.riderCamarim);
  const [riderEfeitos, setRiderEfeitos] = useState<string[]>(artista.riderEfeitos);
  const [riderTecnico, setRiderTecnico] = useState<string[]>(artista.riderTecnico);
  const [privacidade, setPrivacidade] = useState<PrivacidadeDj>(artista.privacidade);
  // Acesso ao sistema: ligado = pode entrar; desligado = bloqueado/suspenso.
  // Mapeia !acessoSuspenso; salvo no patch como acesso_suspenso.
  const [acessoAtivo, setAcessoAtivo] = useState(!artista.acessoSuspenso);

  // Dados pessoais (CONTRATADO) — pré-preenchidos do artista.
  const [pais, setPais] = useState<Country>(
    () =>
      buscarPais(artista.pais ?? "BR").find(
        (p) => p.code === (artista.pais ?? "BR").toUpperCase()
      ) ?? BRASIL
  );
  const [nomeLegal, setNomeLegal] = useState(artista.nomeLegal ?? "");
  const [documentoTipo, setDocumentoTipo] = useState<DocumentoTipo>(
    artista.documentoTipo ?? "cpf"
  );
  const [documento, setDocumento] = useState(artista.documento ?? "");
  const [razaoSocial, setRazaoSocial] = useState(artista.razaoSocial ?? "");
  const [endereco, setEndereco] = useState(artista.endereco ?? "");
  const [telefone, setTelefone] = useState(artista.telefone ?? "");
  const [dataNascimento, setDataNascimento] = useState(artista.dataNascimento ?? "");
  const [pix, setPix] = useState(artista.pix ?? "");

  // Dados da conta (email + verificado) — async ao abrir
  const [conta, setConta] = useState<DadosConta | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(true);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Feedback do botão de copiar o username completo (Acesso ao sistema).
  const [copiouUsername, setCopiouUsername] = useState(false);

  // Carrega os dados da conta auth (email + verificado)
  useEffect(() => {
    let ativo = true;
    setCarregandoConta(true);
    fetch(`/api/artistas/${artista.id}/conta`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DadosConta;
      })
      .then((d) => {
        if (!ativo) return;
        setConta(d);
      })
      .catch(() => {
        if (!ativo) return;
        setConta(null);
      })
      .finally(() => {
        if (ativo) setCarregandoConta(false);
      });
    return () => {
      ativo = false;
    };
  }, [artista.id]);

  const usernameValido = useMemo(() => {
    const v = usernameRaiz.trim();
    if (v.length < 3) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v);
  }, [usernameRaiz]);

  // Username completo (raiz + sufixo da agência) — usado no botão copiar.
  const usernameCompleto = useMemo(() => {
    if (!usernameRaiz.trim()) return "";
    return `${usernameRaiz.trim().toLowerCase()}-${slugAgencia}`;
  }, [usernameRaiz, slugAgencia]);

  // Colisões em tempo real — mesmo padrão do cadastro novo. As listas
  // recebidas via props já excluem o próprio artista sendo editado.
  const colisaoNome: "ativo" | "lixeira" | null = useMemo(() => {
    const n = nome.trim().toLowerCase();
    if (!n) return null;
    if (nomesExistentes.includes(n)) return "ativo";
    if (nomesNaLixeira.includes(n)) return "lixeira";
    return null;
  }, [nome, nomesExistentes, nomesNaLixeira]);

  const colisaoUsername: "ativo" | "lixeira" | null = useMemo(() => {
    const u = usernameRaiz.trim().toLowerCase();
    if (!u) return null;
    if (usernamesExistentes.includes(u)) return "ativo";
    if (usernamesNaLixeira.includes(u)) return "lixeira";
    return null;
  }, [usernameRaiz, usernamesExistentes, usernamesNaLixeira]);

  const temColisao = colisaoNome !== null || colisaoUsername !== null;

  const usernameMudou = usernameRaiz.trim() !== usernameRaizInicial;

  function validar(): string | null {
    const n = nome.trim();
    if (!n) return t("Informe o nome do artista.");
    if (colisaoNome === "ativo")
      return t("Já existe um artista com esse nome na sua agência.");
    if (colisaoNome === "lixeira")
      return t("Existe um artista na lixeira com esse nome (\"{n}\"). Restaure ou apague antes de reutilizar.", { n });
    if (!cidade) return t("Informe a cidade onde o artista reside.");
    const erroContrato = validarDadosContrato(
      nomeLegal,
      documentoTipo,
      documento,
      razaoSocial,
      t
    );
    if (erroContrato) return erroContrato;
    if (!usernameValido)
      return t("Username inválido (3+ chars, letras/números/hífen).");
    if (colisaoUsername === "ativo")
      return t("Esse login já está em uso por outro artista da sua agência.");
    if (colisaoUsername === "lixeira")
      return t("Esse login pertence a um artista da lixeira. Restaure ou apague antes de reutilizar.");
    if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) {
        return t("Informe o valor da taxa ({modo}).", { modo: LABELS_TAXA_MODO[taxaModo] });
      }
      if (taxaModo === "perc-fixa" && v > 100) {
        return t("Porcentagem não pode ser maior que 100%.");
      }
    }
    return null;
  }

  async function salvar(): Promise<boolean> {
    setErro(null);
    // TRAVA: data digitada pela metade não vira ISO e sumiria em silêncio.
    if (haDataPendente()) {
      setErro(t("Complete a data (dd/mm/aaaa) antes de salvar — o campo em vermelho está incompleto."));
      return false;
    }
    const v = validar();
    if (v) {
      setErro(v);
      return false;
    }
    setEnviando(true);
    try {
      // Cidade global canônica: resolve pro UUID do catálogo (qualquer país).
      // Falha ao resolver → cidadeId undefined → atualizarArtista mantém o atual.
      let cidadeId: string | undefined;
      try {
        cidadeId = (await resolverCidade(cidade!)).id;
      } catch {
        /* segue sem */
      }
      const patch: Partial<NovoArtistaInput> = {
        nome: nome.trim(),
        cor,
        cidadeIbgeId: cidade!.ibgeId ?? "",
        cidadeNome: cidade!.nome,
        cidadeUf: cidade!.uf,
        cidadeId,
        taxaModo,
        taxaValor:
          taxaModo === "perc-fixa" || taxaModo === "valor-fixo"
            ? parseFloat(taxaValor.replace(",", "."))
            : undefined,
        riderCamarim,
        riderEfeitos,
        riderTecnico,
        privacidade,
        // Acesso ao sistema — toggle "Acesso ativo" mapeia !acessoSuspenso.
        acesso_suspenso: !acessoAtivo,
        // Dados do CONTRATADO (sempre enviados — validados acima).
        pais: pais.code,
        nomeLegal: nomeLegal.trim(),
        documento: documento.trim(),
        documentoTipo,
        razaoSocial: documentoTipo === "cnpj" ? razaoSocial.trim() : "",
        endereco: endereco.trim(),
        telefone: telefone.trim(),
        dataNascimento: dataNascimento || undefined,
        // PIX: só BR; envia string vazia p/ limpar se trocar de país.
        pix: pais.code === "BR" ? pix.trim() : "",
        // E-mail: o admin não define mais — o próprio artista cadastra e
        // verifica depois do 1º login. Aqui só exibimos o e-mail da conta.
      };
      // Username só se mudou (evita trabalho desnecessário no backend)
      if (usernameMudou) {
        patch.usernameRaiz = usernameRaiz.trim().toLowerCase();
      }
      await atualizarArtista(artista.id, patch);
      onSalvo();
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setEnviando(false);
    }
  }

  // ---- Guarda de "alterações não salvas" ----
  // Assinatura de TODOS os campos editáveis. A baseline é capturada no 1º
  // render (form recém-aberto = pristine), então um form intocado dá
  // sujo=false. Muda qualquer campo → sujo=true.
  const assinatura = useMemo(
    () =>
      JSON.stringify({
        nome,
        cor,
        cidade: cidade
          ? `${cidade.pais}|${cidade.uf}|${cidade.nome}|${cidade.ibgeId ?? cidade.geonameId ?? ""}`
          : "",
        usernameRaiz: usernameRaiz.trim().toLowerCase(),
        taxaModo,
        taxaValor,
        riderCamarim,
        riderEfeitos,
        riderTecnico,
        privacidade,
        acessoAtivo,
        pais: pais.code,
        nomeLegal,
        documentoTipo,
        documento,
        razaoSocial,
        endereco,
        telefone,
        dataNascimento,
        pix,
      }),
    [
      nome,
      cor,
      cidade,
      usernameRaiz,
      taxaModo,
      taxaValor,
      riderCamarim,
      riderEfeitos,
      riderTecnico,
      privacidade,
      acessoAtivo,
      pais,
      nomeLegal,
      documentoTipo,
      documento,
      razaoSocial,
      endereco,
      telefone,
      dataNascimento,
      pix,
    ]
  );
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = assinatura;
  const sujo = assinatura !== baselineRef.current;

  // Popup de confirmação da saída LOCAL (botão Cancelar).
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const cancelar = () => {
    if (sujo) setConfirmarSaida(true);
    else onCancelar();
  };

  // Registra a guarda GLOBAL (interceptar navegação pra outra tela). Reflete
  // sempre o `sujo`/`salvar` mais recente via refs, sem re-registrar a cada
  // render. Fora da dashboard (sem provider) simplesmente não faz nada.
  const nav = useNavegacaoOpcional();
  const registrarGuarda = nav?.registrarGuarda;
  const limparGuarda = nav?.limparGuarda;
  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  useEffect(() => {
    if (!registrarGuarda || !limparGuarda) return;
    registrarGuarda(() => ({ sujo: sujoRef.current, salvar: salvarRef.current }));
    return () => limparGuarda();
  }, [registrarGuarda, limparGuarda]);

  // ---- Perfil editável ----
  // Mesma cara do perfil read-only do AbaArtistas (header com banda de cor
  // + avatar 64px, depois um grid de cards), com os campos editáveis e
  // Salvar/Cancelar no topo. Único layout do editar — sempre renderizado
  // inline (dentro do card do artista selecionado), nunca como modal.
  const boxInline = (
    <>
      {/* Header do perfil — editável */}
      <div className="card p-0 overflow-hidden">
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${cor}, ${cor}66)`,
          }}
        />
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-4 flex-wrap">
            <span
              className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${cor}, ${cor}99)`,
              }}
            >
              {iniciaisDoNome(nome) || "?"}
            </span>
            <div className="flex-1 min-w-0">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={t("Nome do artista")}
                className="campo-input text-xl font-bold"
              />
              {colisaoNome === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  {t("Já existe um artista ATIVO com esse nome. Escolha outro.")}
                </p>
              )}
              {colisaoNome === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  {t("Existe um artista na")} <strong>{t("lixeira")}</strong> {t("com esse nome. Restaure ou apague pra reutilizar.")}
                </p>
              )}
            </div>

            {/* Ações: Salvar / Cancelar */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button
                onClick={cancelar}
                className="btn btn-secondary text-sm"
              >
                {t("Cancelar")}
              </button>
              <button
                onClick={salvar}
                disabled={enviando || temColisao}
                className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                title={
                  temColisao
                    ? t("Resolva os avisos de nome/login antes de salvar")
                    : undefined
                }
              >
                <Check size={14} />
                {enviando ? t("Salvando...") : t("Salvar alterações")}
              </button>
            </div>
          </div>

          {/* Corpo do header: Cor + país/cidade (com onPaisChange p/ o
              documento e o DDI seguirem o país) + dados pessoais
              país-aware (mesmo conteúdo do layout modal). */}
          <div className="flex flex-col gap-4">
            <SeletorDeCor cor={cor} onChange={setCor} />
            <div className="border-t border-border" />
            <Campo label={t("País e cidade onde reside")}>
              <CidadeGlobalAutocomplete
                value={cidade}
                onChange={setCidade}
                onPaisChange={setPais}
                placeholder={t("Ex: São Paulo, Belo Horizonte...")}
              />
            </Campo>
            <SecaoDadosContrato
              pais={pais}
              setPais={setPais}
              nomeLegal={nomeLegal}
              setNomeLegal={setNomeLegal}
              documentoTipo={documentoTipo}
              setDocumentoTipo={setDocumentoTipo}
              documento={documento}
              setDocumento={setDocumento}
              razaoSocial={razaoSocial}
              setRazaoSocial={setRazaoSocial}
              endereco={endereco}
              setEndereco={setEndereco}
              telefone={telefone}
              setTelefone={setTelefone}
              dataNascimento={dataNascimento}
              setDataNascimento={setDataNascimento}
              pix={pix}
              setPix={setPix}
            />
          </div>
        </div>
      </div>

      {/* Grid de cards editáveis */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Acesso ao sistema */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
            <KeyRound size={12} style={{ color: "var(--brand)" }} />
            {t("Acesso ao sistema")}
          </div>

          {/* Login (username) */}
          <Campo label={t("Login (username)")}>
            <div className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
              {/* Input com largura dinâmica (em ch + font-mono) — o
                  sufixo da agência fica colado na ponta do que foi
                  digitado, mesmo padrão do cadastro novo. */}
              <input
                value={usernameRaiz}
                onChange={(e) =>
                  setUsernameRaiz(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                placeholder="djlunar"
                style={{
                  width: `${Math.max(
                    usernameRaiz.length || "djlunar".length,
                    4
                  )}ch`,
                }}
                className="bg-transparent outline-none text-sm text-primary placeholder:text-muted font-mono"
              />
              <span className="text-sm text-muted font-mono whitespace-nowrap">
                -{slugAgencia}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!usernameValido || !usernameCompleto) return;
                  navigator.clipboard
                    .writeText(usernameCompleto)
                    .then(() => {
                      setCopiouUsername(true);
                      setTimeout(() => setCopiouUsername(false), 2000);
                    });
                }}
                disabled={!usernameValido}
                className="ml-auto btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t("Copiar username completo")}
                title={
                  usernameValido
                    ? t("Copiar username completo")
                    : t("Preencha um username válido pra copiar")
                }
              >
                {copiouUsername ? (
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            {!usernameValido && usernameRaiz.length > 0 && (
              <p className="text-[0.7rem] mt-1" style={{ color: "var(--danger)" }}>
                {t("Use 3+ chars (letras, números, hífen)")}.
              </p>
            )}
            {usernameValido && colisaoUsername === "ativo" && (
              <p
                className="text-xs mt-1 inline-flex items-center gap-1"
                style={{ color: "var(--danger)" }}
              >
                <AlertCircle size={11} />
                {t("Esse login já está em uso por outro artista ATIVO.")}
              </p>
            )}
            {usernameValido && colisaoUsername === "lixeira" && (
              <p
                className="text-xs mt-1 inline-flex items-center gap-1"
                style={{ color: "var(--warning)" }}
              >
                <AlertTriangle size={11} />
                {t("Esse login pertence a um artista na")} <strong>{t("lixeira")}</strong>.
                {t("Restaure ou apague pra reutilizar.")}
              </p>
            )}
            {usernameMudou && usernameValido && !colisaoUsername && (
              <div
                className="flex items-start gap-2 text-[0.7rem] mt-1 rounded-md px-2 py-1.5"
                style={{
                  backgroundColor: "rgba(245,158,11,0.08)",
                  color: "var(--warning)",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}
              >
                <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                <span>
                  {t("O artista vai precisar usar este novo login na próxima entrada.")}
                </span>
              </div>
            )}
          </Campo>

          {/* Conta: e-mail + senha */}
          {carregandoConta ? (
            <div className="flex items-center gap-2 text-sm text-muted py-2">
              <Loader2 size={14} className="animate-spin" />
              {t("Carregando dados da conta...")}
            </div>
          ) : !conta ? (
            <p className="text-xs text-danger">
              {t("Não foi possível carregar os dados da conta.")}
            </p>
          ) : (
            <>
              <Campo label={t("E-mail cadastrado")}>
                {conta.emailFakeInterno ? (
                  /* Sem e-mail real — o próprio artista cadastra depois. */
                  <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                    <Mail size={14} className="text-muted flex-shrink-0" />
                    <span className="flex-1 text-sm text-muted italic">
                      {t("Usuário não cadastrou nenhum email")}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Tem e-mail real — só leitura, com selo de verificação. */}
                    <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                      <Mail size={14} className="text-muted flex-shrink-0" />
                      <span className="flex-1 text-sm text-secondary break-all">
                        {conta.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[0.7rem]">
                      {conta.emailVerificado ? (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: "var(--success)" }}
                        >
                          <ShieldCheck size={11} />
                          {t("Verificado")}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: "var(--warning)" }}
                        >
                          <AlertTriangle size={11} />
                          {t("Não verificado")}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </Campo>

              {/* ---- Acesso ativo (liga/desliga a entrada no sistema) ---- */}
              <LinhaEscopo
                label={t("Acesso ativo")}
                descricaoLigado={t("O artista pode entrar no sistema.")}
                descricaoDesligado={t("Acesso bloqueado — o artista não consegue entrar.")}
                valor={acessoAtivo}
                onChange={setAcessoAtivo}
              />

              {/* ---- Senha ---- */}
              <Campo label={t("Senha")}>
                {conta.senhaPadrao && conta.senhaPadraoValor ? (
                  <>
                    {/* Senha padrão conhecida: mostra + botão copiar */}
                    <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                      <Lock size={14} className="text-muted flex-shrink-0" />
                      <span className="font-mono text-sm text-primary flex-1 break-all select-all">
                        {conta.senhaPadraoValor}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(conta.senhaPadraoValor!)
                            .then(() => {
                              setCopiouSenhaPadrao(true);
                              setTimeout(
                                () => setCopiouSenhaPadrao(false),
                                2000
                              );
                            });
                        }}
                        className="btn-ghost p-1.5 rounded"
                        aria-label={t("Copiar senha")}
                      >
                        {copiouSenhaPadrao ? (
                          <CheckCircle2
                            size={14}
                            style={{ color: "var(--success)" }}
                          />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                    <div
                      className="text-[0.7rem] mt-1.5 inline-flex items-center gap-1"
                      style={{ color: "var(--warning)" }}
                    >
                      <AlertTriangle size={11} />
                      {t("Senha padrão gerada pelo sistema — usuário ainda não trocou.")}
                    </div>
                  </>
                ) : conta.senhaPadrao ? (
                  <div
                    className="flex items-start gap-2 text-xs rounded-md px-3 py-2.5 leading-relaxed"
                    style={{
                      backgroundColor: "rgba(245,158,11,0.08)",
                      color: "var(--warning)",
                      border: "1px solid rgba(245,158,11,0.2)",
                    }}
                  >
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      {t("Usuário ainda está com a")} <strong>{t("senha padrão")}</strong>{" "}
                      {t("gerada pelo sistema, mas o valor não está disponível (artista criado antes desta versão). Gere uma nova abaixo pra conseguir copiar.")}
                    </span>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 text-xs rounded-md px-3 py-2.5"
                    style={{
                      backgroundColor: "rgba(34,197,94,0.08)",
                      color: "var(--success)",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    <Lock size={13} className="flex-shrink-0" />
                    <span>{t("Senha já foi alterada pelo usuário.")}</span>
                  </div>
                )}
              </Campo>

              <button
                type="button"
                onClick={async () => {
                  if (
                    await confirmar({
                      titulo: t("Gerar uma nova senha aleatória pro artista {nome}?", { nome: artista.nome }),
                    })
                  ) {
                    void onResetarSenha();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors hover:bg-elevated"
                style={{
                  borderColor: "var(--brand)",
                  color: "var(--brand)",
                }}
              >
                <KeyRound size={14} />
                {t("Gerar nova senha aleatória")}
              </button>
            </>
          )}
        </div>

        {/* Permissões */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
            <ShieldCheck size={12} style={{ color: "var(--brand)" }} />
            {t("Permissões")}
          </div>
          <p className="text-xs text-muted -mt-1">
            {t("Escolha o nível de cada área. Cada opção diz exatamente o que o artista pode fazer.")}
          </p>
          <PrivacidadePills valor={privacidade} onChange={setPrivacidade} />
        </div>

        {/* Rider de camarim */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("Rider de camarim ({n}/{max})", { n: riderCamarim.length, max: LIMITE_RIDER_CAMARIM })}
          </div>
          <ListaRider
            itens={riderCamarim}
            onChange={setRiderCamarim}
            catalogoSugestoes={CATALOGO_CAMARIM}
            placeholderItem="Ex: Jack Daniels"
            limite={LIMITE_RIDER_CAMARIM}
          />
        </div>

        {/* Rider de efeitos */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("Rider de efeitos ({n}/{max})", { n: riderEfeitos.length, max: LIMITE_RIDER_EFEITOS })}
          </div>
          <ListaRider
            itens={riderEfeitos}
            onChange={setRiderEfeitos}
            catalogoSugestoes={CATALOGO_EFEITOS}
            placeholderItem="Ex: CO²"
            limite={LIMITE_RIDER_EFEITOS}
          />
        </div>

        {/* Rider técnico */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("Rider técnico ({n}/{max})", { n: riderTecnico.length, max: LIMITE_RIDER_TECNICO })}
          </div>
          <ListaRider
            itens={riderTecnico}
            onChange={setRiderTecnico}
            catalogoSugestoes={CATALOGO_TECNICO}
            placeholderItem="Ex: CDJ-3000"
            limite={LIMITE_RIDER_TECNICO}
          />
        </div>

        {/* Taxa de agência */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
            {taxaModo.startsWith("perc") ? (
              <Percent size={12} style={{ color: "var(--brand)" }} />
            ) : (
              <DollarSign size={12} style={{ color: "var(--brand)" }} />
            )}
            {t("Taxa de agência")}
          </div>
          <div className="flex flex-col gap-1.5">
            {MODOS_TAXA.map((m) => {
              const sel = taxaModo === m;
              return (
                <label
                  key={m}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border transition-colors ${
                    sel
                      ? "border-border-strong bg-elevated"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="taxaModoEditInline"
                    checked={sel}
                    onChange={() => {
                      setTaxaModo(m);
                      if (m !== "perc-fixa" && m !== "valor-fixo") {
                        setTaxaValor("");
                      }
                    }}
                  />
                  <span className="text-sm flex-1">{t(LABELS_TAXA_MODO[m])}</span>
                  {sel && (m === "perc-fixa" || m === "valor-fixo") && (
                    <div className="flex items-center gap-1">
                      {m === "valor-fixo" && (
                        <span className="text-xs text-muted">R$</span>
                      )}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={taxaValor}
                        onChange={(e) => setTaxaValor(e.target.value)}
                        placeholder={m === "perc-fixa" ? "15" : "500"}
                        className="bg-main border border-border rounded px-2 py-0.5 text-sm w-20 text-right outline-none focus:border-border-strong"
                        onClick={(e) => e.preventDefault()}
                      />
                      {m === "perc-fixa" && (
                        <span className="text-xs text-muted">%</span>
                      )}
                    </div>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {erro && (
        <div
          className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            color: "var(--danger)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <AlertCircle size={13} className="flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* Ações no FIM do form — mesmos handlers do topo (evita rolar até o
          cabeçalho pra salvar). */}
      <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
        <button onClick={cancelar} className="btn btn-secondary text-sm">
          {t("Cancelar")}
        </button>
        <button
          onClick={salvar}
          disabled={enviando || temColisao}
          className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
          title={
            temColisao
              ? t("Resolva os avisos de nome/login antes de salvar")
              : undefined
          }
        >
          <Check size={14} />
          {enviando ? t("Salvando...") : t("Salvar alterações")}
        </button>
      </div>

      {confirmarSaida && (
        <ConfirmarSaidaModal
          salvando={enviando}
          onCancelar={() => setConfirmarSaida(false)}
          onDescartar={() => {
            setConfirmarSaida(false);
            onCancelar();
          }}
          onSalvarESair={async () => {
            // salvar() já chama onSalvo() (fecha) no sucesso; no erro fica na
            // tela e o popup fecha pra mostrar a mensagem.
            await salvar();
            setConfirmarSaida(false);
          }}
        />
      )}
      {confirmador}
    </>
  );

  return boxInline;
}

// Nível de acesso de um módulo: nenhum → só vê → vê e age (cria/fecha/informa).
// Mapeia pros dois booleanos do modelo (Ver / Criar|Informar) sem mudar o schema.
type NivelAcessoTipo = "nenhum" | "ver" | "agir";

function nivelDe(ver: boolean, agiu: boolean): NivelAcessoTipo {
  return agiu ? "agir" : ver ? "ver" : "nenhum";
}

/**
 * Seletor de nível por módulo — substitui os toggles ambíguos.
 *
 * Em vez de dois switches "Ver"/"Criar" (que não deixam claro o que
 * ligado/desligado faz), mostra os níveis como botões de múltipla escolha
 * com rótulo explícito ("Não vê" · "Só vê" · "Vê e cria"). Genérico: serve
 * tanto pros módulos (3 níveis) quanto pra Contatos (2 opções).
 */
function SegmentedChoice<T extends string>({
  titulo,
  valor,
  opcoes,
  onChange,
}: {
  titulo: string;
  valor: T;
  opcoes: { val: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-medium text-primary">{titulo}</div>
      <div className="flex gap-1.5">
        {opcoes.map((o) => {
          const ativo = valor === o.val;
          return (
            <button
              key={o.val}
              type="button"
              onClick={() => onChange(o.val)}
              aria-pressed={ativo}
              className="flex-1 px-2 py-2 rounded-md text-xs font-medium border transition-colors text-center leading-tight"
              style={
                ativo
                  ? {
                      borderColor: "var(--brand)",
                      backgroundColor: "color-mix(in srgb, var(--brand) 14%, transparent)",
                      color: "var(--text-primary)",
                    }
                  : {
                      borderColor: "var(--border-color)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              <span className="block">{o.label}</span>
              {o.sub && <span className="block text-[0.65rem] text-muted mt-0.5">{o.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Bloco COMPLETO de privacidade do DJ — seletores segmentados (pills).
 *
 * Encapsula o mapeamento seletor <-> objeto `PrivacidadeDj` (ida e volta),
 * pra que criar (ModalNovoArtista) e editar (ModalEditarArtista) usem
 * EXATAMENTE a mesma UI e a mesma conversão. O componente recebe o objeto
 * inteiro e um onChange que devolve o objeto atualizado.
 *
 * Linhas: Agenda · Orçamentos · Vendas · Financeiro · Contratos · Contatos.
 */
function PrivacidadePills({
  valor,
  onChange,
}: {
  valor: PrivacidadeDj;
  onChange: (v: PrivacidadeDj) => void;
}) {
  const t = useT();

  // Deriva o nível do seletor a partir dos dois booleanos (ver/agir).
  // Orçamentos e Vendas agora são independentes.
  const nivelOrcamentos = nivelDe(valor.orcamentosVer, valor.orcamentosCriar);
  const nivelVendas = nivelDe(valor.vendasVer, valor.vendasCriar);
  const nivelFinanceiro = nivelDe(valor.financeiroVer, valor.financeiroInformar);

  return (
    <div className="flex flex-col gap-4">
      {/* Agenda — 3 estados: Básico (sem cachê/contato) / Leitura / Total */}
      <SegmentedChoice
        titulo={t("Agenda")}
        valor={
          valor.agendaTotal ? "total" : valor.agendaVerDetalhado ? "leitura" : "basico"
        }
        opcoes={[
          { val: "basico", label: t("Básico"), sub: t("sem valores nem contato") },
          { val: "leitura", label: t("Somente leitura") },
          { val: "total", label: t("Acesso total") },
        ]}
        onChange={(v) =>
          onChange({
            ...valor,
            agendaVerDetalhado: v !== "basico",
            agendaTotal: v === "total",
          })
        }
      />

      {/* Orçamentos — 3 estados, independente de Vendas */}
      <SegmentedChoice
        titulo={t("Orçamentos")}
        valor={nivelOrcamentos}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            orcamentosVer: n !== "nenhum",
            orcamentosCriar: n === "agir",
          })
        }
      />

      {/* Vendas — 3 estados, independente de Orçamentos */}
      <SegmentedChoice
        titulo={t("Vendas")}
        valor={nivelVendas}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            vendasVer: n !== "nenhum",
            vendasCriar: n === "agir",
          })
        }
      />

      {/* Financeiro — 3 estados */}
      <SegmentedChoice
        titulo={t("Financeiro")}
        valor={nivelFinanceiro}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            financeiroVer: n !== "nenhum",
            financeiroInformar: n === "agir",
          })
        }
      />

      {/* Contratos — 3 estados */}
      <SegmentedChoice
        titulo={t("Contratos")}
        valor={nivelDe(valor.contratosVer, valor.contratosCriar)}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "ver", label: t("Somente leitura") },
          { val: "agir", label: t("Acesso total"), sub: t("criar, editar e cancelar") },
        ]}
        onChange={(n) =>
          onChange({
            ...valor,
            contratosVer: n !== "nenhum",
            contratosCriar: n === "agir",
          })
        }
      />

      {/* Contatos — 3 estados (nenhum / próprios / todos) */}
      <SegmentedChoice
        titulo={t("Contatos")}
        valor={valor.contatos}
        opcoes={[
          { val: "nenhum", label: t("Sem acesso") },
          { val: "proprios", label: t("Somente os seus contatos") },
          { val: "todos", label: t("Todos os contatos da agência") },
        ]}
        onChange={(c) => onChange({ ...valor, contatos: c })}
      />

      <p className="text-xs text-muted leading-relaxed">
        {t("Nenhum artista vê os dados de outro (agenda, orçamentos, vendas, financeiro, contratos). A única exceção é o compartilhamento de contatos, se você liberar acima. Excluir contrato é uma ação exclusiva do admin — não é liberável aqui.")}
      </p>
    </div>
  );
}

// ============================================================
// Modal — Credenciais geradas (mostradas uma única vez)
// ============================================================

export function ModalCredenciais({
  nomeArtista,
  username,
  senha,
  onFechar,
}: {
  nomeArtista: string;
  username: string;
  senha: string;
  onFechar: () => void;
}) {
  const t = useT();
  const [copiou, setCopiou] = useState<"user" | "pass" | "ambos" | null>(null);
  const mostraUsuario = username !== "—";

  function copiar(texto: string, qual: "user" | "pass" | "ambos") {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiou(qual);
      setTimeout(() => setCopiou(null), 2000);
    });
  }

  // Texto consolidado pra copiar tudo de uma vez — formato pronto pra
  // colar no WhatsApp do artista.
  const textoCompleto = mostraUsuario
    ? `Login: ${username}\nSenha: ${senha}`
    : `Senha: ${senha}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay-scrim)" }}
    >
      <div
        className="bg-surface border border-border rounded w-full max-w-[420px]"
        style={{ boxShadow: "0 24px 60px var(--shadow-color)" }}
      >
        <div className="p-5 border-b border-border flex flex-col items-center text-center">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))",
              color: "var(--success)",
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div className="section-title">
            {mostraUsuario ? t("Artista cadastrado") : t("Senha redefinida")}
          </div>
          <div className="text-xs text-secondary mt-1">
            {mostraUsuario
              ? t("Copie e mande pro {nome}. Aparece só uma vez.", { nome: nomeArtista })
              : t("Nova senha do {nome}. Copie agora — aparece só uma vez.", { nome: nomeArtista })}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {mostraUsuario && (
            <div>
              <div className="text-xs font-medium text-secondary mb-1">{t("Login")}</div>
              <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                <span className="font-mono text-sm text-primary flex-1 break-all">
                  {username}
                </span>
                <button
                  onClick={() => copiar(username, "user")}
                  className="btn-ghost p-1.5 rounded"
                >
                  {copiou === "user" ? (
                    <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-secondary mb-1">{t("Senha")}</div>
            <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
              <span className="font-mono text-sm text-primary flex-1 break-all">
                {senha}
              </span>
              <button
                onClick={() => copiar(senha, "pass")}
                className="btn-ghost p-1.5 rounded"
              >
                {copiou === "pass" ? (
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>

          <div
            className="text-xs rounded-md px-3 py-2 mt-1"
            style={{
              backgroundColor: "rgba(245,158,11,0.08)",
              color: "var(--warning)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <strong>{t("Importante:")}</strong> {t("essas credenciais não ficam salvas. Se fechar essa janela, vai precisar gerar nova senha.")}
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => copiar(textoCompleto, "ambos")}
            className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
          >
            {copiou === "ambos" ? (
              <>
                <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                {t("Copiado!")}
              </>
            ) : (
              <>
                <Copy size={14} />
                {mostraUsuario ? t("Copiar login + senha") : t("Copiar senha")}
              </>
            )}
          </button>
          <button onClick={onFechar} className="btn btn-primary text-sm">
            {t("Entendi, fechar")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Seletor de cor — 10 cores + cor personalizada
// ============================================================

/**
 * Seletor visual de cor com 10 swatches padrão + 1 botão "personalizada"
 * que abre o color picker nativo. Quando o usuário escolhe uma cor que
 * não está no padrão, ela aparece como 11ª bolinha destacada.
 */
export function SeletorDeCor({
  cor,
  onChange,
}: {
  cor: string;
  onChange: (cor: string) => void;
}) {
  const t = useT();
  // A cor atual está nas predefinidas? Se não, é "personalizada".
  const ePersonalizada = !CORES.includes(cor);
  const [pickerAberto, setPickerAberto] = useState(false);
  // Ref do botão "+" — o popover usa pra calcular a altura vertical
  const botaoPickerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">
        {t("Cor de identificação")}
      </span>

      <div className="relative flex flex-wrap gap-2 items-center">
        {CORES.map((c) => {
          const sel = !ePersonalizada && c === cor;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Cor ${c}`}
              className="relative h-8 w-8 rounded-full transition-all hover:scale-110"
              style={{
                background: gradienteSutil(c),
                boxShadow: sel
                  ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${c}`
                  : "0 1px 2px var(--shadow-color)",
                transform: sel ? "scale(1.1)" : "scale(1)",
              }}
            >
              {sel && (
                <Check
                  size={14}
                  className="absolute inset-0 m-auto text-white drop-shadow"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}

        {/* Botão "cor personalizada" — quando ativo, vira a 11ª bolinha
            mostrando a cor escolhida com um anel destacado */}
        <button
          ref={botaoPickerRef}
          type="button"
          onClick={() => setPickerAberto((v) => !v)}
          aria-label={t("Escolher cor personalizada")}
          title={t("Cor personalizada")}
          className="relative h-8 w-8 rounded-full transition-all hover:scale-110 flex items-center justify-center overflow-hidden"
          style={{
            // Quando personalizada está ativa: mostra a cor escolhida
            // Quando inativa: mostra um gradient arco-íris como "hint" de paleta
            background: ePersonalizada
              ? gradienteSutil(cor)
              : "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #14b8a6, #3b82f6, #a855f7, #ec4899, #ef4444)",
            boxShadow: ePersonalizada
              ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${cor}`
              : "0 1px 2px var(--shadow-color)",
            transform: ePersonalizada ? "scale(1.1)" : "scale(1)",
          }}
        >
          {ePersonalizada ? (
            <Check
              size={14}
              className="text-white drop-shadow"
              strokeWidth={3}
            />
          ) : (
            <Plus
              size={14}
              className="text-white drop-shadow"
              strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 1px 2px var(--shadow-color))" }}
            />
          )}
        </button>

        {/* Hex da cor personalizada (preview legível) */}
        {ePersonalizada && (
          <span className="text-[0.7rem] font-mono text-muted ml-1 tabular-nums">
            {cor.toUpperCase()}
          </span>
        )}

        {/* Popover do color picker custom — fica centralizado na viewport */}
        {pickerAberto && (
          <ColorPicker
            cor={cor}
            anchorRef={botaoPickerRef}
            onApply={(novaCor) => {
              onChange(novaCor);
              setPickerAberto(false);
            }}
            onClose={() => setPickerAberto(false)}
          />
        )}
      </div>

      {/* Dica sutil */}
      <p className="text-[0.65rem] text-muted mt-0.5">
        {ePersonalizada
          ? t("Cor personalizada — clique pra trocar")
          : t("Clique no + pra escolher uma cor personalizada")}
      </p>
    </div>
  );
}

// ============================================================
// Helpers de UI
// ============================================================

// ---- Documento (CPF/CNPJ) + telefone: máscara e validação ----

/** Valida só a contagem de dígitos (11=CPF, 14=CNPJ) — não faz checksum. */
function documentoValido(valor: string, tipo: DocumentoTipo): boolean {
  return valor.replace(/\D/g, "").length === (tipo === "cpf" ? 11 : 14);
}

/** Deriva o tipo por contagem de dígitos: 12+ dígitos = CNPJ, senão CPF. */
export function tipoDocumentoPorDigitos(valor: string): DocumentoTipo {
  return valor.replace(/\D/g, "").length > 11 ? "cnpj" : "cpf";
}

/**
 * Campo ÚNICO de CPF/CNPJ (BR) — SEM seletor de tipo. Delega no
 * `InputDocumento` compartilhado (MESMO visual/placeholder/máscara do site
 * inteiro) e só acrescenta a sincronização do `documentoTipo` no pai,
 * derivado pela contagem de dígitos (11 = CPF, 14 = CNPJ) — o que dispara a
 * razão social quando vira CNPJ.
 */
export function InputDocumentoBR({
  documento,
  setDocumento,
  setDocumentoTipo,
  className,
}: {
  documento: string;
  setDocumento: (v: string) => void;
  setDocumentoTipo?: (v: DocumentoTipo) => void;
  className?: string;
}) {
  return (
    <InputDocumento
      pais="BR"
      value={documento}
      onChange={(v) => {
        setDocumento(v);
        setDocumentoTipo?.(tipoDocumentoPorDigitos(v));
      }}
      inputMode="numeric"
      className={className}
    />
  );
}

/** Máscara leve de telefone BR: (11) 98888-7777. */
/**
 * Validação dos dados do CONTRATADO (obrigatórios pro contrato): nome
 * completo + documento sempre; razão social quando CNPJ. Devolve a 1ª
 * mensagem de erro, ou null se tudo certo.
 */
function validarDadosContrato(
  nomeLegal: string,
  documentoTipo: DocumentoTipo,
  documento: string,
  razaoSocial: string,
  t: (s: string) => string
): string | null {
  if (!nomeLegal.trim()) return t("Informe o nome completo (civil) do artista.");
  if (!documentoValido(documento, documentoTipo))
    return documentoTipo === "cpf"
      ? t("CPF inválido — precisa de 11 dígitos.")
      : t("CNPJ inválido — precisa de 14 dígitos.");
  if (documentoTipo === "cnpj" && !razaoSocial.trim())
    return t("Informe a razão social / nome da empresa (CNPJ).");
  return null;
}

/**
 * Campos do CONTRATADO (sem wrapper) — reusados na Seção (cadastro / edição
 * em modal) e no card do perfil editável inline. O `nome` do artista é o
 * nome artístico; aqui ficam os dados legais que vão pro contrato.
 */
export function CamposDadosContrato({
  pais,
  setPais,
  nomeLegal,
  setNomeLegal,
  documentoTipo,
  setDocumentoTipo,
  documento,
  setDocumento,
  razaoSocial,
  setRazaoSocial,
  endereco,
  setEndereco,
  telefone,
  setTelefone,
  dataNascimento,
  setDataNascimento,
  email,
  setEmail,
  pix,
  setPix,
  erros,
}: {
  pais: Country;
  setPais: (v: Country) => void;
  nomeLegal: string;
  setNomeLegal: (v: string) => void;
  documentoTipo: DocumentoTipo;
  setDocumentoTipo: (v: DocumentoTipo) => void;
  documento: string;
  setDocumento: (v: string) => void;
  razaoSocial: string;
  setRazaoSocial: (v: string) => void;
  endereco: string;
  setEndereco: (v: string) => void;
  telefone: string;
  setTelefone: (v: string) => void;
  /** Opcionais — só aparecem quando o setter é passado (form de artista). */
  dataNascimento?: string;
  setDataNascimento?: (v: string) => void;
  email?: string;
  setEmail?: (v: string) => void;
  /** Chave PIX — só no form de ARTISTA e só quando o país é BR. */
  pix?: string;
  setPix?: (v: string) => void;
  /** Campos obrigatórios faltando — pinta rótulo + borda de vermelho. */
  erros?: { nomeLegal?: boolean; documento?: boolean; razaoSocial?: boolean };
}) {
  const t = useT();
  const isBR = pais.code === "BR";
  // O telefone é guardado em E.164 ("55119..."); o PhoneInput trabalha com os
  // dígitos nacionais, então tiramos o DDI do país pra exibir.
  const telDigits = (() => {
    const digs = (telefone ?? "").replace(/\D/g, "");
    return digs.startsWith(pais.ddi) && digs.length > pais.ddi.length
      ? digs.slice(pais.ddi.length)
      : digs;
  })();
  return (
    <>
      <Campo
        label={t("Nome completo (civil)")}
        className="md:col-span-2"
        erro={erros?.nomeLegal}
      >
        <input
          value={nomeLegal}
          onChange={(e) => setNomeLegal(e.target.value)}
          placeholder={t("Ex: João da Silva")}
          className={`campo-input${erros?.nomeLegal ? " erro" : ""}`}
        />
      </Campo>

      {setDataNascimento && (
        <Campo label={t("Data de nascimento")}>
          {isBR ? (
            <InputDataBR
              value={dataNascimento ?? ""}
              onChange={setDataNascimento}
              className="campo-input"
            />
          ) : (
            <input
              type="date"
              value={dataNascimento ?? ""}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="campo-input"
            />
          )}
        </Campo>
      )}

      {isBR ? (
        <>
          <Campo label={t("CPF / CNPJ")} erro={erros?.documento}>
            <InputDocumentoBR
              documento={documento}
              setDocumento={setDocumento}
              setDocumentoTipo={setDocumentoTipo}
              className={erros?.documento ? "input-erro" : ""}
            />
          </Campo>

          {tipoDocumentoPorDigitos(documento) === "cnpj" && (
            <Campo
              label={t("Razão social / Nome da empresa")}
              className="md:col-span-2"
              erro={erros?.razaoSocial}
            >
              <input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder={t("Ex: Silva Produções Artísticas LTDA")}
                className={`campo-input${erros?.razaoSocial ? " erro" : ""}`}
              />
            </Campo>
          )}
        </>
      ) : (
        <Campo label={configDocumento(pais.code).label} erro={erros?.documento}>
          <InputDocumento
            pais={pais.code}
            value={documento}
            onChange={setDocumento}
            className={erros?.documento ? "input-erro" : ""}
          />
        </Campo>
      )}

      {setEmail && (
        <Campo label={t("E-mail")} className="md:col-span-2">
          <input
            type="email"
            value={email ?? ""}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contato@email.com"
            className="campo-input"
          />
        </Campo>
      )}

      <Campo label={t("Telefone (opcional)")}>
        <PhoneInput
          country={pais}
          onCountryChange={setPais}
          value={telDigits}
          onChange={(digits) =>
            setTelefone(digits ? montarTelefoneE164(pais, digits) : "")
          }
        />
      </Campo>

      <Campo label={t("Endereço (opcional)")} className="md:col-span-2">
        <input
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder={exemploEndereco(pais.code)}
          className="campo-input"
        />
      </Campo>

      {isBR && setPix && (
        <Campo label={t("Chave PIX (opcional)")} className="md:col-span-2">
          <input
            value={pix ?? ""}
            onChange={(e) => setPix(e.target.value)}
            placeholder={t("CPF, CNPJ, e-mail, telefone ou chave aleatória")}
            className="campo-input"
          />
        </Campo>
      )}
    </>
  );
}

/** Wrapper em <Secao> dos campos do contratado (cadastro / edição em modal). */
function SecaoDadosContrato(props: Parameters<typeof CamposDadosContrato>[0]) {
  const t = useT();
  return (
    <Secao titulo={t("Dados pessoais")}>
      <CamposDadosContrato {...props} />
    </Secao>
  );
}

export function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-border last:border-b-0 last:pb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
        {titulo}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function Campo({
  label,
  children,
  className,
  erro,
}: {
  label: string;
  children: React.ReactNode;
  /** Classes extras no wrapper — ex: "md:col-span-2" pra ocupar a linha toda num grid. */
  className?: string;
  /** Pinta o rótulo de vermelho quando o campo obrigatório está faltando. */
  erro?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1${className ? ` ${className}` : ""}`}>
      <span
        className="text-xs font-medium text-secondary"
        style={erro ? { color: "var(--danger)" } : undefined}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Linha de toggle no estilo LinhaEscopo (mesma cara da AbaEquipe): rótulo +
 * descrição que muda conforme o estado + switch. Usada no card "Acesso ao
 * sistema" do editar do artista pra ligar/desligar o acesso.
 */
function LinhaEscopo({
  label,
  descricaoLigado,
  descricaoDesligado,
  valor,
  onChange,
}: {
  label: string;
  descricaoLigado: string;
  descricaoDesligado: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary">{label}</div>
        <div className="text-xs text-muted">
          {valor ? descricaoLigado : descricaoDesligado}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!valor)}
        className="relative h-6 w-11 rounded-full transition-colors flex-shrink-0"
        style={{
          backgroundColor: valor ? "var(--brand)" : "var(--border-strong)",
        }}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white transition-transform"
          style={{
            transform: valor ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </button>
    </div>
  );
}

/**
 * Lista editável de itens do rider (camarim ou efeitos).
 * Mostra inputs pra adicionar novo item + chips de sugestões do catálogo
 * global que adicionam com 1 clique.
 */
function ListaRider({
  itens,
  onChange,
  catalogoSugestoes,
  placeholderItem,
  limite,
}: {
  itens: string[];
  onChange: (itens: string[]) => void;
  catalogoSugestoes: readonly string[];
  placeholderItem: string;
  limite: number;
}) {
  const t = useT();
  const [novoNome, setNovoNome] = useState("");
  const cheio = itens.length >= limite;

  function adicionar(nome: string) {
    if (cheio) return;
    const n = nome.trim();
    if (!n) return;
    // Evita duplicado por nome
    if (itens.some((i) => i.toLowerCase() === n.toLowerCase())) return;
    onChange([...itens, n]);
    setNovoNome("");
  }

  function remover(idx: number) {
    onChange(itens.filter((_, i) => i !== idx));
  }

  // Sugestões do catálogo global que ainda não estão na lista
  const sugestoes = catalogoSugestoes.filter(
    (s) => !itens.some((i) => i.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Mensagem explicativa */}
      <p className="text-[0.7rem] text-muted leading-relaxed">
        {t("Liste apenas os itens. A")} <strong>{t("quantidade")}</strong> {t("é definida em cada orçamento (varia por evento).")}
      </p>

      {/* Itens já adicionados */}
      {itens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {itens.map((nome, idx) => (
            <span
              key={nome}
              className="inline-flex items-center gap-1.5 bg-elevated border border-border rounded-md pl-3 pr-1.5 py-1 text-sm text-primary"
            >
              {t(nome)}
              <button
                type="button"
                onClick={() => remover(idx)}
                className="hover:text-danger transition-colors"
                aria-label={t("Remover item")}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Adicionar novo */}
      <div className="flex items-center gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder={cheio ? t("Limite de {n} atingido", { n: limite }) : t(placeholderItem)}
          disabled={cheio}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar(novoNome);
            }
          }}
          className="campo-input flex-1 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => adicionar(novoNome)}
          disabled={!novoNome.trim() || cheio}
          className="btn-ghost p-2 rounded disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Chips de sugestões */}
      {!cheio && sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="text-[0.65rem] text-muted self-center">
            {t("Sugestões:")}
          </span>
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => adicionar(s)}
              className="text-[0.7rem] px-2 py-0.5 rounded-full border border-border bg-elevated hover:border-border-strong text-secondary hover:text-primary transition-colors"
            >
              + {t(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
