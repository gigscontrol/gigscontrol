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
} from "lucide-react";
import Modal from "../Modal";
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
  const [senhaNova, setSenhaNova] = useState<{ nome: string; senha: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  const [acaoLixeira, setAcaoLixeira] = useState<string | null>(null);

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
    email: string;
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
      setSenhaNova({ nome: usuario.nome, senha: senhaTemporaria });
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
      setSenhaNova({ nome: u.nome, senha: novaSenha });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Resumo do limite */}
      <div className="card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="section-title">{t("Equipe da agência")}</div>
            <div className="section-subtitle">
              {plano
                ? t("Seu plano {nome} permite até {limite} usuários adicionais (fora você e os artistas).", { nome: plano.nome, limite })
                : t("Crie os logins da sua equipe.")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">
              {usados}
              <span className="text-muted text-base font-normal"> / {limite}</span>
            </div>
            <div className="text-xs text-muted">{t("em uso")}</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${limite > 0 ? Math.min(100, (usados / limite) * 100) : 0}%`,
              backgroundColor: noLimite ? "var(--danger)" : "var(--module-vendas)",
            }}
          />
        </div>
      </div>

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

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="section-title">{t("Usuários")}</div>
          <button
            onClick={() => setCriando(true)}
            disabled={noLimite}
            className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            {t("Criar usuário")}
          </button>
        </div>

        {carregandoEquipe ? (
          <div className="py-12 text-center text-sm text-muted">{t("Carregando...")}</div>
        ) : equipe.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            {t("Nenhum usuário na equipe ainda.")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {equipe.map((u) => {
              const info = LABELS_PAPEL_EQUIPE[u.papel];
              const funcoesAtivas = FUNCOES_DISPONIVEIS.filter(
                (f) => (u.funcoes?.[f]?.length ?? 0) > 0
              );
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ opacity: u.ativo ? 1 : 0.55 }}
                >
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: info?.cor ?? "var(--module-contatos)" }}
                  >
                    {u.nome
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {u.nome} {!u.ativo && <span className="text-warning text-xs">({t("bloqueado")})</span>}
                    </div>
                    <div className="text-xs text-muted truncate">{u.email}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end flex-shrink-0 max-w-[40%]">
                    {funcoesAtivas.length === 0 ? (
                      <span
                        className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${info?.cor ?? "#888"}22`,
                          color: info?.cor ?? "#888",
                        }}
                      >
                        {t(info?.nome ?? u.papel)}
                      </span>
                    ) : (
                      funcoesAtivas.map((f) => {
                        const fInfo = LABELS_PAPEL_EQUIPE[f];
                        const qtd = u.funcoes?.[f]?.length ?? 0;
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
                      })
                    )}
                  </div>
                  <button
                    onClick={() => aoResetarSenha(u)}
                    className="btn-ghost p-1.5 rounded"
                    aria-label={t("Resetar senha")}
                    title={t("Resetar senha")}
                  >
                    <KeyRound size={14} />
                  </button>
                  <button
                    onClick={() => setEditando(u)}
                    className="btn-ghost p-1.5 rounded"
                    aria-label={t("Editar usuário")}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmarRemover(u)}
                    className="btn-ghost p-1.5 rounded"
                    style={{ color: "var(--danger)" }}
                    aria-label={t("Remover usuário")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                    <div className="text-xs text-muted truncate">
                      {item.usuario.email}
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

      {/* Modal criação/edição */}
      {(criando || editando) && (
        <ModalUsuario
          modo={criando ? "criar" : "editar"}
          inicial={editando ?? undefined}
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
            ({confirmarRemover?.email}) será apagado. Ele não conseguirá mais entrar.
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

      {/* Senha temporária */}
      <Modal
        isOpen={!!senhaNova}
        onClose={() => setSenhaNova(null)}
        title={t("Senha temporária gerada")}
        subtitle={`${t("Para")} ${senhaNova?.nome}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-secondary">
            {t("Repasse esta senha para o usuário por um canal seguro. Por segurança, ela")}{" "}
            <strong className="text-primary">{t("não será exibida novamente")}</strong>.
          </p>
          <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2.5">
            <code className="font-mono text-base text-primary flex-1 select-all">
              {senhaNova?.senha}
            </code>
            <button
              onClick={() => {
                if (senhaNova?.senha) {
                  navigator.clipboard
                    .writeText(senhaNova.senha)
                    .then(() => setToast({ msg: t("Senha copiada."), tipo: "sucesso" }))
                    .catch(() =>
                      setToast({ msg: t("Não foi possível copiar."), tipo: "erro" })
                    );
                }
              }}
              className="btn btn-secondary text-xs"
            >
              <Copy size={14} />
              {t("Copiar")}
            </button>
          </div>
          <p className="text-xs text-muted">
            {t("O usuário deve trocar a senha pela aba")} <strong>{t("Segurança")}</strong> {t("no primeiro acesso.")}
          </p>
          <div className="flex justify-end pt-2 border-t border-border">
            <button onClick={() => setSenhaNova(null)} className="btn btn-primary">
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
  ultimoLogin: string | null;
  senhaPadrao: boolean;
  /** Plaintext da senha aleatória — só preenchida enquanto senhaPadrao=true. */
  senhaPadraoValor: string | null;
};

function ModalUsuario({
  modo,
  inicial,
  onFechar,
  onCriar,
  onEditar,
  onResetarSenha,
}: {
  modo: "criar" | "editar";
  inicial?: UsuarioEquipe;
  onFechar: () => void;
  onCriar: (dados: {
    nome: string;
    email: string;
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
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [escopo, setEscopo] = useState<EscopoUsuario>(inicial?.escopo ?? ESCOPO_PADRAO);
  const [funcoes, setFuncoes] = useState<Funcoes>(inicial?.funcoes ?? {});
  const [ativo, setAtivo] = useState<boolean>(inicial?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

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
    if (modo === "criar" && (!email.trim() || !email.includes("@"))) {
      setErro(t("Informe um e-mail válido."));
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
          email: email.trim(),
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
            <span className="text-xs font-medium text-secondary">{t("E-mail de acesso")}</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email@agencia.com")}
              className="campo-input"
              type="email"
            />
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
