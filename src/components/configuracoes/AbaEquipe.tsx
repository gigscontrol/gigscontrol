"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Plus,
  Trash2,
  Check,
  Pencil,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Copy,
  RotateCcw,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  Eye,
  EyeOff,
  Search,
  PauseCircle,
  PlayCircle,
  Users,
  Ban,
  AtSign,
} from "lucide-react";
import Modal from "../Modal";
import PageHeader from "../PageHeader";
import Toast from "../Toast";
import {
  useWorkspace,
  useArtistas,
  LABELS_PAPEL_EQUIPE,
  ESCOPO_PADRAO,
  type UsuarioEquipe,
  type PapelEquipe,
  type EscopoUsuario,
  type Funcoes,
} from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { getPlano } from "@/lib/planos";

const FUNCOES_DISPONIVEIS: PapelEquipe[] = ["vendedor", "financeiro", "produtor"];

/**
 * Normaliza um texto pra virar username (mesma regra de AbaArtistas):
 *   "João Vendas" → "joaovendas"
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

/** Função primária derivada do mapa de funções (1ª preenchida). */
function inferirPapelPrimario(funcoes: Funcoes): PapelEquipe {
  for (const f of FUNCOES_DISPONIVEIS) {
    if ((funcoes[f] ?? []).length > 0) return f;
  }
  // Fallback impossível na prática (validação na UI exige pelo menos 1)
  return "vendedor";
}

/**
 * Aba "Equipe" — Etapa 7c.
 * Single role por usuário. Persistência via /api/usuarios.
 */
export default function AbaEquipe() {
  const t = useT();
  const {
    equipe,
    carregandoEquipe,
    adicionarUsuario,
    atualizarUsuario,
    removerUsuario,
    resetarSenhaUsuario,
    lixeiraUsuarios,
    recarregarLixeira,
    restaurarDaLixeira,
  } = useWorkspace();
  const { sessao } = useAuth();
  // Slug da agência — mesma fonte usada em AbaArtistas pra montar o
  // handle "raiz-slug" do login.
  const slugAgencia = sessao?.workspace?.slug ?? "";

  // Carrega a lixeira ao montar (e quando o workspace mudar) — assim a
  // mini-lixeira abaixo da equipe aparece automaticamente após remover
  // alguém, sem precisar trocar de aba.
  useEffect(() => {
    void recarregarLixeira();
  }, [recarregarLixeira]);

  const plano = sessao?.workspace ? getPlano(sessao.workspace.plano) : null;
  const limite = plano?.maxUsuariosAdicionais ?? 0;
  const usados = equipe.length;
  const noLimite = usados >= limite;

  const [editando, setEditando] = useState<UsuarioEquipe | null>(null);
  const [criando, setCriando] = useState(false);
  const [confirmarRemover, setConfirmarRemover] = useState<UsuarioEquipe | null>(null);
  const [removendo, setRemovendo] = useState(false);
  // Credenciais geradas (criação OU reset). `login` é o handle pra
  // criação; em reset puro fica null (só mostra a senha nova).
  const [senhaNova, setSenhaNova] = useState<{
    nome: string;
    login: string | null;
    senha: string;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  const [acaoLixeira, setAcaoLixeira] = useState<string | null>(null);
  // Feedback de cópia na modal de credenciais (login / senha / ambos).
  const [copiouCred, setCopiouCred] = useState<"login" | "senha" | "ambos" | null>(null);

  // ---- Master-detail (topbar de avatares + perfil) ----
  const artistas = useArtistas();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "bloqueados">("todos");
  const [conta, setConta] = useState<DadosContaUsuario | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(false);
  // Senha mascarada por padrão; reseta ao trocar de membro pra não vazar.
  const [senhaRevelada, setSenhaRevelada] = useState(false);
  const [copiouSenha, setCopiouSenha] = useState(false);
  // Feedback do botão de copiar o login no card de Acesso ao sistema.
  const [copiouLoginCard, setCopiouLoginCard] = useState(false);

  // Mantém uma seleção válida (default = primeiro membro).
  useEffect(() => {
    if (equipe.length === 0) {
      if (selecionadoId !== null) setSelecionadoId(null);
      return;
    }
    const existe = selecionadoId && equipe.some((u) => u.id === selecionadoId);
    if (!existe) setSelecionadoId(equipe[0]?.id ?? null);
  }, [equipe, selecionadoId]);

  // Carrega email/senha da conta do membro selecionado.
  useEffect(() => {
    if (!selecionadoId) {
      setConta(null);
      return;
    }
    let mounted = true;
    setConta(null);
    setSenhaRevelada(false);
    setCopiouLoginCard(false);
    setCarregandoConta(true);
    fetch(`/api/usuarios/${selecionadoId}/conta`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DadosContaUsuario;
      })
      .then((d) => {
        if (mounted) setConta(d);
      })
      .catch(() => {
        if (mounted) setConta(null);
      })
      .finally(() => {
        if (mounted) setCarregandoConta(false);
      });
    return () => {
      mounted = false;
    };
  }, [selecionadoId]);

  const selecionado = equipe.find((u) => u.id === selecionadoId) ?? null;

  // Fila de chips: filtra por busca/status só com muitos usuários (>8).
  const muitosUsuarios = equipe.length > 8;
  const filaChips = !muitosUsuarios
    ? equipe
    : equipe.filter((u) => {
        if (filtroStatus === "ativos" && !u.ativo) return false;
        if (filtroStatus === "bloqueados" && u.ativo) return false;
        const q = busca.trim().toLowerCase();
        if (q && !u.nome.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q))
          return false;
        return true;
      });

  async function alternarBloqueio(u: UsuarioEquipe) {
    try {
      await atualizarUsuario(u.id, { ativo: !u.ativo });
      setToast({
        msg: t(u.ativo ? "Usuário bloqueado." : "Usuário desbloqueado."),
        tipo: "sucesso",
      });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    }
  }

  async function aoRestaurarUsuario(id: string, nomeUsr: string) {
    setAcaoLixeira(`restaurar-${id}`);
    try {
      await restaurarDaLixeira("usuario", id);
      setToast({ msg: t("{nome} restaurado.", { nome: nomeUsr }), tipo: "sucesso" });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setAcaoLixeira(null);
    }
  }

  async function aoCriar(dados: {
    nome: string;
    username_raiz: string;
    escopo: EscopoUsuario;
    funcoes: Funcoes;
  }) {
    try {
      const papel = inferirPapelPrimario(dados.funcoes);
      const { usuario, senhaTemporaria } = await adicionarUsuario({
        ...dados,
        papel,
      });
      setCriando(false);
      setSenhaNova({
        nome: usuario.nome,
        login: usuario.username ?? null,
        senha: senhaTemporaria,
      });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    }
  }

  async function aoEditar(id: string, dados: Partial<UsuarioEquipe>) {
    try {
      const patch: {
        nome?: string;
        papel?: PapelEquipe;
        escopo?: EscopoUsuario;
        funcoes?: Funcoes;
        ativo?: boolean;
      } = {
        nome: dados.nome,
        escopo: dados.escopo,
        funcoes: dados.funcoes,
        ativo: dados.ativo,
      };
      // Recalcula o papel primário quando as funções mudam.
      if (dados.funcoes) patch.papel = inferirPapelPrimario(dados.funcoes);
      await atualizarUsuario(id, patch);
      setEditando(null);
      setToast({ msg: t("Usuário atualizado."), tipo: "sucesso" });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    }
  }

  async function aoRemover() {
    if (!confirmarRemover) return;
    setRemovendo(true);
    try {
      await removerUsuario(confirmarRemover.id);
      setConfirmarRemover(null);
      setToast({ msg: t("Usuário removido."), tipo: "sucesso" });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setRemovendo(false);
    }
  }

  async function aoResetarSenha(u: UsuarioEquipe) {
    try {
      const novaSenha = await resetarSenhaUsuario(u.id);
      // Reset não mexe no login — só a senha. `login: null` faz a modal
      // mostrar apenas a senha nova.
      setSenhaNova({ nome: u.nome, login: null, senha: novaSenha });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header padrão do site (igual Artistas) — barra de uso no slot actions. */}
      <PageHeader
        title="Equipe"
        subtitle={
          plano
            ? t("Plano {nome} — {usados} de {limite} em uso", { nome: plano.nome, usados, limite })
            : t("Crie os logins da sua equipe.")
        }
        accentColor="var(--module-agencia)"
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
                  backgroundColor: noLimite ? "var(--danger)" : "var(--module-agencia)",
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
            {t("Limite de usuários do plano {nome} atingido. Faça upgrade ou remova um usuário para adicionar outro.", { nome: plano?.nome ?? "" })}
          </span>
        </div>
      )}

      {/* Top bar de troca de usuário — painel arredondado sticky, igual
          aos cards. Sem reordenar (a equipe não tem ordem manual). */}
      <div className="sticky top-0 z-20 px-3 py-2 bg-surface border border-border rounded">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1">
            {filaChips.map((u) => {
              const info = LABELS_PAPEL_EQUIPE[u.papel];
              const ativoChip = u.id === selecionadoId;
              const bloqueado = !u.ativo;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setEditando(null);
                    setSelecionadoId(u.id);
                  }}
                  title={u.nome}
                  className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full flex-shrink-0 transition-colors ${
                    ativoChip ? "bg-elevated" : "hover:bg-surface-2"
                  }`}
                  style={{ opacity: bloqueado && !ativoChip ? 0.7 : 1 }}
                >
                  <span className="relative flex-shrink-0">
                    <span
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[0.7rem] font-bold text-white"
                      style={{
                        background: bloqueado
                          ? "var(--border-strong)"
                          : `linear-gradient(135deg, ${info?.cor ?? "var(--module-contatos)"}, ${info?.cor ?? "var(--module-contatos)"}99)`,
                        boxShadow: ativoChip
                          ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${info?.cor ?? "var(--module-contatos)"}`
                          : undefined,
                      }}
                    >
                      {u.nome.charAt(0).toUpperCase()}
                    </span>
                    {bloqueado && (
                      <Ban
                        size={12}
                        className="absolute -bottom-0.5 -right-0.5"
                        style={{ color: "var(--warning)" }}
                      />
                    )}
                  </span>
                  <span
                    className={`hidden sm:block text-sm truncate max-w-[110px] ${
                      ativoChip ? "text-primary font-medium" : "text-secondary"
                    }`}
                  >
                    {u.nome}
                  </span>
                </button>
              );
            })}

            {/* Novo usuário */}
            <button
              type="button"
              onClick={() => setCriando(true)}
              disabled={noLimite}
              title={noLimite ? t("Limite do plano atingido") : t("Criar usuário")}
              className="h-9 w-9 rounded-full border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 transition-colors hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "var(--module-vendas)" }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Busca + filtro (só com muitos usuários) */}
          {muitosUsuarios && (
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
                {(["todos", "ativos", "bloqueados"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltroStatus(f)}
                    className={`pill ${filtroStatus === f ? "active" : ""}`}
                  >
                    {f === "todos" ? t("Todos") : f === "ativos" ? t("Ativos") : t("Bloqueados")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Perfil do membro selecionado */}
      {carregandoEquipe && equipe.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center gap-3 py-16">
          <Loader2 size={22} className="animate-spin text-muted" />
        </div>
      ) : equipe.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center gap-3 py-16">
          <div
            className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center"
            style={{ color: "var(--module-vendas)" }}
          >
            <Users size={22} />
          </div>
          <div className="section-title">{t("Nenhum usuário na equipe ainda.")}</div>
          <p className="text-sm text-muted max-w-sm">
            {t("Cadastre o primeiro usuário da sua equipe pra começar.")}
          </p>
          <button
            onClick={() => setCriando(true)}
            disabled={noLimite}
            className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> {t("Criar usuário")}
          </button>
        </div>
      ) : !selecionado ? null : (
        <>
          {/* Header do perfil */}
          <div className="card p-0 overflow-hidden">
            <div
              style={{
                height: 4,
                background: `linear-gradient(90deg, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--module-vendas)"}, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--module-vendas)"}66)`,
              }}
            />
            <div className="p-5 flex items-start gap-4 flex-wrap">
              <span
                className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{
                  background: !selecionado.ativo
                    ? "var(--border-strong)"
                    : `linear-gradient(135deg, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--module-vendas)"}, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--module-vendas)"}99)`,
                }}
              >
                {selecionado.nome.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="page-title">{selecionado.nome}</div>
                  {!selecionado.ativo && (
                    <span className="badge badge-warning">{t("Bloqueado")}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted mt-1.5">
                  {selecionado.username ? (
                    // Membro novo: mostra o handle de login (copiável), igual
                    // ao header do artista. Sem expor o e-mail fake interno.
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(selecionado.username!)
                          .then(() => {
                            setCopiouLoginCard(true);
                            setTimeout(() => setCopiouLoginCard(false), 2000);
                          });
                      }}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors group"
                      title={t("Copiar login")}
                    >
                      <AtSign size={11} />
                      <span className="font-mono">{selecionado.username}</span>
                      {copiouLoginCard ? (
                        <CheckCircle2 size={11} style={{ color: "var(--success)" }} />
                      ) : (
                        <Copy
                          size={11}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={11} />
                      <span className="break-all">{selecionado.email}</span>
                    </span>
                  )}
                </div>
                {/* Funções do membro */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(() => {
                    const funcoesAtivas = FUNCOES_DISPONIVEIS.filter(
                      (f) => (selecionado.funcoes?.[f]?.length ?? 0) > 0
                    );
                    if (funcoesAtivas.length === 0)
                      return (
                        <span
                          className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "#888"}22`,
                            color: LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "#888",
                          }}
                        >
                          {t(LABELS_PAPEL_EQUIPE[selecionado.papel]?.nome ?? selecionado.papel)}
                        </span>
                      );
                    return funcoesAtivas.map((f) => {
                      const fInfo = LABELS_PAPEL_EQUIPE[f];
                      const qtd = selecionado.funcoes?.[f]?.length ?? 0;
                      return (
                        <span
                          key={f}
                          className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${fInfo.cor}22`,
                            color: fInfo.cor,
                          }}
                          title={t("{n} DJ(s) atendido(s)", { n: qtd })}
                        >
                          {t(fInfo.nome)} · {qtd}
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Ações */}
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setEditando(selecionado)}
                  className="btn btn-secondary text-xs inline-flex items-center gap-1"
                >
                  <Pencil size={13} /> {t("Editar")}
                </button>
                <button
                  onClick={() => alternarBloqueio(selecionado)}
                  className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1.5"
                  style={{
                    color: selecionado.ativo ? "var(--warning)" : "var(--success)",
                  }}
                >
                  {selecionado.ativo ? (
                    <>
                      <PauseCircle size={14} /> {t("Bloquear")}
                    </>
                  ) : (
                    <>
                      <PlayCircle size={14} /> {t("Desbloquear")}
                    </>
                  )}
                </button>
                <button
                  onClick={() => aoResetarSenha(selecionado)}
                  className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1.5"
                  style={{ color: "var(--module-agencia)" }}
                >
                  <KeyRound size={14} /> {t("Resetar senha")}
                </button>
                <button
                  onClick={() => setConfirmarRemover(selecionado)}
                  className="btn-ghost p-1.5 rounded"
                  style={{ color: "var(--danger)" }}
                  aria-label={t("Remover usuário")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Grid de cards do perfil */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Acesso ao sistema */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <KeyRound size={12} style={{ color: "var(--module-agencia)" }} />
                {t("Acesso ao sistema")}
              </div>
              {/* Login (handle) — só em membros novos criados por username.
                  Membros antigos (login por e-mail) têm username null. */}
              {selecionado.username && (
                <div>
                  <div className="text-[0.7rem] text-muted mb-1">{t("Login")}</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(selecionado.username!)
                        .then(() => {
                          setCopiouLoginCard(true);
                          setTimeout(() => setCopiouLoginCard(false), 2000);
                        });
                    }}
                    className="w-full flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 hover:border-border-strong transition-colors text-left"
                  >
                    <span className="font-mono text-sm text-primary flex-1 truncate">
                      {selecionado.username}
                    </span>
                    {copiouLoginCard ? (
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
                  {t("Carregando dados da conta...")}
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
                      // Membro novo (login por handle) — não tem e-mail real.
                      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                        <Mail size={14} className="text-muted flex-shrink-0" />
                        <span className="flex-1 text-sm text-muted italic">
                          {t("Sem e-mail")}
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
                              senhaRevelada ? "select-all" : "tracking-widest"
                            }`}
                          >
                            {senhaRevelada ? conta.senhaPadraoValor : "••••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSenhaRevelada((v) => !v)}
                            className="btn-ghost p-1 rounded flex-shrink-0"
                            aria-label={senhaRevelada ? t("Ocultar senha") : t("Revelar senha")}
                            title={senhaRevelada ? t("Ocultar senha") : t("Revelar senha")}
                          >
                            {senhaRevelada ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(conta.senhaPadraoValor!)
                                .then(() => {
                                  setCopiouSenha(true);
                                  setTimeout(() => setCopiouSenha(false), 2000);
                                });
                            }}
                            className="btn-ghost p-1 rounded flex-shrink-0"
                            aria-label={t("Copiar senha")}
                          >
                            {copiouSenha ? (
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
                          {t('Senha padrão sem valor disponível. Use "Resetar senha" pra gerar uma nova.')}
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

            {/* Funções e DJs atendidos */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <Users size={12} style={{ color: "var(--module-agencia)" }} />
                {t("Funções e DJs atendidos")}
              </div>
              {(() => {
                const funcoesAtivas = FUNCOES_DISPONIVEIS.filter(
                  (f) => (selecionado.funcoes?.[f]?.length ?? 0) > 0
                );
                if (funcoesAtivas.length === 0)
                  return (
                    <div className="text-sm text-muted">
                      {t("Nenhuma função atribuída.")}
                    </div>
                  );
                return (
                  <div className="flex flex-col gap-3">
                    {funcoesAtivas.map((f) => {
                      const fInfo = LABELS_PAPEL_EQUIPE[f];
                      const ids = selecionado.funcoes?.[f] ?? [];
                      return (
                        <div key={f} className="flex flex-col gap-1.5">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: fInfo.cor }}
                            />
                            <span className="text-sm font-medium text-primary">
                              {t(fInfo.nome)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ids.map((id) => {
                              const dj = artistas.find((a) => a.id === id);
                              return (
                                <span
                                  key={id}
                                  className="text-xs bg-elevated border border-border rounded-md px-2 py-1 text-secondary"
                                  style={
                                    dj
                                      ? { boxShadow: `inset 2px 0 0 ${dj.color}` }
                                      : undefined
                                  }
                                >
                                  {dj?.name ?? id}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Permissões (read-only; edita no modal) */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <ShieldCheck size={12} style={{ color: "var(--module-agencia)" }} />
                {t("Permissões")}
              </div>
              {(() => {
                const esc = selecionado.escopo;
                const linhas = [
                  { label: t("Contatos"), todos: esc.verTodosContatos },
                  { label: t("Vendas e orçamentos"), todos: esc.verTodasVendas },
                  { label: t("Editar eventos"), todos: esc.editarTodosEventos },
                ];
                return (
                  <div className="flex flex-col gap-2">
                    {linhas.map((l) => (
                      <div key={l.label} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-secondary">{l.label}</span>
                        <span
                          className={`badge ${l.todos ? "badge-info" : "badge-neutral"}`}
                          style={l.todos ? undefined : { opacity: 0.55 }}
                        >
                          {l.todos ? t("Todos") : t("Só os próprios")}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Mini-lixeira: aparece só quando há usuários removidos. A aba
          completa fica em Configurações → Lixeira (admin). */}
      {lixeiraUsuarios.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Trash2 size={14} style={{ color: "var(--module-financeiro)" }} />
              <div className="section-title">
                {t("Na lixeira ({n})", { n: lixeiraUsuarios.length })}
              </div>
            </div>
            <span className="text-xs text-muted">
              {t("Recuperáveis por 30 dias")}
            </span>
          </div>
          <div className="divide-y divide-border">
            {lixeiraUsuarios.map((item) => {
              const urgente = item.diasRestantes <= 3;
              return (
                <div
                  key={item.usuario.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: "var(--module-contatos)", opacity: 0.6 }}
                  >
                    {item.usuario.nome
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {item.usuario.nome}
                    </div>
                    <div className="text-xs text-muted truncate font-mono">
                      {item.usuario.username ?? item.usuario.email}
                    </div>
                    <div
                      className="text-xs font-medium mt-0.5"
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
                    onClick={() => aoRestaurarUsuario(item.usuario.id, item.usuario.nome)}
                    disabled={acaoLixeira === `restaurar-${item.usuario.id}`}
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
        <strong className="text-primary">{t("Funções:")}</strong>{" "}
        {t("cada membro pode ter uma ou mais funções e, em cada uma, os DJs que atende — defina em")}{" "}
        <span className="inline-flex items-center gap-1 font-medium">
          <Pencil size={11} /> {t("Editar")}
        </span>
        {". "}
        <br />
        <strong className="text-primary">{t("Login:")}</strong>{" "}
        {t("aparece ao lado do nome (clique pra copiar). Fica salvo no sistema e você consegue acessar sempre que precisar.")}{" "}
        <br />
        <strong className="text-primary">{t("Senha:")}</strong>{" "}
        {t("só aparece uma vez ao criar. Se o membro perder, abra")}{" "}
        <span className="inline-flex items-center gap-1 font-medium">
          <Pencil size={11} /> {t("Editar")}
        </span>{" "}
        {t("e gere uma nova lá dentro.")}{" "}
        <br />
        <strong className="text-primary">{t("Remover:")}</strong>{" "}
        {t("manda pra Lixeira (recuperável por 30 dias).")}
      </div>

      {/* Modal criação/edição */}
      {(criando || editando) && (
        <ModalUsuario
          modo={criando ? "criar" : "editar"}
          inicial={editando ?? undefined}
          slugAgencia={slugAgencia}
          onFechar={() => {
            setCriando(false);
            setEditando(null);
          }}
          onCriar={aoCriar}
          onEditar={aoEditar}
          onResetarSenha={async () => {
            if (!editando) return;
            // Dispara o reset, fecha o modal de edição e o parent mostra
            // o modal de credenciais com a nova senha. Mesmo padrão de
            // AbaArtistas.
            const u = editando;
            setEditando(null);
            await aoResetarSenha(u);
          }}
        />
      )}

      {/* Confirmação de remoção */}
      <Modal
        isOpen={!!confirmarRemover}
        onClose={() => setConfirmarRemover(null)}
        title={t("Remover usuário")}
        subtitle={t("Esta ação não pode ser desfeita.")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            O login de <strong className="text-primary">{confirmarRemover?.nome}</strong>{" "}
            ({confirmarRemover?.username ?? confirmarRemover?.email}) será apagado. Ele não conseguirá mais entrar.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => setConfirmarRemover(null)}
              className="btn btn-secondary"
              disabled={removendo}
            >
              {t("Cancelar")}
            </button>
            <button
              onClick={aoRemover}
              className="btn btn-primary"
              style={{ backgroundColor: "var(--danger)", color: "#fff" }}
              disabled={removendo}
            >
              {removendo ? t("Removendo...") : t("Remover")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Credenciais (login + senha na criação; só senha em reset) */}
      <Modal
        isOpen={!!senhaNova}
        onClose={() => {
          setSenhaNova(null);
          setCopiouCred(null);
        }}
        title={senhaNova?.login ? t("Usuário cadastrado") : t("Senha redefinida")}
        subtitle={`${t("Para")} ${senhaNova?.nome ?? ""}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            {senhaNova?.login
              ? t("Copie o login e a senha e repasse pro usuário por um canal seguro. Por segurança, eles")
              : t("Repasse esta senha para o usuário por um canal seguro. Por segurança, ela")}{" "}
            <strong className="text-primary">{t("não será exibida novamente")}</strong>.
          </p>

          {/* Login (só na criação) */}
          {senhaNova?.login && (
            <div>
              <div className="text-xs font-medium text-secondary mb-1">{t("Login")}</div>
              <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2.5">
                <code className="font-mono text-base text-primary flex-1 select-all break-all">
                  {senhaNova.login}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(senhaNova.login!)
                      .then(() => {
                        setCopiouCred("login");
                        setTimeout(() => setCopiouCred(null), 2000);
                      });
                  }}
                  className="btn btn-secondary text-xs"
                  aria-label={t("Copiar login")}
                >
                  {copiouCred === "login" ? (
                    <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  ) : (
                    <Copy size={14} />
                  )}
                  {t("Copiar")}
                </button>
              </div>
            </div>
          )}

          {/* Senha */}
          <div>
            <div className="text-xs font-medium text-secondary mb-1">{t("Senha")}</div>
            <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2.5">
              <code className="font-mono text-base text-primary flex-1 select-all break-all">
                {senhaNova?.senha}
              </code>
              <button
                onClick={() => {
                  if (senhaNova?.senha) {
                    navigator.clipboard
                      .writeText(senhaNova.senha)
                      .then(() => {
                        setCopiouCred("senha");
                        setTimeout(() => setCopiouCred(null), 2000);
                      });
                  }
                }}
                className="btn btn-secondary text-xs"
                aria-label={t("Copiar senha")}
              >
                {copiouCred === "senha" ? (
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                ) : (
                  <Copy size={14} />
                )}
                {t("Copiar")}
              </button>
            </div>
          </div>

          {/* Copiar login + senha de uma vez (só na criação) */}
          {senhaNova?.login && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  .writeText(`Login: ${senhaNova.login}\nSenha: ${senhaNova.senha}`)
                  .then(() => {
                    setCopiouCred("ambos");
                    setTimeout(() => setCopiouCred(null), 2000);
                  });
              }}
              className="btn btn-secondary text-sm inline-flex items-center justify-center gap-1.5 self-start"
            >
              {copiouCred === "ambos" ? (
                <>
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  {t("Copiado!")}
                </>
              ) : (
                <>
                  <Copy size={14} />
                  {t("Copiar login + senha")}
                </>
              )}
            </button>
          )}

          <p className="text-xs text-muted">
            {t("O usuário deve trocar a senha pela aba")} <strong>{t("Segurança")}</strong> {t("no primeiro acesso.")}
          </p>
          <div className="flex justify-end pt-2 border-t border-border">
            <button
              onClick={() => {
                setSenhaNova(null);
                setCopiouCred(null);
              }}
              className="btn btn-primary"
            >
              {t("Entendi")}
            </button>
          </div>
        </div>
      </Modal>

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

// ================================================================
// Modal de criação / edição
// ================================================================

type DadosContaUsuario = {
  email: string;
  emailVerificado: boolean;
  /** true quando o e-mail ainda é o fake interno (membro criado por handle). */
  emailFakeInterno: boolean;
  ultimoLogin: string | null;
  senhaPadrao: boolean;
  /** Plaintext da senha aleatória — só preenchida enquanto senhaPadrao=true. */
  senhaPadraoValor: string | null;
};

function ModalUsuario({
  modo,
  inicial,
  slugAgencia,
  onFechar,
  onCriar,
  onEditar,
  onResetarSenha,
}: {
  modo: "criar" | "editar";
  inicial?: UsuarioEquipe;
  /** Slug da agência — usado pra montar o handle "raiz-slug" na criação. */
  slugAgencia: string;
  onFechar: () => void;
  onCriar: (dados: {
    nome: string;
    username_raiz: string;
    escopo: EscopoUsuario;
    funcoes: Funcoes;
  }) => void | Promise<void>;
  onEditar: (id: string, dados: Partial<UsuarioEquipe>) => void | Promise<void>;
  /** Só passado no modo editar. Reseta a senha do usuário. */
  onResetarSenha?: () => void | Promise<void>;
}) {
  const t = useT();
  const artistas = useArtistas();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  // Login (só na criação): raiz digitada pelo admin; auto-preenche a
  // partir do nome enquanto o admin não editar o campo manualmente.
  const [usernameRaiz, setUsernameRaiz] = useState("");
  const [usernameFoiEditado, setUsernameFoiEditado] = useState(false);
  const [copiouUsername, setCopiouUsername] = useState(false);
  const [escopo, setEscopo] = useState<EscopoUsuario>(inicial?.escopo ?? ESCOPO_PADRAO);
  const [funcoes, setFuncoes] = useState<Funcoes>(inicial?.funcoes ?? {});
  const [ativo, setAtivo] = useState<boolean>(inicial?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Handle completo + validação (mesma regra de AbaArtistas).
  const usernameCompleto = usernameRaiz.trim()
    ? `${usernameRaiz.trim().toLowerCase()}-${slugAgencia}`
    : "";
  const usernameValido = (() => {
    const v = usernameRaiz.trim();
    if (v.length < 3) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v);
  })();

  // Auto-sugere o username a partir do nome até o admin tocar no campo.
  useEffect(() => {
    if (modo !== "criar" || usernameFoiEditado) return;
    setUsernameRaiz(normalizarUsername(nome));
  }, [nome, modo, usernameFoiEditado]);

  // Dados de conta — async no modo editar. No modo criar não tem
  // sentido (o usuário ainda nem existe).
  const [conta, setConta] = useState<DadosContaUsuario | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(modo === "editar");
  const [copiouSenhaPadrao, setCopiouSenhaPadrao] = useState(false);

  useEffect(() => {
    if (modo !== "editar" || !inicial?.id) return;
    let mounted = true;
    setCarregandoConta(true);
    fetch(`/api/usuarios/${inicial.id}/conta`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as DadosContaUsuario;
      })
      .then((d) => {
        if (mounted) setConta(d);
      })
      .catch(() => {
        if (mounted) setConta(null);
      })
      .finally(() => {
        if (mounted) setCarregandoConta(false);
      });
    return () => {
      mounted = false;
    };
  }, [modo, inicial?.id]);

  function toggleFuncao(f: PapelEquipe) {
    setFuncoes((prev) => {
      const next = { ...prev };
      if (f in next) delete next[f];
      else next[f] = [];
      return next;
    });
  }

  function toggleDj(f: PapelEquipe, djId: string) {
    setFuncoes((prev) => {
      const atuais = prev[f] ?? [];
      const proximos = atuais.includes(djId)
        ? atuais.filter((x) => x !== djId)
        : [...atuais, djId];
      return { ...prev, [f]: proximos };
    });
  }

  function selecionarTodosDjs(f: PapelEquipe) {
    setFuncoes((prev) => ({ ...prev, [f]: artistas.map((a) => a.id) }));
  }

  function limparDjs(f: PapelEquipe) {
    setFuncoes((prev) => ({ ...prev, [f]: [] }));
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro(t("Informe o nome do usuário."));
      return;
    }
    if (modo === "criar" && !usernameValido) {
      setErro(t("Informe um login válido (3+ caracteres, letras, números e hífen)."));
      return;
    }
    // Valida: pelo menos 1 função marcada + cada função marcada precisa
    // ter pelo menos 1 DJ.
    const funcoesAtivas = FUNCOES_DISPONIVEIS.filter((f) => f in funcoes);
    if (funcoesAtivas.length === 0) {
      setErro(t("Selecione pelo menos uma função para o usuário."));
      return;
    }
    for (const f of funcoesAtivas) {
      if ((funcoes[f] ?? []).length === 0) {
        setErro(
          t("Selecione pelo menos um DJ para a função \"{nome}\".", { nome: LABELS_PAPEL_EQUIPE[f].nome })
        );
        return;
      }
    }
    setSalvando(true);
    setErro(null);
    try {
      if (modo === "criar") {
        await onCriar({
          nome: nome.trim(),
          username_raiz: usernameRaiz.trim().toLowerCase(),
          escopo,
          funcoes,
        });
      } else if (inicial) {
        await onEditar(inicial.id, {
          nome: nome.trim(),
          escopo,
          funcoes,
          ativo,
        });
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onFechar}
      title={modo === "criar" ? t("Criar usuário") : t("Editar usuário")}
      maxWidth={520}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-secondary">{t("Nome")}</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t("Nome completo")}
            className="campo-input"
            autoFocus
          />
        </label>

        {modo === "criar" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-secondary">{t("Login (username)")}</span>
            <div className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
              {/* Input cresce conforme digita (largura em `ch` casa com a
                  font-mono — sem buraco entre o texto e o sufixo). */}
              <input
                value={usernameRaiz}
                onChange={(e) => {
                  setUsernameFoiEditado(true);
                  setUsernameRaiz(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  );
                }}
                placeholder="joaovendas"
                style={{
                  width: `${Math.max(
                    usernameRaiz.length || "joaovendas".length,
                    4
                  )}ch`,
                }}
                className="bg-transparent outline-none text-sm text-primary placeholder:text-muted font-mono"
              />
              <span className="text-sm text-muted font-mono whitespace-nowrap">
                -{slugAgencia || "agencia"}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!usernameValido || !usernameCompleto) return;
                  navigator.clipboard.writeText(usernameCompleto).then(() => {
                    setCopiouUsername(true);
                    setTimeout(() => setCopiouUsername(false), 2000);
                  });
                }}
                disabled={!usernameValido}
                className="ml-auto btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t("Copiar login completo")}
                title={
                  usernameValido
                    ? t("Copiar login completo")
                    : t("Preencha um login válido pra copiar")
                }
              >
                {copiouUsername ? (
                  <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            {usernameCompleto && !usernameValido && (
              <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
                {t("Use 3+ caracteres (letras, números, hífen)")}
              </p>
            )}
            {usernameValido && usernameCompleto && (
              <p className="text-xs mt-1" style={{ color: "var(--success)" }}>
                {t("Login completo:")}{" "}
                <strong className="font-mono text-primary">{usernameCompleto}</strong>
              </p>
            )}
            <p className="text-[0.7rem] text-muted mt-1">
              {t("A senha é gerada automaticamente e mostrada só uma vez ao final.")}
            </p>
          </label>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-secondary">
            {t("Funções e DJs atendidos")}
          </span>
          <p className="text-[0.7rem] text-muted -mt-1">
            {t("Marque cada função que o usuário desempenha e, dentro dela, quais DJs ele atende. As escolhas são independentes (ex.: vendedor do DJ Z e financeiro do DJ Y).")}
          </p>
          {FUNCOES_DISPONIVEIS.map((f) => {
            const info = LABELS_PAPEL_EQUIPE[f];
            const ativoFuncao = f in funcoes;
            const djsSelecionados = funcoes[f] ?? [];
            return (
              <div
                key={f}
                className="rounded-md border transition-colors"
                style={{
                  borderColor: ativoFuncao ? info.cor : "var(--border-color)",
                  backgroundColor: ativoFuncao ? `${info.cor}10` : "transparent",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFuncao(f)}
                  className="w-full flex items-center gap-2.5 p-2.5 text-left"
                >
                  <span
                    className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: ativoFuncao ? info.cor : "transparent",
                      border: ativoFuncao ? "none" : "1px solid var(--border-strong)",
                    }}
                  >
                    {ativoFuncao && <Check size={13} className="text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-primary block">
                      {t(info.nome)}
                    </span>
                    <span className="text-xs text-muted">{t(info.descricao)}</span>
                  </span>
                </button>
                {ativoFuncao && (
                  <div className="px-2.5 pb-2.5 border-t border-border pt-2.5 mt-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-muted">
                        {t("DJs atendidos ({n} de {total})", { n: djsSelecionados.length, total: artistas.length })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => selecionarTodosDjs(f)}
                          className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted hover:text-primary"
                        >
                          {t("Todos")}
                        </button>
                        <button
                          type="button"
                          onClick={() => limparDjs(f)}
                          className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted hover:text-primary"
                        >
                          {t("Limpar")}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {artistas.length === 0 && (
                        <span className="text-xs text-muted">
                          {t("Nenhum DJ cadastrado ainda. Cadastre na aba Artistas.")}
                        </span>
                      )}
                      {artistas.map((dj) => {
                        const sel = djsSelecionados.includes(dj.id);
                        return (
                          <button
                            key={dj.id}
                            type="button"
                            onClick={() => toggleDj(f, dj.id)}
                            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                            style={{
                              backgroundColor: sel ? dj.color : "var(--bg-elevated)",
                              color: sel ? "#fff" : "var(--text-muted)",
                              boxShadow: sel ? `0 0 0 1px ${dj.color}` : "none",
                            }}
                          >
                            {dj.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} style={{ color: "var(--module-financeiro)" }} />
            <span className="text-xs font-medium text-secondary">
              {t("Privacidade e permissões")}
            </span>
          </div>
          <LinhaEscopo
            label={t("Ver todos os contatos")}
            descricaoLigado={t("Enxerga todos os contatos da agência")}
            descricaoDesligado={t("Vê apenas os contatos que ele mesmo criou")}
            valor={escopo.verTodosContatos}
            onChange={(v) => setEscopo((s) => ({ ...s, verTodosContatos: v }))}
          />
          <LinhaEscopo
            label={t("Ver todas as vendas e orçamentos")}
            descricaoLigado={t("Enxerga todas as vendas e orçamentos da agência")}
            descricaoDesligado={t("Vê apenas as vendas e orçamentos que ele mesmo criou")}
            valor={escopo.verTodasVendas}
            onChange={(v) => setEscopo((s) => ({ ...s, verTodasVendas: v }))}
          />
          <LinhaEscopo
            label={t("Editar todos os eventos")}
            descricaoLigado={t("Pode editar qualquer evento da agência")}
            descricaoDesligado={t("Edita apenas os eventos que ele mesmo criou")}
            valor={escopo.editarTodosEventos}
            onChange={(v) => setEscopo((s) => ({ ...s, editarTodosEventos: v }))}
          />
        </div>

        {modo === "editar" && (
          <LinhaEscopo
            label={t("Acesso ativo")}
            descricaoLigado={t("O usuário pode entrar normalmente")}
            descricaoDesligado={t("O usuário está bloqueado e não consegue entrar")}
            valor={ativo}
            onChange={setAtivo}
          />
        )}

        {/* ---- Bloco Senha (só no modo editar) ---- */}
        {modo === "editar" && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Lock size={14} style={{ color: "var(--module-financeiro)" }} />
              <span className="text-xs font-medium text-secondary">{t("Senha")}</span>
            </div>
            {carregandoConta ? (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <Loader2 size={14} className="animate-spin" />
                {t("Carregando dados da conta...")}
              </div>
            ) : !conta ? (
              <p className="text-xs text-danger">
                {t("Não foi possível carregar a conta.")}
              </p>
            ) : conta.senhaPadrao && conta.senhaPadraoValor ? (
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
                  className="text-[0.7rem] inline-flex items-center gap-1"
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
                  {t("Usuário ainda está com a")}{" "}<strong>{t("senha padrão")}</strong>{" "}
                  {t("gerada pelo sistema, mas o valor não está disponível (usuário criado antes desta versão). Gere uma nova abaixo pra conseguir copiar.")}
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

            {onResetarSenha && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      t("Gerar uma nova senha aleatória pro usuário {nome}?", { nome: nome || inicial?.nome || "" })
                    )
                  ) {
                    void onResetarSenha();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors hover:bg-elevated mt-1"
                style={{
                  borderColor: "var(--module-vendas)",
                  color: "var(--module-vendas)",
                }}
              >
                <KeyRound size={14} />
                {t("Gerar nova senha aleatória")}
              </button>
            )}
          </div>
        )}

        {erro && (
          <div className="text-xs" style={{ color: "var(--danger)" }}>
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onFechar} className="btn btn-secondary" disabled={salvando}>
            {t("Cancelar")}
          </button>
          <button onClick={salvar} className="btn btn-primary" disabled={salvando}>
            {salvando ? t("Salvando...") : (<><Check size={14} /> {t("Salvar")}</>)}
          </button>
        </div>
      </div>
    </Modal>
  );
}

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
        onClick={() => onChange(!valor)}
        className="relative h-6 w-11 rounded-full transition-colors flex-shrink-0"
        style={{
          backgroundColor: valor ? "var(--module-vendas)" : "var(--border-strong)",
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
