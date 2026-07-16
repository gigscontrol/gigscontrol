"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Users,
  Ban,
  AtSign,
  SlidersHorizontal,
} from "lucide-react";
import Modal from "../Modal";
import PageHeader from "../PageHeader";
import Toast from "../Toast";
import ConfirmarSaidaModal from "../ConfirmarSaidaModal";
import { useNavegacaoOpcional } from "../NavOverlay";
import {
  useWorkspace,
  useArtistas,
  LABELS_PAPEL_EQUIPE,
  type UsuarioEquipe,
} from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { getPlano } from "@/lib/planos";
import { PERFIS, type PerfilId } from "@/lib/permissoes/perfis";
import { MODULOS, CATALOGO } from "@/lib/permissoes/catalogo";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "../CidadeGlobalAutocomplete";
import { resolverCidade, cidadeParaEscolhida } from "@/lib/cidade-helpers";
import { BRASIL, COUNTRIES, type Country } from "@/lib/data/countries";
import { SeletorDeCor, Secao, Campo, CamposDadosContrato, CORES } from "./AbaArtistas";
import { EditorPermissoesVinculo } from "./EquipeDoArtista";
import type { DocumentoTipo } from "@/types";

/** Vínculo (usuário × artista) resumido — perfis + permissões por artista. */
type VinculoResumo = { artistId: string; perfis: string[]; permissoes: string[] };

/** Rótulo (do catálogo) da permissão de criar pastas de anotações. */
const ROTULO_ANOTACOES =
  CATALOGO.find((p) => p.chave === "agencia.criar_pastas_anotacoes")?.label ??
  "Criar pastas de anotações";

/**
 * Agrupa as chaves de um vínculo por MÓDULO, com contagem de chaves, na ordem
 * do catálogo. Cada chave tem a forma "modulo.acao" — o prefixo é o módulo.
 * Fonte da verdade nova (deriva dos vínculos), sem nenhum dado legado.
 */
function resumoPorModulo(permissoes: string[]): { modulo: string; label: string; n: number }[] {
  const contagem = new Map<string, number>();
  for (const chave of permissoes) {
    const mod = chave.split(".")[0];
    contagem.set(mod, (contagem.get(mod) ?? 0) + 1);
  }
  return MODULOS.filter((m) => contagem.has(m.id)).map((m) => ({
    modulo: m.id,
    label: m.label,
    n: contagem.get(m.id) ?? 0,
  }));
}

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
  // Vínculos do membro selecionado (perfis + permissões por artista) — fonte
  // da verdade nova do card "Funções e DJs atendidos". `null` = carregando.
  const [vinculos, setVinculos] = useState<VinculoResumo[] | null>(null);
  // true quando o fetch de vínculos falhou — distingue erro de "sem vínculo".
  const [vinculosErro, setVinculosErro] = useState(false);
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

  // Carrega os vínculos (perfis + permissões por artista) do membro
  // selecionado — modelo NOVO (membros_artista). Substitui o profiles.funcoes
  // legado, que fica sempre vazio no modelo novo.
  useEffect(() => {
    if (!selecionadoId) {
      setVinculos(null);
      setVinculosErro(false);
      return;
    }
    let mounted = true;
    setVinculos(null);
    setVinculosErro(false);
    fetch(`/api/usuarios/${selecionadoId}/vinculos`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { vinculos: VinculoResumo[] };
      })
      .then((d) => {
        if (mounted) setVinculos(d.vinculos ?? []);
      })
      .catch(() => {
        // Erro real (rede/HTTP) — NÃO confundir com "membro sem vínculo".
        if (mounted) {
          setVinculos([]);
          setVinculosErro(true);
        }
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
    artistIds: string[];
    permissoes_por_artista?: Record<string, string[]>;
    /** Presets (perfis) por artista escolhidos já na criação — persistem no vínculo. */
    perfis_por_artista?: Record<string, string[]>;
    cor?: string;
    pais?: string;
    nome_legal?: string;
    documento_tipo?: string;
    documento?: string;
    razao_social?: string;
    endereco?: string;
    telefone?: string;
    data_nascimento?: string;
    email_contato?: string;
    cidade_id?: string;
  }) {
    try {
      const { usuario, senhaTemporaria } = await adicionarUsuario(dados);
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

  async function aoEditar(id: string, dados: PatchEditarUsuario) {
    // NÃO engole o erro: se atualizarUsuario falhar, deixa o rejeito subir pro
    // salvar() do form — ele mostra o aviso no banner e devolve `false`, pra
    // guarda de saída NÃO navegar por cima de um save que falhou.
    // Repassa apelido + dados de pessoa (snake_case, já no formato que o
    // backend espera) + bloqueio. `cidade_id`/`razao_social` só vão quando
    // preenchidos (o `salvar` já os deixa undefined quando não se aplicam).
    await atualizarUsuario(id, {
      nome: dados.nome,
      ativo: dados.ativo,
      pode_criar_anotacoes: dados.pode_criar_anotacoes,
      cor: dados.cor,
      pais: dados.pais,
      nome_legal: dados.nome_legal,
      documento_tipo: dados.documento_tipo,
      documento: dados.documento,
      razao_social: dados.razao_social,
      endereco: dados.endereco,
      telefone: dados.telefone,
      data_nascimento: dados.data_nascimento,
      cidade_id: dados.cidade_id,
    });
    setEditando(null);
    setToast({ msg: t("Usuário atualizado."), tipo: "sucesso" });
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
                          : `linear-gradient(135deg, ${info?.cor ?? "var(--border-strong)"}, ${info?.cor ?? "var(--border-strong)"}99)`,
                        boxShadow: ativoChip
                          ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${info?.cor ?? "var(--border-strong)"}`
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
              style={{ color: "var(--brand)" }}
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
            style={{ color: "var(--brand)" }}
          >
            <Users size={22} />
          </div>
          <div className="section-title">{t("Nenhum usuário da equipe cadastrado")}</div>
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
      ) : selecionado && editando && editando.id === selecionado.id ? (
        /* Edição INLINE no painel do membro (mesmo padrão do editar do
           artista) — sem abrir janela/Modal. */
        <ModalUsuario
          modoInline
          modo="editar"
          inicial={editando}
          slugAgencia={slugAgencia}
          onFechar={() => setEditando(null)}
          onCriar={aoCriar}
          onEditar={aoEditar}
          onResetarSenha={async () => {
            const u = editando;
            setEditando(null);
            await aoResetarSenha(u);
          }}
        />
      ) : !selecionado ? null : (
        <>
          {/* Header do perfil */}
          <div className="card p-0 overflow-hidden">
            <div
              style={{
                height: 4,
                background: `linear-gradient(90deg, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--border-strong)"}, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--border-strong)"}66)`,
              }}
            />
            <div className="p-5 flex items-start gap-4 flex-wrap">
              <span
                className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{
                  background: !selecionado.ativo
                    ? "var(--border-strong)"
                    : `linear-gradient(135deg, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--border-strong)"}, ${LABELS_PAPEL_EQUIPE[selecionado.papel]?.cor ?? "var(--border-strong)"}99)`,
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
                {/* Perfis e DJs do membro (fonte: vínculos do modelo novo) */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(() => {
                    const vs = vinculos ?? [];
                    // Sem vínculo (ou ainda carregando) → badge do papel, como antes.
                    if (vs.length === 0)
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
                    // União dos perfis entre todos os vínculos + contagem de DJs.
                    const perfisUniao = [...new Set(vs.flatMap((v) => v.perfis))];
                    return (
                      <>
                        {perfisUniao.map((pid) => {
                          const perfil = PERFIS.find((x) => x.id === pid);
                          return (
                            <span
                              key={pid}
                              className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${perfil?.cor ?? "#3D7BFF"}22`,
                                color: perfil?.cor ?? "#3D7BFF",
                              }}
                            >
                              {perfil?.nome ?? pid}
                            </span>
                          );
                        })}
                        <span
                          className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: "var(--elevated)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {t("{n} artista(s)", { n: vs.length })}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Ações — bloquear/resetar senha/anotações agora ficam DENTRO
                  do Editar (junto do acesso ao sistema). Aqui só Editar +
                  Remover. */}
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setEditando(selecionado)}
                  className="btn btn-secondary text-xs inline-flex items-center gap-1"
                >
                  <Pencil size={13} /> {t("Editar")}
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
                <KeyRound size={12} style={{ color: "var(--brand)" }} />
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
                <Users size={12} style={{ color: "var(--brand)" }} />
                {t("Funções e artistas atendidos")}
              </div>
              {vinculos === null ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  {t("Carregando…")}
                </div>
              ) : vinculosErro ? (
                <div className="text-sm" style={{ color: "var(--danger)" }}>
                  {t("Não foi possível carregar. Tente recarregar a página.")}
                </div>
              ) : vinculos.length === 0 ? (
                <div className="text-sm text-muted">
                  {t("Nenhum artista vinculado.")}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {vinculos.map((v) => {
                    const artista = artistas.find((a) => a.id === v.artistId);
                    return (
                      <div key={v.artistId} className="flex flex-col gap-1.5">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: artista?.color ?? "var(--border-strong)" }}
                          />
                          <span className="text-sm font-medium text-primary">
                            {artista?.name ?? v.artistId}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {v.perfis.length > 0 ? (
                            v.perfis.map((pid) => {
                              const perfil = PERFIS.find((x) => x.id === pid);
                              return (
                                <span
                                  key={pid}
                                  className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: `${perfil?.cor ?? "#3D7BFF"}22`,
                                    color: perfil?.cor ?? "#3D7BFF",
                                  }}
                                >
                                  {perfil?.nome ?? pid}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[0.65rem] text-muted">
                              {t("Personalizado")}
                            </span>
                          )}
                          <span className="text-[0.65rem] text-muted">
                            {t("{n} permissões", { n: v.permissoes.length })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Permissões — resumo REAL derivado dos vínculos: por artista, os
                módulos que o vínculo concede (com contagem de chaves) + a
                permissão de agência (anotações) quando ligada. Sem dado legado. */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <ShieldCheck size={12} style={{ color: "var(--brand)" }} />
                {t("Permissões")}
              </div>
              {vinculos === null ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" />
                  {t("Carregando…")}
                </div>
              ) : vinculosErro ? (
                <div className="text-sm" style={{ color: "var(--danger)" }}>
                  {t("Não foi possível carregar. Tente recarregar a página.")}
                </div>
              ) : vinculos.length === 0 && !selecionado.podeCriarAnotacoes ? (
                <div className="text-sm text-muted">
                  {t("Nenhuma permissão definida.")}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {vinculos.map((v) => {
                    const artista = artistas.find((a) => a.id === v.artistId);
                    const mods = resumoPorModulo(v.permissoes);
                    return (
                      <div key={v.artistId} className="flex flex-col gap-1.5">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: artista?.color ?? "var(--border-strong)" }}
                          />
                          <span className="text-sm font-medium text-primary">
                            {artista?.name ?? v.artistId}
                          </span>
                        </div>
                        {mods.length === 0 ? (
                          <span className="text-[0.65rem] text-muted">
                            {t("Sem permissões")}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {mods.map((m) => (
                              <span
                                key={m.modulo}
                                className="inline-flex items-center gap-1 text-[0.65rem] font-medium px-1.5 py-0.5 rounded bg-elevated text-secondary"
                              >
                                {m.label}
                                <span className="text-muted tabular-nums">{m.n}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selecionado.podeCriarAnotacoes && (
                    <div className="flex items-center gap-1.5 pt-2 border-t border-border text-xs text-secondary">
                      <Check size={12} style={{ color: "var(--brand)" }} />
                      {t("Anotações: pode criar pastas")}
                    </div>
                  )}
                </div>
              )}
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
              <Trash2 size={14} style={{ color: "var(--brand)" }} />
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
                    style={{ backgroundColor: "var(--border-strong)", opacity: 0.6 }}
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
        {t("cada membro pode ter uma ou mais funções e, em cada uma, os artistas que atende — defina em")}{" "}
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

      {/* Modal de CRIAÇÃO (o EDITAR é inline no painel do membro — igual
          ao editar do artista; ver a branch de edição acima). */}
      {criando && (
        <ModalUsuario
          modo="criar"
          slugAgencia={slugAgencia}
          onFechar={() => setCriando(false)}
          onCriar={aoCriar}
          onEditar={aoEditar}
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

/**
 * Patch enviado pelo modo EDITAR — apelido + dados de pessoa (snake_case, o
 * mesmo formato que `atualizarUsuario` repassa pro backend) + bloqueio.
 * E-mail fica de fora de propósito (bloqueado; o membro cadastra depois).
 */
type PatchEditarUsuario = {
  nome?: string;
  ativo?: boolean;
  pode_criar_anotacoes?: boolean;
  cor?: string;
  pais?: string;
  nome_legal?: string;
  documento_tipo?: string;
  documento?: string;
  razao_social?: string;
  endereco?: string;
  telefone?: string;
  data_nascimento?: string;
  cidade_id?: string;
};

export function ModalUsuario({
  modo,
  inicial,
  slugAgencia,
  onFechar,
  onCriar,
  onEditar,
  onResetarSenha,
  modoInline = false,
}: {
  modo: "criar" | "editar";
  inicial?: UsuarioEquipe;
  /** Slug da agência — usado pra montar o handle "raiz-slug" na criação. */
  slugAgencia: string;
  onFechar: () => void;
  /**
   * Inline (sem wrapper de Modal) — pro onboarding embedar o form completo
   * na etapa da equipe, igual a etapa do artista faz com ModalNovoArtista.
   */
  modoInline?: boolean;
  onCriar: (dados: {
    nome: string;
    username_raiz: string;
    artistIds: string[];
    permissoes_por_artista?: Record<string, string[]>;
    /** Presets (perfis) por artista escolhidos já na criação — persistem no vínculo. */
    perfis_por_artista?: Record<string, string[]>;
    cor?: string;
    pais?: string;
    nome_legal?: string;
    documento_tipo?: string;
    documento?: string;
    razao_social?: string;
    endereco?: string;
    telefone?: string;
    data_nascimento?: string;
    email_contato?: string;
    cidade_id?: string;
  }) => void | Promise<void>;
  onEditar: (id: string, dados: PatchEditarUsuario) => void | Promise<void>;
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
  // Artistas com quem trabalha (a função é definida depois na aba Equipe).
  const [artistIdsSel, setArtistIdsSel] = useState<Set<string>>(new Set());
  // Permissões já definidas por artista no próprio modal de criação
  // (mapa artistId → chaves). Vazio = vínculo nasce sem permissão.
  const [permsPorArtista, setPermsPorArtista] = useState<Record<string, string[]>>({});
  // Presets (perfis) escolhidos por artista no modal de criação (mapa
  // artistId → ids de perfil). ANTES eram descartados — agora persistem no
  // vínculo via `perfis_por_artista`, então o vínculo nasce rotulado (ex.:
  // "Manager"), não como "Personalizado".
  const [perfisPorArtista, setPerfisPorArtista] = useState<Record<string, PerfilId[]>>({});
  // Artista cujo editor de permissões está aberto (modal empilhado). null = fechado.
  const [editandoPermsDe, setEditandoPermsDe] = useState<string | null>(null);
  // Dados pessoais (opcionais) — country-aware, servem para contrato.
  // No modo editar, pré-preenche a partir do `inicial` (mesmo conjunto de
  // estados do modo criar) — igual o editar do artista faz.
  const [paisPessoal, setPaisPessoal] = useState<Country>(
    () =>
      COUNTRIES.find((p) => p.code === (inicial?.pais ?? "BR").toUpperCase()) ??
      BRASIL
  );
  const [cor, setCor] = useState<string>(inicial?.cor ?? CORES[0]);
  // Cidade: o `inicial.cidade` (join no backend por cidade_id) traz nome/uf/país,
  // então no editar o autocomplete já abre PRÉ-PREENCHIDO. Sem cidade (modo criar,
  // ou cidade legada sem ibge/geoname) começa vazio. No submit só resolve/manda
  // cidade_id se houver seleção — a cidade inalterada resolve pro mesmo id
  // (lookup idempotente), então não muda nada; escolher outra troca.
  const [cidadeSel, setCidadeSel] = useState<CidadeEscolhida | null>(
    () => cidadeParaEscolhida(inicial?.cidade ?? null)
  );
  const [nomeLegal, setNomeLegal] = useState(inicial?.nomeLegal ?? "");
  const [documentoTipo, setDocumentoTipo] = useState<DocumentoTipo>(
    // `inicial.documentoTipo` vem tipado como string no workspace-context;
    // aqui só existem os tipos válidos de DocumentoTipo, então estreitamos.
    (inicial?.documentoTipo as DocumentoTipo | undefined) ?? "cpf"
  );
  const [documento, setDocumento] = useState(inicial?.documento ?? "");
  const [razaoSocial, setRazaoSocial] = useState(inicial?.razaoSocial ?? "");
  const [endereco, setEndereco] = useState(inicial?.endereco ?? "");
  const [telefone, setTelefone] = useState(inicial?.telefone ?? "");
  const [dataNascimento, setDataNascimento] = useState(inicial?.dataNascimento ?? "");
  const [ativo, setAtivo] = useState<boolean>(inicial?.ativo ?? true);
  // Permissão dedicada: pode criar pastas de anotações na Agenda (movida do
  // painel de detalhe pra cá, T3).
  const [podeCriarAnotacoes, setPodeCriarAnotacoes] = useState<boolean>(
    inicial?.podeCriarAnotacoes ?? false
  );
  // Validação: `erros` = Set das CHAVES obrigatórias faltando ("nome"/"username")
  // pra borda vermelha + contador. `erro` = mensagem geral (rede/servidor).
  const [erros, setErros] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Remove uma chave do Set de erros (onChange dos campos obrigatórios — a
  // borda vermelha some assim que o usuário mexe no campo).
  function limparErro(chave: string) {
    setErros((prev) => {
      if (!prev.has(chave)) return prev;
      const n = new Set(prev);
      n.delete(chave);
      return n;
    });
  }

  // Mensagem derivada do Set (live): específica com 1 campo, "N informações
  // faltando" com vários.
  const msgErros =
    erros.size === 0
      ? null
      : erros.size === 1
      ? erros.has("nome")
        ? t("Nome obrigatório")
        : t("Login obrigatório")
      : t("{n} informações faltando", { n: erros.size });

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
  // Feedback de copiar o login (handle) no card de Acesso ao sistema do editar.
  const [copiouLoginEditar, setCopiouLoginEditar] = useState(false);

  // ---- Permissões por artista (T8) — só no modo editar ----
  // Vínculos do membro (artista × perfis × permissões). null = carregando.
  const [vinculosEdit, setVinculosEdit] = useState<VinculoResumo[] | null>(null);
  const [vinculosEditErro, setVinculosEditErro] = useState(false);
  // Artista cujo editor de permissões está aberto no modo editar (modal
  // empilhado). null = fechado.
  const [editandoVinculoDe, setEditandoVinculoDe] = useState<string | null>(null);
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  const carregarVinculos = useCallback(async () => {
    if (modo !== "editar" || !inicial?.id) return;
    setVinculosEdit(null);
    setVinculosEditErro(false);
    try {
      const res = await fetch(`/api/usuarios/${inicial.id}/vinculos`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { vinculos: VinculoResumo[] };
      setVinculosEdit(d.vinculos ?? []);
    } catch {
      setVinculosEdit([]);
      setVinculosEditErro(true);
    }
  }, [modo, inicial?.id]);

  useEffect(() => {
    void carregarVinculos();
  }, [carregarVinculos]);

  // Salva as permissões de UM vínculo (usuário × artista) — reutiliza o
  // endpoint PUT já existente da equipe do artista, depois recarrega a lista.
  async function salvarVinculo(artistaId: string, permissoes: string[], perfis: string[]) {
    if (!inicial?.id) return;
    setSalvandoVinculo(true);
    try {
      const res = await fetch(`/api/artistas/${artistaId}/equipe/${inicial.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfis, permissoes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.erro ?? t("Falha ao salvar."));
      setEditandoVinculoDe(null);
      await carregarVinculos();
    } finally {
      setSalvandoVinculo(false);
    }
  }

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

  function toggleArtista(id: string) {
    setArtistIdsSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Desmarcar o artista limpa as permissões E os perfis definidos.
        setPermsPorArtista((p) => {
          if (!(id in p)) return p;
          const resto = { ...p };
          delete resto[id];
          return resto;
        });
        setPerfisPorArtista((p) => {
          if (!(id in p)) return p;
          const resto = { ...p };
          delete resto[id];
          return resto;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function salvar(): Promise<boolean> {
    // Coleta TODOS os obrigatórios faltando de uma vez (não para no 1º). O
    // login só é exigido na criação; o editar exige apenas o apelido.
    // Devolve true no sucesso — a guarda de saída usa isso pra decidir se sai.
    const faltando = new Set<string>();
    if (!nome.trim()) faltando.add("nome");
    if (modo === "criar" && !usernameValido) faltando.add("username");
    if (faltando.size > 0) {
      setErros(faltando);
      setErro(null);
      return false;
    }
    setErros(new Set());

    if (modo === "criar") {
      const artistIds = [...artistIdsSel];
      setSalvando(true);
      setErro(null);
      try {
        // Cidade (opcional) → resolve/cria e devolve o UUID do catálogo.
        let cidadeId: string | undefined;
        if (cidadeSel) {
          try {
            cidadeId = (await resolverCidade(cidadeSel)).id;
          } catch {
            /* cidade não resolvida — segue sem (não bloqueia o cadastro) */
          }
        }
        // Só manda permissões dos artistas realmente selecionados e com ao
        // menos 1 chave — vínculo sem permissão nasce vazio de qualquer forma.
        const permsPayload: Record<string, string[]> = {};
        for (const aid of artistIds) {
          const chaves = permsPorArtista[aid];
          if (chaves && chaves.length > 0) permsPayload[aid] = chaves;
        }
        // Presets escolhidos por artista — persistem no vínculo (fix do bug:
        // antes o perfil escolhido na criação era descartado).
        const perfisPayload: Record<string, string[]> = {};
        for (const aid of artistIds) {
          const perfis = perfisPorArtista[aid];
          if (perfis && perfis.length > 0) perfisPayload[aid] = perfis;
        }
        await onCriar({
          nome: nome.trim(),
          username_raiz: usernameRaiz.trim().toLowerCase(),
          artistIds,
          permissoes_por_artista: Object.keys(permsPayload).length > 0 ? permsPayload : undefined,
          perfis_por_artista: Object.keys(perfisPayload).length > 0 ? perfisPayload : undefined,
          cor,
          pais: paisPessoal.code,
          nome_legal: nomeLegal.trim() || undefined,
          documento_tipo: documentoTipo,
          documento: documento.trim() || undefined,
          razao_social: (documentoTipo === "cnpj" ? razaoSocial.trim() : "") || undefined,
          telefone: telefone.trim() || undefined,
          endereco: endereco.trim() || undefined,
          data_nascimento: dataNascimento || undefined,
          cidade_id: cidadeId,
        });
        return true;
      } catch (e) {
        setErro((e as Error).message);
        return false;
      } finally {
        setSalvando(false);
      }
    }

    // Editar: apelido + dados de pessoa + bloqueio. O acesso (perfis/permissões
    // por artista) continua gerenciado na aba Equipe do artista. E-mail fica
    // bloqueado (o membro cadastra depois).
    if (!inicial) return false;
    setSalvando(true);
    setErro(null);
    try {
      // Cidade (opcional): só resolve/envia se o admin escolher uma nova —
      // senão o backend mantém a atual (o autocomplete começa vazio no editar).
      let cidadeId: string | undefined;
      if (cidadeSel) {
        try {
          cidadeId = (await resolverCidade(cidadeSel)).id;
        } catch {
          /* cidade não resolvida — segue sem (não bloqueia o cadastro) */
        }
      }
      await onEditar(inicial.id, {
        nome: nome.trim(),
        ativo,
        pode_criar_anotacoes: podeCriarAnotacoes,
        cor,
        pais: paisPessoal.code,
        nome_legal: nomeLegal.trim() || undefined,
        documento_tipo: documentoTipo,
        documento: documento.trim() || undefined,
        razao_social: (documentoTipo === "cnpj" ? razaoSocial.trim() : "") || undefined,
        endereco: endereco.trim() || undefined,
        telefone: telefone.trim() || undefined,
        data_nascimento: dataNascimento || undefined,
        cidade_id: cidadeId,
      });
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  // ---- Guarda de "alterações não salvas" (só no modo editar) ----
  // Assinatura dos campos editáveis do editar. A baseline é capturada no 1º
  // render (form recém-aberto = pristine) → sujo=false ao abrir.
  const assinatura = useMemo(
    () =>
      JSON.stringify({
        nome,
        cor,
        cidade: cidadeSel
          ? `${cidadeSel.pais}|${cidadeSel.uf}|${cidadeSel.nome}|${cidadeSel.ibgeId ?? cidadeSel.geonameId ?? ""}`
          : "",
        pais: paisPessoal.code,
        nomeLegal,
        documentoTipo,
        documento,
        razaoSocial,
        endereco,
        telefone,
        dataNascimento,
        ativo,
        podeCriarAnotacoes,
      }),
    [
      nome,
      cor,
      cidadeSel,
      paisPessoal,
      nomeLegal,
      documentoTipo,
      documento,
      razaoSocial,
      endereco,
      telefone,
      dataNascimento,
      ativo,
      podeCriarAnotacoes,
    ]
  );
  const baselineRef = useRef<string | null>(null);
  if (baselineRef.current === null) baselineRef.current = assinatura;
  const sujo = modo === "editar" && assinatura !== baselineRef.current;

  // Popup de confirmação da saída LOCAL (botão Cancelar do editar).
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const cancelar = () => {
    if (modo === "editar" && sujo) setConfirmarSaida(true);
    else onFechar();
  };

  // Guarda GLOBAL (interceptar navegação pra outra tela) — só no editar e só
  // quando há provider (o form também roda no onboarding, sem NavProvider).
  const nav = useNavegacaoOpcional();
  const registrarGuarda = nav?.registrarGuarda;
  const limparGuarda = nav?.limparGuarda;
  const sujoRef = useRef(sujo);
  sujoRef.current = sujo;
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  useEffect(() => {
    if (modo !== "editar" || !registrarGuarda || !limparGuarda) return;
    registrarGuarda(() => ({ sujo: sujoRef.current, salvar: salvarRef.current }));
    return () => limparGuarda();
  }, [modo, registrarGuarda, limparGuarda]);

  const conteudo = (
      <div className="flex flex-col gap-4">
        {modo === "criar" ? (
          <>
            <Secao titulo={t("Dados básicos")}>
              <Campo label={t("Apelido")} erro={erros.has("nome")}>
                <input
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (e.target.value.trim()) limparErro("nome");
                  }}
                  placeholder={t("Como essa pessoa é chamada")}
                  className={`campo-input${erros.has("nome") ? " erro" : ""}`}
                  autoFocus
                />
                <span className="text-[0.7rem] text-muted mt-1 block">
                  {t("É o nome que aparece pros outros usuários da sua agência.")}
                </span>
              </Campo>
              <Campo label={t("País e cidade onde reside")}>
                <CidadeGlobalAutocomplete
                  value={cidadeSel}
                  onChange={setCidadeSel}
                  onPaisChange={setPaisPessoal}
                  placeholder={t("Ex: São Paulo, Rio de Janeiro...")}
                />
              </Campo>
            </Secao>

            <Secao titulo={t("Dados pessoais")}>
              <CamposDadosContrato
                pais={paisPessoal}
                setPais={setPaisPessoal}
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
              />
            </Secao>

            <SeletorDeCor cor={cor} onChange={setCor} />

            {/* Tag visual do tipo de cadastro */}
            <div className="flex items-center gap-2">
              <span
                className="text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {t("Equipe")}
              </span>
            </div>

            <Secao titulo={t("Acesso ao sistema")}>
              <Campo label={t("Login (username)")} erro={erros.has("username")}>
                <div
                  className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong"
                  style={erros.has("username") ? { borderColor: "var(--danger)" } : undefined}
                >
                  <input
                    value={usernameRaiz}
                    onChange={(e) => {
                      setUsernameFoiEditado(true);
                      setUsernameRaiz(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                      );
                      limparErro("username");
                    }}
                    placeholder="marinasouza"
                    style={{
                      width: `${Math.max(
                        usernameRaiz.length || "marinasouza".length,
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
              </Campo>
            </Secao>

            <Secao titulo={t("Com quais artistas trabalha")}>
              <p className="text-[0.7rem] text-muted -mt-1">
                {t("Marque os artistas. A função de cada um (e as permissões) você define depois, na aba Equipe do artista.")}
              </p>
              {artistas.length === 0 ? (
                <span className="text-xs text-muted">
                  {t("Nenhum artista cadastrado ainda. Cadastre na aba Artistas.")}
                </span>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {artistas.map((artista) => {
                    const sel = artistIdsSel.has(artista.id);
                    const nPerms = permsPorArtista[artista.id]?.length ?? 0;
                    return (
                      <div
                        key={artista.id}
                        className="flex items-center gap-2.5 rounded-md border p-2 transition-colors"
                        style={{
                          borderColor: sel ? "var(--brand)" : "var(--border-color)",
                          backgroundColor: sel ? "var(--brand-weak)" : "transparent",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleArtista(artista.id)}
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                        >
                          <span
                            className="h-4 w-4 rounded-[3px] flex items-center justify-center flex-shrink-0 border"
                            style={{
                              backgroundColor: sel ? "var(--brand)" : "transparent",
                              borderColor: sel ? "var(--brand)" : "var(--border-strong)",
                            }}
                          >
                            {sel && <Check size={11} className="text-white" />}
                          </span>
                          <span
                            className="h-6 w-6 rounded-full flex-shrink-0"
                            style={{ backgroundColor: artista.color }}
                          />
                          <span className="text-sm font-medium text-primary flex-1 truncate">
                            {artista.name}
                          </span>
                        </button>
                        {sel && (
                          <button
                            type="button"
                            onClick={() => setEditandoPermsDe(artista.id)}
                            className="btn-ghost text-[0.7rem] inline-flex items-center gap-1 px-2 py-1 rounded flex-shrink-0"
                            style={{ color: nPerms > 0 ? "var(--brand)" : "var(--text-muted)" }}
                            title={t("Definir permissões deste artista")}
                          >
                            <SlidersHorizontal size={12} />
                            {nPerms > 0 ? t("{n} permissões", { n: nPerms }) : t("Permissões")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Secao>
          </>
        ) : (
          <>
            {/* HEADER estilo artista: barra colorida (a cor) + avatar (1ª
                letra do apelido) + input do APELIDO grande/bold, e
                Cancelar + "Salvar alterações" no canto. */}
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
                    {(nome.trim().charAt(0) || "?").toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <input
                      value={nome}
                      onChange={(e) => {
                        setNome(e.target.value);
                        if (e.target.value.trim()) limparErro("nome");
                      }}
                      placeholder={t("Apelido")}
                      className={`campo-input text-xl font-bold${erros.has("nome") ? " erro" : ""}`}
                      autoFocus
                    />
                    <span className="text-[0.7rem] text-muted mt-1 block">
                      {t("É o nome que aparece pros outros usuários da sua agência.")}
                    </span>
                  </div>

                  {/* Ações: Cancelar / Salvar alterações */}
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <button onClick={cancelar} className="btn btn-secondary text-sm" disabled={salvando}>
                      {t("Cancelar")}
                    </button>
                    <button
                      onClick={salvar}
                      disabled={salvando}
                      className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <Check size={14} />
                      {salvando ? t("Salvando...") : t("Salvar alterações")}
                    </button>
                  </div>
                </div>

                {/* Corpo do card: cor + país/cidade + dados pessoais — TUDO
                    DENTRO do card, igual ao editar do artista (não solto no
                    fundo). */}
                <div className="flex flex-col gap-4">
                  <SeletorDeCor cor={cor} onChange={setCor} />
                  <div className="border-t border-border" />
                  <Secao titulo={t("País e cidade onde reside")}>
                    <CidadeGlobalAutocomplete
                      value={cidadeSel}
                      onChange={setCidadeSel}
                      onPaisChange={setPaisPessoal}
                      placeholder={t("Ex: São Paulo, Rio de Janeiro...")}
                    />
                  </Secao>
                  <Secao titulo={t("Dados pessoais")}>
                    <CamposDadosContrato
                      pais={paisPessoal}
                      setPais={setPaisPessoal}
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
                    />
                  </Secao>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Card ÚNICO "Acesso ao sistema" — idêntico ao editar do artista:
            Login (display) + E-mail (display read-only + selo) + toggle
            Acesso ativo + toggle Anotações + Senha/gerar nova. */}
        {modo === "editar" && (
          <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
              <KeyRound size={12} style={{ color: "var(--brand)" }} />
              {t("Acesso ao sistema")}
            </div>

            {/* (1) Login (handle) — display read-only. O admin NÃO troca o
                login do membro; só copia. Membros antigos (login por e-mail)
                têm username null → oculta. */}
            {inicial?.username && (
              <div>
                <div className="text-[0.7rem] text-muted mb-1">{t("Login")}</div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(inicial.username!)
                      .then(() => {
                        setCopiouLoginEditar(true);
                        setTimeout(() => setCopiouLoginEditar(false), 2000);
                      });
                  }}
                  className="w-full flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 hover:border-border-strong transition-colors text-left"
                >
                  <AtSign size={14} className="text-muted flex-shrink-0" />
                  <span className="font-mono text-sm text-primary flex-1 truncate">
                    {inicial.username}
                  </span>
                  {copiouLoginEditar ? (
                    <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  ) : (
                    <Copy size={14} className="text-muted" />
                  )}
                </button>
              </div>
            )}

            {/* (2) E-mail — display read-only + selo Verificado/Não verificado.
                O admin NÃO edita o e-mail do membro. */}
            {carregandoConta ? (
              <div className="flex items-center gap-2 text-sm text-muted py-1">
                <Loader2 size={14} className="animate-spin" />
                {t("Carregando dados da conta...")}
              </div>
            ) : !conta ? (
              <p className="text-xs text-danger">
                {t("Não foi possível carregar a conta.")}
              </p>
            ) : (
              <div>
                <div className="text-[0.7rem] text-muted mb-1">{t("E-mail")}</div>
                {conta.emailFakeInterno ? (
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
                    <div className="mt-1.5 text-[0.7rem]">
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
            )}

            {/* (3) Toggle Acesso ativo */}
            <LinhaEscopo
              label={t("Acesso ativo")}
              descricaoLigado={t("O usuário pode entrar normalmente")}
              descricaoDesligado={t("O usuário está bloqueado e não consegue entrar")}
              valor={ativo}
              onChange={setAtivo}
            />

            {/* (4) Senha — mostra a padrão (se houver) + copiar + gerar nova */}
            <div>
              <div className="text-[0.7rem] text-muted mb-1">{t("Senha")}</div>
              {carregandoConta ? (
                <div className="flex items-center gap-2 text-sm text-muted py-1">
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
                    className="text-[0.7rem] mt-1 inline-flex items-center gap-1"
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
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors hover:bg-elevated mt-2"
                  style={{
                    borderColor: "var(--brand)",
                    color: "var(--brand)",
                  }}
                >
                  <KeyRound size={14} />
                  {t("Gerar nova senha aleatória")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Permissões da agência (D7) — permissões workspace-level, ADMIN
            delega aqui. Anotações (criar pastas) integrada ao modelo: usa o
            MESMO visual do editor de permissões (checkbox + label do catálogo)
            e continua gravando profiles.pode_criar_anotacoes (payload idêntico). */}
        {modo === "editar" && (
          <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
              <ShieldCheck size={12} style={{ color: "var(--brand)" }} />
              {t("Permissões da agência")}
            </div>
            <p className="text-xs text-muted -mt-1">
              {t("Permissões administrativas — valem no workspace inteiro, não por artista.")}
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setPodeCriarAnotacoes((v) => !v)}
                className="flex items-center gap-2 text-left text-sm py-1 w-full rounded hover:bg-elevated transition-colors"
              >
                <span
                  className="h-4 w-4 rounded-[3px] flex items-center justify-center flex-shrink-0 border"
                  style={{
                    backgroundColor: podeCriarAnotacoes ? "var(--brand)" : "transparent",
                    borderColor: podeCriarAnotacoes ? "var(--brand)" : "var(--border-strong)",
                  }}
                >
                  {podeCriarAnotacoes && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </span>
                <span className="text-secondary">{ROTULO_ANOTACOES}</span>
              </button>
            </div>
          </div>
        )}

        {/* Permissões por artista (T8) — lista os DJs com quem o membro
            trabalha; cada linha abre o EditorPermissoesVinculo. */}
        {modo === "editar" && (
          <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
              <Users size={12} style={{ color: "var(--brand)" }} />
              {t("Permissões por artista")}
            </div>
            <p className="text-xs text-muted -mt-1">
              {t("O que este membro pode fazer com cada artista — vale só para aquele artista.")}
            </p>
            {vinculosEdit === null ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={14} className="animate-spin" />
                {t("Carregando…")}
              </div>
            ) : vinculosEditErro ? (
              <div className="text-sm text-danger">
                {t("Não foi possível carregar. Tente recarregar a página.")}
              </div>
            ) : vinculosEdit.length === 0 ? (
              <div className="text-sm text-muted">
                {t("Nenhum artista vinculado. Vincule na aba Equipe do artista.")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {vinculosEdit.map((v) => {
                  const artista = artistas.find((a) => a.id === v.artistId);
                  return (
                    <div
                      key={v.artistId}
                      className="flex items-center gap-3 rounded-md border border-border bg-elevated p-2.5"
                    >
                      <span
                        className="h-8 w-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: artista?.color ?? "var(--border-strong)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-primary truncate">
                          {artista?.name ?? v.artistId}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {v.perfis.length > 0 ? (
                            v.perfis.map((pid) => {
                              const perfil = PERFIS.find((x) => x.id === pid);
                              return (
                                <span
                                  key={pid}
                                  className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: `${perfil?.cor ?? "#3D7BFF"}22`,
                                    color: perfil?.cor ?? "#3D7BFF",
                                  }}
                                >
                                  {perfil?.nome ?? pid}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[0.65rem] text-muted">
                              {t("Personalizado")}
                            </span>
                          )}
                          <span className="text-[0.65rem] text-muted">
                            {t("{n} permissões", { n: v.permissoes.length })}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditandoVinculoDe(v.artistId)}
                        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1.5 rounded flex-shrink-0"
                        style={{ color: "var(--brand)" }}
                        title={t("Editar permissões deste artista")}
                      >
                        <SlidersHorizontal size={13} />
                        {t("Editar")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(erro || msgErros) && (
          <div className="text-xs" style={{ color: "var(--danger)" }}>
            {erro ?? msgErros}
          </div>
        )}

        {/* Footer (Cancelar/Salvar) — só no modo criar. No editar as ações
            ficam no HEADER (estilo artista). */}
        {modo === "criar" && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            {!modoInline && (
              <button onClick={onFechar} className="btn btn-secondary" disabled={salvando}>
                {t("Cancelar")}
              </button>
            )}
            <button
              onClick={salvar}
              className={`btn btn-primary ${modoInline ? "flex-1 justify-center" : ""}`}
              disabled={salvando}
            >
              {salvando ? (
                t("Salvando...")
              ) : (
                <>
                  <Check size={14} />{" "}
                  {modoInline ? t("Convidar") : t("Salvar")}
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer do EDITAR — 2º botão Salvar no fim (evita rolar até o topo).
            Mesmos handlers do cabeçalho (cancelar/salvar). */}
        {modo === "editar" && (
          <div className="flex items-center justify-end gap-2 flex-wrap pt-2 border-t border-border">
            <button onClick={cancelar} className="btn btn-secondary text-sm" disabled={salvando}>
              {t("Cancelar")}
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <Check size={14} />
              {salvando ? t("Salvando...") : t("Salvar alterações")}
            </button>
          </div>
        )}

        {/* Editor de permissões do artista selecionado — modal empilhado
            (fechar/salvar aqui NÃO fecha o ModalUsuario). Usado na CRIAÇÃO. */}
        {editandoPermsDe && (() => {
          const artista = artistas.find((a) => a.id === editandoPermsDe);
          if (!artista) return null;
          return (
            <EditorPermissoesVinculo
              key={editandoPermsDe}
              nomeUsuario={nome.trim() || t("Novo usuário")}
              nomeArtista={artista.name}
              permissoes={permsPorArtista[editandoPermsDe] ?? []}
              perfisIniciais={perfisPorArtista[editandoPermsDe] ?? []}
              onSalvar={(chaves, perfis) => {
                setPermsPorArtista((p) => ({ ...p, [editandoPermsDe]: chaves }));
                // Persiste os perfis (presets) escolhidos — antes eram descartados.
                setPerfisPorArtista((p) => ({ ...p, [editandoPermsDe]: perfis }));
                setEditandoPermsDe(null);
              }}
              onFechar={() => setEditandoPermsDe(null)}
            />
          );
        })()}

        {/* Editor de permissões por vínculo — modo EDITAR (T8). Persiste via
            o endpoint da equipe do artista e recarrega a lista. */}
        {modo === "editar" && editandoVinculoDe && (() => {
          const artista = artistas.find((a) => a.id === editandoVinculoDe);
          if (!artista) return null;
          const vinculo = (vinculosEdit ?? []).find((v) => v.artistId === editandoVinculoDe);
          return (
            <EditorPermissoesVinculo
              key={editandoVinculoDe}
              nomeUsuario={nome.trim() || inicial?.nome || t("Usuário")}
              nomeArtista={artista.name}
              permissoes={vinculo?.permissoes ?? []}
              perfisIniciais={(vinculo?.perfis ?? []) as PerfilId[]}
              podeSalvar={!salvandoVinculo}
              onSalvar={(chaves, perfis) =>
                salvarVinculo(editandoVinculoDe, chaves, perfis)
              }
              onFechar={() => setEditandoVinculoDe(null)}
            />
          );
        })()}

        {confirmarSaida && (
          <ConfirmarSaidaModal
            salvando={salvando}
            onCancelar={() => setConfirmarSaida(false)}
            onDescartar={() => {
              setConfirmarSaida(false);
              onFechar();
            }}
            onSalvarESair={async () => {
              // salvar() sucesso → o pai fecha o editor (setEditando null); no
              // erro/validação fica na tela e o popup fecha pra mostrar o aviso.
              await salvar();
              setConfirmarSaida(false);
            }}
          />
        )}
      </div>
  );

  if (modoInline) return conteudo;
  return (
    <Modal
      isOpen
      onClose={onFechar}
      // No editar o próprio HEADER (card com barra/avatar/apelido) faz de
      // título — sem barra de título redundante, igual o editar do artista.
      title={modo === "criar" ? t("Criar usuário") : ""}
      maxWidth={modo === "editar" ? 620 : 520}
    >
      {conteudo}
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
