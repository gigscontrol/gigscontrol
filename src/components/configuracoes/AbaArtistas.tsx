"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import PresetsRiderEditor from "@/components/artistas/PresetsRiderEditor";
import {
  Music,
  Plus,
  Trash2,
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
import CardGoogleCalendar from "./CardGoogleCalendar";
import EquipeDoArtista from "./EquipeDoArtista";
import Modal from "../Modal";
import { useWorkspace } from "@/lib/workspace-context";
import { PRIVACIDADE_DJ_PADRAO } from "@/lib/permissoes";
import { PERFIS } from "@/lib/permissoes/perfis";
import { formatEndereco } from "@/lib/endereco";
import { useAuth } from "@/lib/auth-context";
import { getPlano } from "@/lib/planos";
import { iniciaisDoNome } from "@/lib/iniciais";
import { LABELS_TAXA_MODO, LIMITE_RIDER_CAMARIM, LIMITE_RIDER_EFEITOS, LIMITE_RIDER_TECNICO } from "@/types";
import { ArtistaParaEdicao } from "./camposCadastro";
import { ModalNovoArtista, extrairRaizUsername } from "./ModalNovoArtista";
import { DadosConta, ModalEditarArtista } from "./ModalEditarArtista";
import { ModalCredenciais } from "./ModalCredenciais";
import { corComoTexto } from "@/lib/contraste";

/**
 * Aba "Artistas" das Configurações.
 *
 * Versão expandida (etapa 21+): o cadastro de artista agora é um modal
 * com 5 seções — dados, acesso (login+senha gerada), cidade IBGE, taxa
 * de agência (5 modos), rider de camarim e rider de efeitos.
 */

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

  // Sem mouse: setas ←/→ no avatar focado andam uma posição (o foco segue o
  // avatar — o React pode mover o nó no DOM e o navegador solta o foco).
  function moverPorTeclado(id: string, delta: -1 | 1) {
    const ids = artistas.map((a) => a.id);
    const de = ids.indexOf(id);
    const para = de + delta;
    if (de < 0 || para < 0 || para >= ids.length) return;
    [ids[de], ids[para]] = [ids[para], ids[de]];
    void reordenarArtistas(ids).catch((e) => {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    });
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-chip-artista="${id}"]`)?.focus()
    );
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
          style={{ backgroundColor: "var(--warning-weak)", color: "var(--warning)" }}
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
                  data-chip-artista={a.id}
                  draggable={modoReordenar}
                  aria-pressed={modoReordenar ? sendoArrastado : undefined}
                  aria-label={
                    modoReordenar
                      ? t("{nome}: toque e depois toque no lugar dele, ou use as setas", { nome: a.name })
                      : undefined
                  }
                  onClick={() => {
                    if (!modoReordenar) {
                      setEditando(null);
                      setArtistaSelecionadoId(a.id);
                      return;
                    }
                    // Toque (e Enter): 1º toque pega o avatar, 2º toque solta
                    // no lugar do avatar tocado — o mesmo que arrastar.
                    if (!arrastandoId) setArrastandoId(a.id);
                    else aoSoltar(a.id);
                  }}
                  onKeyDown={(e) => {
                    if (!modoReordenar) return;
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.preventDefault();
                      moverPorTeclado(a.id, e.key === "ArrowLeft" ? -1 : 1);
                    } else if (e.key === "Escape" && arrastandoId) {
                      setArrastandoId(null);
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
                  className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md flex-shrink-0 transition-colors ${
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
                      className="h-8 w-8 rounded-full flex items-center justify-center text-micro font-bold"
                      style={{
                        // Suspenso: fundo cinza da borda — branco sumia no claro (1,3:1).
                        color: suspenso ? "var(--text-secondary)" : "#fff",
                        background: suspenso
                          ? "var(--border-strong)"
                          : `linear-gradient(135deg, ${a.color}, color-mix(in srgb, ${a.color} 60%, transparent))`,
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
              aria-label={t("Adicionar artista")}
              className="h-9 w-9 rounded-full border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 transition-colors hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "var(--brand)" }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Busca + filtro (só com muitos DJs) */}
          {muitosDJs && !modoReordenar && (
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-elevated border border-border rounded-md px-2 py-1.5 w-40 foco-campo-dentro">
                <Search size={13} className="text-muted flex-shrink-0" />
                <input aria-label={t("Buscar artista")}
                  enterKeyHint="search"
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
                    aria-pressed={filtroStatus === f} className={`pill ${filtroStatus === f ? "active" : ""}`}
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
            {arrastandoId
              ? t("Agora toque no avatar que está no lugar onde ele deve ficar.")
              : t("Arraste os avatares pra reordenar (ou toque num e depois no lugar dele; no teclado, setas ← →) — reflete na sidebar e nos filtros do app.")}
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
          <h2 className="section-title">{t("Nenhum artista cadastrado")}</h2>
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
                background: `linear-gradient(90deg, ${artistaSelecionado.color}, color-mix(in srgb, ${artistaSelecionado.color} 40%, transparent))`,
              }}
            />
            <div className="p-5 flex items-start gap-4 flex-wrap">
              <span
                className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
                style={{
                  color: artistaSelecionado.acessoSuspenso
                    ? "var(--text-secondary)"
                    : "#fff",
                  background: artistaSelecionado.acessoSuspenso
                    ? "var(--border-strong)"
                    : `linear-gradient(135deg, ${artistaSelecionado.color}, color-mix(in srgb, ${artistaSelecionado.color} 60%, transparent))`,
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
                    className="btn btn-danger text-xs px-2.5 py-1"
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
              <div className="stat-label inline-flex items-center gap-1.5">
                <KeyRound size={12} style={{ color: "var(--brand)" }} />
                {t("Acesso ao sistema")}
              </div>
              {artistaSelecionado.username && (
                <div>
                  <div className="text-xs font-medium text-secondary mb-1">{t("Login")}</div>
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
                    <div className="text-xs font-medium text-secondary mb-1">{t("E-mail")}</div>
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
                        <div className="mt-1 text-micro">
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
                    <div className="text-xs font-medium text-secondary mb-1">{t("Senha")}</div>
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
                          className="text-micro mt-1 inline-flex items-center gap-1"
                          style={{ color: "var(--warning)" }}
                        >
                          <AlertTriangle size={11} /> {t("Senha padrão — usuário ainda não trocou.")}
                        </div>
                      </>
                    ) : conta.senhaPadrao ? (
                      <div
                        className="flex items-start gap-2 text-xs rounded-md px-3 py-2 leading-relaxed"
                        style={{
                          backgroundColor: "var(--warning-weak)",
                          color: "var(--warning)",
                          border: "1px solid color-mix(in srgb, var(--warning) 20%, transparent)",
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
                          backgroundColor: "var(--success-weak)",
                          color: "var(--success)",
                          border: "1px solid color-mix(in srgb, var(--success) 20%, transparent)",
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
              <div className="stat-label inline-flex items-center gap-1.5">
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
              <div className="stat-label inline-flex items-center gap-1.5">
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
                            className="h-7 w-7 rounded-full flex items-center justify-center text-micro font-bold text-secondary flex-shrink-0"
                            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)" }}
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
                                    className="text-micro px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                                    style={{
                                      backgroundColor: `color-mix(in srgb, ${p.cor} 13%, transparent)`,
                                      color: corComoTexto(p.cor),
                                    }}
                                  >
                                    {t(p.nome)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-micro text-muted">
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
              <div className="stat-label">
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
              <div className="stat-label">
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
              <div className="stat-label">
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
              <div className="stat-label inline-flex items-center gap-1.5">
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
              <h2 className="section-title">
                {t("Na lixeira ({n})", { n: lixeiraArtistas.length })}
              </h2>
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
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: item.artista.color, color: "#fff", opacity: 0.6 }}
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
