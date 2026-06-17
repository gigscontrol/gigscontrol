"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Music,
  Plus,
  Trash2,
  X,
  AlertCircle,
  PauseCircle,
  PlayCircle,
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
  Search,
  Users,
} from "lucide-react";
import Toast from "../Toast";
import CidadeIBGEAutocomplete, {
  type CidadeIBGE,
} from "../CidadeIBGEAutocomplete";
import ColorPicker from "../ColorPicker";
import {
  useWorkspace,
  LABELS_PAPEL_EQUIPE,
  type NovoArtistaInput,
} from "@/lib/workspace-context";
import { PRIVACIDADE_DJ_PADRAO, type PrivacidadeDj } from "@/lib/permissoes";
import { useAuth } from "@/lib/auth-context";
import { getPlano } from "@/lib/planos";
import {
  LABELS_TAXA_MODO,
  CATALOGO_CAMARIM,
  CATALOGO_EFEITOS,
  LIMITE_RIDER_CAMARIM,
  LIMITE_RIDER_EFEITOS,
  type TaxaAgenciaModo,
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
const CORES = [
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
  taxaModo: TaxaAgenciaModo;
  taxaValor?: number;
  riderCamarim: string[];
  riderEfeitos: string[];
  privacidade: PrivacidadeDj;
};

const MODOS_TAXA: TaxaAgenciaModo[] = [
  "sem-taxa",
  "perc-fixa",
  "perc-variavel",
  "valor-fixo",
  "valor-variavel",
];

export default function AbaArtistas() {
  const {
    artistas,
    adicionarArtista,
    removerArtista,
    alternarSuspensaoArtista,
    resetarSenhaArtista,
    reordenarArtistas,
    lixeiraArtistas,
    recarregarLixeira,
    restaurarDaLixeira,
    equipe,
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
      setToast({ msg: `${nomeArt} restaurado.`, tipo: "sucesso" });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setAcaoLixeira(null);
    }
  }

  // ---- Top bar de DJs + perfil (redesign) ----
  const ultimoVistoRef = useRef<string | null>(null);
  const [djSelecionadoId, setDjSelecionadoId] = useState<string | null>(null);
  const [conta, setConta] = useState<DadosConta | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(false);
  const [modoReordenar, setModoReordenar] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativos" | "suspensos">("todos");
  const [copiouSenhaCard, setCopiouSenhaCard] = useState(false);

  // Mantém uma seleção válida (default = primeiro, ou o último visto).
  useEffect(() => {
    if (artistas.length === 0) {
      if (djSelecionadoId !== null) setDjSelecionadoId(null);
      return;
    }
    const existe = djSelecionadoId && artistas.some((a) => a.id === djSelecionadoId);
    if (!existe) {
      const fb =
        ultimoVistoRef.current &&
        artistas.some((a) => a.id === ultimoVistoRef.current)
          ? ultimoVistoRef.current
          : artistas[0].id;
      setDjSelecionadoId(fb);
    }
  }, [artistas, djSelecionadoId]);

  useEffect(() => {
    if (djSelecionadoId) ultimoVistoRef.current = djSelecionadoId;
  }, [djSelecionadoId]);

  // Carrega email/senha da conta do DJ selecionado (igual o modal de editar).
  useEffect(() => {
    if (!djSelecionadoId) {
      setConta(null);
      return;
    }
    let ativo = true;
    setCarregandoConta(true);
    setConta(null);
    fetch(`/api/artistas/${djSelecionadoId}/conta`, { credentials: "include" })
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
  }, [djSelecionadoId]);

  const djSelecionado = useMemo(
    () => artistas.find((a) => a.id === djSelecionadoId) ?? null,
    [artistas, djSelecionadoId]
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

  function resetarSenhaDoPerfil(id: string, nome: string) {
    if (!confirm(`Gerar uma nova senha aleatória pro artista ${nome}?`)) return;
    resetarSenhaArtista(id)
      .then((nova) =>
        setCredenciaisGeradas({ nomeArtista: nome, username: "—", senha: nova })
      )
      .catch((e) => setToast({ msg: (e as Error).message, tipo: "erro" }));
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header da página */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "var(--module-agencia)" }}
          >
            <Music size={20} />
          </div>
          <div>
            <div className="page-title">Artistas</div>
            <div className="page-subtitle">
              {plano
                ? `Plano ${plano.nome} — ${usados} de ${limite} em uso`
                : "Artistas da sua agência"}
            </div>
          </div>
        </div>
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
      </div>

      {noLimite && (
        <div
          className="flex items-start gap-2 text-sm rounded-md px-3 py-2.5"
          style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "var(--warning)" }}
        >
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            Você atingiu o limite de artistas do plano {plano?.nome}. Para
            adicionar mais, faça upgrade do plano ou remova um artista.
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
              const ativo = a.id === djSelecionadoId;
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
                      setDjSelecionadoId(a.id);
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
                      ? "2px solid var(--module-agencia)"
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
                      {a.name.charAt(0).toUpperCase()}
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
              title={noLimite ? "Limite do plano atingido" : "Adicionar artista"}
              className="h-9 w-9 rounded-full border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 transition-colors hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "var(--module-agencia)" }}
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
                  placeholder="Buscar"
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
                    {f === "todos" ? "Todos" : f === "ativos" ? "Ativos" : "Suspensos"}
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
                  Concluir
                </>
              ) : (
                <>
                  <GripVertical size={14} />
                  Reordenar
                </>
              )}
            </button>
          )}
        </div>
        {modoReordenar && (
          <p className="text-xs text-muted mt-2">
            Arraste os avatares pra reordenar — reflete na sidebar e nos filtros do app.
          </p>
        )}
      </div>

      {/* Perfil do DJ selecionado */}
      {!djSelecionado ? (
        <div className="card flex flex-col items-center justify-center text-center gap-3 py-16">
          <div
            className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center"
            style={{ color: "var(--module-agencia)" }}
          >
            <Music size={22} />
          </div>
          <div className="section-title">Nenhum artista cadastrado</div>
          <p className="text-sm text-muted max-w-sm">
            Cadastre o primeiro artista da sua agência pra começar.
          </p>
          <button
            onClick={() => setCriando(true)}
            disabled={noLimite}
            className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Adicionar artista
          </button>
        </div>
      ) : editando && editando.id === djSelecionado.id ? (
        <ModalEditarArtista
          modoInline
          artista={editando}
          slugAgencia={slugAgencia}
          onCancelar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            setToast({ msg: "Artista atualizado.", tipo: "sucesso" });
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
                background: `linear-gradient(90deg, ${djSelecionado.color}, ${djSelecionado.color}66)`,
              }}
            />
            <div className="p-5 flex items-start gap-4 flex-wrap">
              <span
                className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{
                  background: djSelecionado.acessoSuspenso
                    ? "var(--border-strong)"
                    : `linear-gradient(135deg, ${djSelecionado.color}, ${djSelecionado.color}99)`,
                }}
              >
                {djSelecionado.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="page-title">{djSelecionado.name}</div>
                  {djSelecionado.acessoSuspenso && (
                    <span className="badge badge-warning">Acesso suspenso</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs text-muted mt-1.5">
                  {djSelecionado.username && (
                    <button
                      type="button"
                      onClick={() => copiarUsername(djSelecionado.username!)}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors group"
                      title="Copiar login"
                    >
                      <AtSign size={11} />
                      <span className="font-mono">{djSelecionado.username}</span>
                      {usernameCopiado === djSelecionado.username ? (
                        <CheckCircle2 size={11} style={{ color: "var(--success)" }} />
                      ) : (
                        <Copy
                          size={11}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                    </button>
                  )}
                  {djSelecionado.cidadeNome && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} />
                      {djSelecionado.cidadeNome}
                      {djSelecionado.cidadeUf ? `/${djSelecionado.cidadeUf}` : ""}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: djSelecionado.color }}
                    />
                    <span className="font-mono uppercase">{djSelecionado.color}</span>
                  </span>
                </div>
              </div>

              {/* Ações */}
              {removendo === djSelecionado.id ? (
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted">
                    Remover {djSelecionado.name}?
                  </span>
                  <button
                    onClick={() => {
                      removerArtista(djSelecionado.id);
                      setRemovendo(null);
                    }}
                    className="btn text-xs px-2.5 py-1"
                    style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => setRemovendo(null)}
                    className="btn-ghost text-xs px-2.5 py-1"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() =>
                      setEditando({
                        id: djSelecionado.id,
                        nome: djSelecionado.name,
                        cor: djSelecionado.color,
                        usernameAtual: djSelecionado.username ?? "",
                        cidadeIbgeId: djSelecionado.cidadeIbgeId,
                        cidadeNome: djSelecionado.cidadeNome,
                        cidadeUf: djSelecionado.cidadeUf,
                        taxaModo: djSelecionado.taxaModo ?? "sem-taxa",
                        taxaValor: djSelecionado.taxaValor,
                        riderCamarim: djSelecionado.riderCamarim ?? [],
                        riderEfeitos: djSelecionado.riderEfeitos ?? [],
                        privacidade: djSelecionado.privacidade ?? PRIVACIDADE_DJ_PADRAO,
                      })
                    }
                    className="btn btn-secondary text-xs inline-flex items-center gap-1"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => alternarSuspensaoArtista(djSelecionado.id)}
                    className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1.5"
                    style={{
                      color: djSelecionado.acessoSuspenso
                        ? "var(--success)"
                        : "var(--warning)",
                    }}
                  >
                    {djSelecionado.acessoSuspenso ? (
                      <>
                        <PlayCircle size={14} /> Reativar
                      </>
                    ) : (
                      <>
                        <PauseCircle size={14} /> Suspender
                      </>
                    )}
                  </button>
                  <button
                    onClick={() =>
                      resetarSenhaDoPerfil(djSelecionado.id, djSelecionado.name)
                    }
                    className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1.5"
                    style={{ color: "var(--module-agencia)" }}
                  >
                    <KeyRound size={14} /> Resetar senha
                  </button>
                  <button
                    onClick={() => setRemovendo(djSelecionado.id)}
                    className="btn-ghost p-1.5 rounded"
                    style={{ color: "var(--danger)" }}
                    aria-label="Remover artista"
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
                <KeyRound size={12} style={{ color: "var(--module-agencia)" }} />
                Acesso ao sistema
              </div>
              {djSelecionado.username && (
                <div>
                  <div className="text-[0.7rem] text-muted mb-1">Login</div>
                  <button
                    type="button"
                    onClick={() => copiarUsername(djSelecionado.username!)}
                    className="w-full flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 hover:border-border-strong transition-colors text-left"
                  >
                    <span className="font-mono text-sm text-primary flex-1 truncate">
                      {djSelecionado.username}
                    </span>
                    {usernameCopiado === djSelecionado.username ? (
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
                  Carregando dados da conta…
                </div>
              ) : !conta ? (
                <p className="text-xs" style={{ color: "var(--danger)" }}>
                  Não foi possível carregar a conta.
                </p>
              ) : (
                <>
                  <div>
                    <div className="text-[0.7rem] text-muted mb-1">E-mail</div>
                    {conta.emailFakeInterno ? (
                      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                        <Mail size={14} className="text-muted flex-shrink-0" />
                        <span className="flex-1 text-sm text-muted italic">
                          Usuário não cadastrou nenhum email
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
                              <ShieldCheck size={11} /> Verificado
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1"
                              style={{ color: "var(--warning)" }}
                            >
                              <AlertTriangle size={11} /> Não verificado
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <div className="text-[0.7rem] text-muted mb-1">Senha</div>
                    {conta.senhaPadrao && conta.senhaPadraoValor ? (
                      <>
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
                                  setCopiouSenhaCard(true);
                                  setTimeout(() => setCopiouSenhaCard(false), 2000);
                                });
                            }}
                            className="btn-ghost p-1 rounded"
                            aria-label="Copiar senha"
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
                          <AlertTriangle size={11} /> Senha padrão — usuário ainda não trocou.
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
                          Senha padrão sem valor disponível. Use “Resetar senha” pra gerar uma nova.
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
                        <span>Senha já alterada pelo usuário.</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Privacidade (read-only; edita no formulário) */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <ShieldCheck size={12} style={{ color: "var(--module-agencia)" }} />
                Privacidade
              </div>
              {(() => {
                const priv = djSelecionado.privacidade ?? PRIVACIDADE_DJ_PADRAO;
                const grupos = [
                  { label: "Orçamentos", ver: priv.orcamentosVer, agiu: priv.orcamentosCriar, agirLabel: "Vê e cria" },
                  { label: "Vendas", ver: priv.vendasVer, agiu: priv.vendasCriar, agirLabel: "Vê e fecha" },
                  { label: "Financeiro", ver: priv.financeiroVer, agiu: priv.financeiroInformar, agirLabel: "Vê e informa" },
                  { label: "Contratos", ver: priv.contratosVer, agiu: priv.contratosCriar, agirLabel: "Vê e cria" },
                ];
                return (
                  <div className="flex flex-col gap-2">
                    {grupos.map((g) => {
                      const txt = g.agiu ? g.agirLabel : g.ver ? "Só vê" : "Não vê";
                      const cls = g.agiu ? "badge-success" : g.ver ? "badge-info" : "badge-neutral";
                      return (
                        <div key={g.label} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-secondary">{g.label}</span>
                          <span
                            className={`badge ${cls}`}
                            style={g.ver ? undefined : { opacity: 0.55 }}
                          >
                            {txt}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-secondary">Contatos</span>
                      <span
                        className={`badge ${priv.contatos === "todos" ? "badge-info" : "badge-neutral"}`}
                      >
                        {priv.contatos === "todos" ? "Toda a agência" : "Só dos shows dele"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-secondary inline-flex items-center gap-1">
                        <Lock size={11} /> Agenda
                      </span>
                      <span className="text-xs text-muted">Sempre só a dele</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Membros da equipe que atendem o DJ */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                <Users size={12} style={{ color: "var(--module-agencia)" }} />
                Membros da equipe
              </div>
              {(() => {
                const membros = equipe.filter(
                  (m) =>
                    m.ativo &&
                    ((m.funcoes.vendedor ?? []).includes(djSelecionado.id) ||
                      (m.funcoes.financeiro ?? []).includes(djSelecionado.id) ||
                      (m.funcoes.produtor ?? []).includes(djSelecionado.id))
                );
                if (membros.length === 0)
                  return (
                    <div className="text-sm text-muted">
                      Nenhum membro da equipe atende este artista ainda.
                    </div>
                  );
                return (
                  <div className="flex flex-col gap-2">
                    {membros.map((m) => {
                      const papeis = (
                        ["vendedor", "financeiro", "produtor"] as const
                      ).filter((p) => (m.funcoes[p] ?? []).includes(djSelecionado.id));
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <span
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white flex-shrink-0"
                            style={{ background: "var(--border-strong)" }}
                          >
                            {m.nome.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-primary truncate">{m.nome}</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {papeis.map((p) => (
                                <span
                                  key={p}
                                  className="text-[0.6rem] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                                  style={{
                                    backgroundColor: `${LABELS_PAPEL_EQUIPE[p].cor}22`,
                                    color: LABELS_PAPEL_EQUIPE[p].cor,
                                  }}
                                >
                                  {LABELS_PAPEL_EQUIPE[p].nome}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Rider de camarim */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                Rider de camarim ({(djSelecionado.riderCamarim ?? []).length}/
                {LIMITE_RIDER_CAMARIM})
              </div>
              {(djSelecionado.riderCamarim ?? []).length === 0 ? (
                <div className="text-sm text-muted">Nenhum item configurado.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(djSelecionado.riderCamarim ?? []).map((item, i) => (
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
                Rider de efeitos ({(djSelecionado.riderEfeitos ?? []).length}/
                {LIMITE_RIDER_EFEITOS})
              </div>
              {(djSelecionado.riderEfeitos ?? []).length === 0 ? (
                <div className="text-sm text-muted">Nenhum item configurado.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(djSelecionado.riderEfeitos ?? []).map((item, i) => (
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

            {/* Taxa de agência */}
            <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
                {(djSelecionado.taxaModo ?? "sem-taxa").startsWith("perc") ? (
                  <Percent size={12} style={{ color: "var(--module-agencia)" }} />
                ) : (
                  <DollarSign size={12} style={{ color: "var(--module-agencia)" }} />
                )}
                Taxa de agência
              </div>
              {(() => {
                const modo = djSelecionado.taxaModo ?? "sem-taxa";
                if (modo === "sem-taxa")
                  return <div className="text-sm text-muted">Sem taxa</div>;
                const val = djSelecionado.taxaValor;
                const sufixo =
                  modo === "perc-fixa" && val !== undefined
                    ? ` ${val}%`
                    : modo === "valor-fixo" && val !== undefined
                    ? ` R$ ${val.toFixed(2)}`
                    : "";
                return (
                  <div>
                    <div className="text-base font-semibold text-primary">
                      {LABELS_TAXA_MODO[modo]}
                      {sufixo}
                    </div>
                    {(modo === "perc-variavel" || modo === "valor-variavel") && (
                      <div className="text-xs text-muted mt-0.5">
                        Valor definido a cada orçamento.
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
              <Trash2 size={14} style={{ color: "var(--module-financeiro)" }} />
              <div className="section-title">
                Na lixeira ({lixeiraArtistas.length})
              </div>
            </div>
            <span className="text-xs text-muted">Recuperáveis por 30 dias</span>
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
                    {item.artista.name.charAt(0).toUpperCase()}
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
                        ? "Expira hoje"
                        : `${item.diasRestantes} dia${item.diasRestantes === 1 ? "" : "s"} restantes`}
                    </div>
                  </div>
                  <button
                    onClick={() => aoRestaurar(item.artista.id, item.artista.name)}
                    disabled={acaoLixeira === `restaurar-${item.artista.id}`}
                    className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1 disabled:opacity-50"
                    style={{ color: "var(--success)" }}
                  >
                    <RotateCcw size={13} />
                    Restaurar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-elevated/50 p-3 text-xs text-secondary leading-relaxed">
        <strong className="text-primary">Ordem:</strong> clique em{" "}
        <span className="inline-flex items-center gap-0.5 font-medium">
          <GripVertical size={11} /> Reordenar
        </span>{" "}
        na barra de cima e arraste os avatares — a ordem reflete na sidebar
        de DJs e em todos os filtros do app.
        <br />
        <strong className="text-primary">Login do artista:</strong> aparece
        ao lado do nome (clique pra copiar). Fica salvo no sistema e você
        consegue acessar sempre que precisar.{" "}
        <br />
        <strong className="text-primary">Senha:</strong> só aparece uma vez
        ao criar. Se o artista perder, abra{" "}
        <span className="inline-flex items-center gap-1 font-medium">
          <Pencil size={11} /> Editar
        </span>{" "}
        e gere uma nova lá dentro.{" "}
        <br />
        <strong className="text-primary">Suspender:</strong> artista fica
        visível mas em cinza e sem editar nada.{" "}
        <strong className="text-primary">Remover:</strong> manda pra
        Lixeira (recuperável por 30 dias).
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
  // Seção 1 — dados básicos
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [cidade, setCidade] = useState<CidadeIBGE | null>(null);

  // Seção 2 — acesso
  // Auto-preenche a partir do nome enquanto o usuário não toca no campo.
  // Quando ele edita manualmente o username, paramos de espelhar.
  const [usernameRaiz, setUsernameRaiz] = useState("");
  const [usernameFoiEditado, setUsernameFoiEditado] = useState(false);

  // Seção 3 — taxa
  const [taxaModo, setTaxaModo] = useState<TaxaAgenciaModo>("sem-taxa");
  const [taxaValor, setTaxaValor] = useState<string>("");

  // Seção 4 e 5 — rider (apenas nomes; quantidade vai no orçamento)
  const [riderCamarim, setRiderCamarim] = useState<string[]>([]);
  const [riderEfeitos, setRiderEfeitos] = useState<string[]>([]);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Feedback do botão de copiar username completo.
  const [copiouUsername, setCopiouUsername] = useState(false);

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

  // Validação por seção (pra habilitar/desabilitar submit)
  // Nome do artista NÃO precisa ser único globalmente — duas agências
  // diferentes podem ter "Bruno" cada uma. Mas DENTRO da mesma agência
  // bloqueamos duplicata pra não confundir o admin no próprio CRM.
  // `nomesExistentes` chega do parent já escopado pelo workspace atual.
  function validarTudo(): string | null {
    const n = nome.trim();
    if (!n) return "Informe o nome do artista.";
    if (colisaoNome === "ativo")
      return "Já existe um artista com esse nome na sua agência.";
    if (colisaoNome === "lixeira")
      return `Existe um artista na lixeira com esse nome ("${n}"). Restaure ou apague antes de reutilizar.`;
    if (!usernameValido)
      return "Username inválido (3+ chars, letras/números/hífen).";
    if (colisaoUsername === "ativo")
      return "Esse login já está em uso por outro artista da sua agência.";
    if (colisaoUsername === "lixeira")
      return "Esse login pertence a um artista da lixeira. Restaure ou apague antes de reutilizar.";
    if (!cidade) return "Informe a cidade onde o artista reside.";
    // Taxa obrigatória nos modos fixos
    if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) {
        return `Informe o valor da taxa (${LABELS_TAXA_MODO[taxaModo]}).`;
      }
      if (taxaModo === "perc-fixa" && v > 100) {
        return "Porcentagem não pode ser maior que 100%.";
      }
    }
    return null;
  }

  async function salvar() {
    setErro(null);
    const v = validarTudo();
    if (v) {
      setErro(v);
      return;
    }
    setEnviando(true);
    try {
      const input: NovoArtistaInput = {
        nome: nome.trim(),
        cor,
        usernameRaiz: usernameRaiz.trim().toLowerCase(),
      };
      if (cidade) {
        input.cidadeIbgeId = cidade.ibgeId;
        input.cidadeNome = cidade.nome;
        input.cidadeUf = cidade.uf;
      }
      input.taxaModo = taxaModo;
      if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
        input.taxaValor = parseFloat(taxaValor.replace(",", "."));
      }
      if (riderCamarim.length > 0) input.riderCamarim = riderCamarim;
      if (riderEfeitos.length > 0) input.riderEfeitos = riderEfeitos;

      const resultado = await adicionarArtista(input);
      onCriado({
        nomeArtista: nome.trim(),
        username: resultado.usernameCompleto,
        senha: resultado.senhaTemporaria,
      });
    } catch (e) {
      setErro((e as Error).message);
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
      style={modoInline ? undefined : { boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
      onClick={modoInline ? undefined : (e) => e.stopPropagation()}
    >
      {!modoInline && (
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Music size={16} style={{ color: "var(--module-vendas)" }} />
            <div className="section-title">Novo artista</div>
          </div>
          <button onClick={onCancelar} className="btn-ghost p-1.5 rounded">
            <X size={18} />
          </button>
        </div>
      )}

        <div className="p-4 flex flex-col gap-5">
          {/* Seção 1 — Dados básicos */}
          <Secao titulo="Dados básicos">
            <Campo label="Nome do artista">
              <input
                value={nome}
                onChange={(e) => {
                  const v = e.target.value;
                  setNome(v);
                  // Espelha o username enquanto o usuário não tiver
                  // mexido manualmente no campo de login
                  if (!usernameFoiEditado) {
                    setUsernameRaiz(normalizarUsername(v));
                  }
                }}
                placeholder="Ex.: DJ Lunar"
                className="campo-input"
                autoFocus
              />
              {colisaoNome === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  Já existe um artista ATIVO com esse nome. Escolha outro.
                </p>
              )}
              {colisaoNome === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  Existe um artista na <strong>lixeira</strong> com esse nome.
                  Restaure ou apague pra reutilizar.
                </p>
              )}
            </Campo>

            <SeletorDeCor cor={cor} onChange={setCor} />

            <Campo label="Cidade onde reside">
              <CidadeIBGEAutocomplete
                value={cidade}
                onChange={setCidade}
                placeholder="Ex: São Paulo, Belo Horizonte..."
              />
            </Campo>
          </Secao>

          {/* Seção 2 — Acesso ao sistema */}
          <Secao titulo="Acesso ao sistema">
            <Campo label="Login (username)">
              <div className="flex items-center bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
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
                  aria-label="Copiar username completo"
                  title={
                    usernameValido
                      ? "Copiar username completo"
                      : "Preencha um username válido pra copiar"
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
                  Use 3+ chars (letras, números, hífen)
                </p>
              )}
              {usernameValido && colisaoUsername === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  Esse login já está em uso por outro artista ATIVO.
                </p>
              )}
              {usernameValido && colisaoUsername === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  Esse login pertence a um artista na <strong>lixeira</strong>.
                  Restaure ou apague pra reutilizar.
                </p>
              )}
              {usernameValido && !colisaoUsername && usernameCompleto && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--success)" }}
                >
                  Login completo:{" "}
                  <strong className="font-mono text-primary">
                    {usernameCompleto}
                  </strong>
                </p>
              )}
            </Campo>

            <div
              className="text-xs rounded-md px-3 py-2 leading-relaxed"
              style={{
                backgroundColor: "rgba(168,85,247,0.08)",
                color: "var(--text-secondary)",
              }}
            >
              <strong>Login:</strong> fica salvo e você consegue ver
              depois na lista de artistas.
              <br />
              <strong>Senha:</strong> será gerada automaticamente (algo
              tipo <span className="font-mono">Lyra-Bravo-7421</span>) e
              mostrada <strong>só uma vez</strong> ao final pra você
              copiar. Se perder, dá pra gerar uma nova clicando em{" "}
              <span className="inline-flex items-center gap-1 font-medium">
                <KeyRound size={11} /> Senha
              </span>{" "}
              na lista.
            </div>
          </Secao>

          {/* Seção 3 — Taxa de agência */}
          <Secao titulo="Taxa de agência">
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
                        }
                      }}
                      className="mt-0"
                    />
                    <span className="text-sm flex-1">{LABELS_TAXA_MODO[m]}</span>
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
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Nos modos <strong>variáveis</strong>, vendedor/admin define o
              valor da taxa a cada orçamento.
            </p>
          </Secao>

          {/* Seção 4 — Rider de camarim */}
          <Secao titulo={`Rider de camarim (${riderCamarim.length}/${LIMITE_RIDER_CAMARIM})`}>
            <ListaRider
              itens={riderCamarim}
              onChange={setRiderCamarim}
              catalogoSugestoes={CATALOGO_CAMARIM}
              placeholderItem="Ex: Jack Daniels"
              limite={LIMITE_RIDER_CAMARIM}
            />
          </Secao>

          {/* Seção 5 — Rider de efeitos */}
          <Secao titulo={`Rider de efeitos (${riderEfeitos.length}/${LIMITE_RIDER_EFEITOS})`}>
            <ListaRider
              itens={riderEfeitos}
              onChange={setRiderEfeitos}
              catalogoSugestoes={CATALOGO_EFEITOS}
              placeholderItem="Ex: CO²"
              limite={LIMITE_RIDER_EFEITOS}
            />
          </Secao>

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
              Cancelar
            </button>
          )}
          <button
            onClick={salvar}
            disabled={enviando || temColisao}
            className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              temColisao
                ? "Resolva os avisos de nome/login antes de cadastrar"
                : undefined
            }
          >
            <Plus size={14} />
            {enviando
              ? "Cadastrando..."
              : `Cadastrar em ${nomeAgencia || "agência"}`}
          </button>
        </div>
      </div>
  );

  if (modoInline) return conteudo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
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
  const { atualizarArtista } = useWorkspace();

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
  const [cidade, setCidade] = useState<CidadeIBGE | null>(
    artista.cidadeIbgeId && artista.cidadeNome && artista.cidadeUf
      ? {
          ibgeId: artista.cidadeIbgeId,
          nome: artista.cidadeNome,
          uf: artista.cidadeUf,
        }
      : null
  );
  const [usernameRaiz, setUsernameRaiz] = useState(usernameRaizInicial);
  const [emailEditavel, setEmailEditavel] = useState("");
  // Modo de exibição do bloco de e-mail. Por padrão mostra só leitura
  // (e-mail em cinza ou aviso "não cadastrou"); só revela o input
  // quando o admin clica em "Definir e-mail" / "Editar".
  const [editandoEmail, setEditandoEmail] = useState(false);
  // Feedback do botão de copiar senha aleatória do bloco "Senha".
  const [copiouSenhaPadrao, setCopiouSenhaPadrao] = useState(false);
  const [taxaModo, setTaxaModo] = useState<TaxaAgenciaModo>(artista.taxaModo);
  const [taxaValor, setTaxaValor] = useState<string>(
    artista.taxaValor !== undefined ? String(artista.taxaValor) : ""
  );
  const [riderCamarim, setRiderCamarim] = useState<string[]>(artista.riderCamarim);
  const [riderEfeitos, setRiderEfeitos] = useState<string[]>(artista.riderEfeitos);
  const [privacidade, setPrivacidade] = useState<PrivacidadeDj>(artista.privacidade);

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
        setEmailEditavel(d.emailFakeInterno ? "" : d.email);
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
  // Email mudou quando: tem conta carregada, o admin digitou algo não
  // vazio, e ou (a) o artista nunca tinha e-mail real (estava no fake
  // interno) ou (b) o que ele digitou é diferente do atual. Antes
  // bloqueava o save quando estava fake — bug.
  const emailMudou =
    !!conta &&
    emailEditavel.trim().length > 0 &&
    (conta.emailFakeInterno ||
      emailEditavel.trim().toLowerCase() !== conta.email.toLowerCase());

  function validar(): string | null {
    const n = nome.trim();
    if (!n) return "Informe o nome do artista.";
    if (colisaoNome === "ativo")
      return "Já existe um artista com esse nome na sua agência.";
    if (colisaoNome === "lixeira")
      return `Existe um artista na lixeira com esse nome ("${n}"). Restaure ou apague antes de reutilizar.`;
    if (!cidade) return "Informe a cidade onde o artista reside.";
    if (!usernameValido)
      return "Username inválido (3+ chars, letras/números/hífen).";
    if (colisaoUsername === "ativo")
      return "Esse login já está em uso por outro artista da sua agência.";
    if (colisaoUsername === "lixeira")
      return "Esse login pertence a um artista da lixeira. Restaure ou apague antes de reutilizar.";
    if (emailEditavel.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEditavel.trim())) {
      return "E-mail inválido.";
    }
    if (taxaModo === "perc-fixa" || taxaModo === "valor-fixo") {
      const v = parseFloat(taxaValor.replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) {
        return `Informe o valor da taxa (${LABELS_TAXA_MODO[taxaModo]}).`;
      }
      if (taxaModo === "perc-fixa" && v > 100) {
        return "Porcentagem não pode ser maior que 100%.";
      }
    }
    return null;
  }

  async function salvar() {
    setErro(null);
    const v = validar();
    if (v) {
      setErro(v);
      return;
    }
    setEnviando(true);
    try {
      const patch: Partial<NovoArtistaInput> = {
        nome: nome.trim(),
        cor,
        cidadeIbgeId: cidade!.ibgeId,
        cidadeNome: cidade!.nome,
        cidadeUf: cidade!.uf,
        taxaModo,
        taxaValor:
          taxaModo === "perc-fixa" || taxaModo === "valor-fixo"
            ? parseFloat(taxaValor.replace(",", "."))
            : undefined,
        riderCamarim,
        riderEfeitos,
        privacidade,
      };
      // Username e email só se mudaram (evita trabalho desnecessário no backend)
      if (usernameMudou) {
        patch.usernameRaiz = usernameRaiz.trim().toLowerCase();
      }
      if (emailMudou) {
        patch.emailConta = emailEditavel.trim();
      }
      await atualizarArtista(artista.id, patch);
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const box = (
      <div
        className={
          modoInline
            ? "bg-surface border border-border rounded w-full"
            : "bg-surface border border-border rounded w-full max-w-[560px] max-h-[92vh] overflow-y-auto"
        }
        style={modoInline ? undefined : { boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
        onClick={modoInline ? undefined : (e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Pencil size={16} style={{ color: "var(--module-agencia)" }} />
            <div className="section-title">Editar {artista.nome}</div>
          </div>
          <button onClick={onCancelar} className="btn-ghost p-1.5 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5">
          {/* Seção 1 — Dados básicos */}
          <Secao titulo="Dados básicos">
            <Campo label="Nome do artista">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="campo-input"
              />
              {colisaoNome === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  Já existe um artista ATIVO com esse nome. Escolha outro.
                </p>
              )}
              {colisaoNome === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  Existe um artista na <strong>lixeira</strong> com esse nome.
                  Restaure ou apague pra reutilizar.
                </p>
              )}
            </Campo>

            <SeletorDeCor cor={cor} onChange={setCor} />

            <Campo label="Cidade onde reside">
              <CidadeIBGEAutocomplete
                value={cidade}
                onChange={setCidade}
                placeholder="Ex: São Paulo, Belo Horizonte..."
              />
            </Campo>
          </Secao>

          {/* Seção 2 — Acesso */}
          <Secao titulo="Acesso ao sistema">
            <Campo label="Login (username)">
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
                  aria-label="Copiar username completo"
                  title={
                    usernameValido
                      ? "Copiar username completo"
                      : "Preencha um username válido pra copiar"
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
              {!usernameValido && usernameRaiz.length > 0 && (
                <p className="text-[0.7rem] mt-1" style={{ color: "var(--danger)" }}>
                  Use 3+ chars (letras, números, hífen).
                </p>
              )}
              {usernameValido && colisaoUsername === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  Esse login já está em uso por outro artista ATIVO.
                </p>
              )}
              {usernameValido && colisaoUsername === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  Esse login pertence a um artista na <strong>lixeira</strong>.
                  Restaure ou apague pra reutilizar.
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
                    O artista vai precisar usar este novo login na próxima entrada.
                  </span>
                </div>
              )}
            </Campo>
          </Secao>

          {/* Seção 3 — Conta */}
          <Secao titulo="Conta">
            {carregandoConta ? (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <Loader2 size={14} className="animate-spin" />
                Carregando dados da conta...
              </div>
            ) : !conta ? (
              <p className="text-xs text-danger">
                Não foi possível carregar os dados da conta.
              </p>
            ) : (
              <>
                <Campo label="E-mail cadastrado">
                  {editandoEmail ? (
                    <>
                      {/* Modo edição: input + cancelar */}
                      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
                        <Mail size={14} className="text-muted flex-shrink-0" />
                        <input
                          type="email"
                          value={emailEditavel}
                          onChange={(e) => setEmailEditavel(e.target.value)}
                          placeholder="email@exemplo.com"
                          className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoEmail(false);
                            // Restaura valor original (vazio se estava fake)
                            setEmailEditavel(
                              conta.emailFakeInterno ? "" : conta.email
                            );
                          }}
                          className="text-[0.7rem] text-muted hover:text-secondary underline"
                        >
                          Cancelar
                        </button>
                        {emailMudou && (
                          <span
                            className="text-[0.7rem] inline-flex items-center gap-1"
                            style={{ color: "var(--warning)" }}
                          >
                            <AlertTriangle size={11} />
                            Salve o modal pra confirmar a troca.
                          </span>
                        )}
                      </div>
                    </>
                  ) : conta.emailFakeInterno ? (
                    <>
                      {/* Sem e-mail real */}
                      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                        <Mail size={14} className="text-muted flex-shrink-0" />
                        <span className="flex-1 text-sm text-muted italic">
                          Usuário não cadastrou nenhum email
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditandoEmail(true)}
                        className="text-[0.7rem] mt-1.5 inline-flex items-center gap-1 hover:underline"
                        style={{ color: "var(--module-vendas)" }}
                      >
                        <Pencil size={11} /> Definir e-mail
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Tem e-mail real — leitura em cinza + editar */}
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
                            Verificado
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1"
                            style={{ color: "var(--warning)" }}
                          >
                            <AlertTriangle size={11} />
                            Não verificado
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditandoEmail(true)}
                          className="inline-flex items-center gap-1 hover:underline"
                          style={{ color: "var(--module-vendas)" }}
                        >
                          <Pencil size={11} /> Editar
                        </button>
                      </div>
                    </>
                  )}
                </Campo>

                {/* ---- Senha ---- */}
                <Campo label="Senha">
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
                          aria-label="Copiar senha"
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
                        Senha padrão gerada pelo sistema — usuário ainda não
                        trocou.
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
                        Usuário ainda está com a <strong>senha padrão</strong>{" "}
                        gerada pelo sistema, mas o valor não está disponível
                        (artista criado antes desta versão). Gere uma nova
                        abaixo pra conseguir copiar.
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
                      <span>Senha já foi alterada pelo usuário.</span>
                    </div>
                  )}
                </Campo>

                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Gerar uma nova senha aleatória pro artista ${artista.nome}?`
                      )
                    ) {
                      void onResetarSenha();
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors hover:bg-elevated"
                  style={{
                    borderColor: "var(--module-vendas)",
                    color: "var(--module-vendas)",
                  }}
                >
                  <KeyRound size={14} />
                  Gerar nova senha aleatória
                </button>
              </>
            )}
          </Secao>

          {/* Seção 4 — Taxa de agência */}
          <Secao titulo="Taxa de agência">
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
                      name="taxaModoEdit"
                      checked={sel}
                      onChange={() => {
                        setTaxaModo(m);
                        if (m !== "perc-fixa" && m !== "valor-fixo") {
                          setTaxaValor("");
                        }
                      }}
                    />
                    <span className="text-sm flex-1">{LABELS_TAXA_MODO[m]}</span>
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
          </Secao>

          {/* Seção 5 — Rider de camarim */}
          <Secao
            titulo={`Rider de camarim (${riderCamarim.length}/${LIMITE_RIDER_CAMARIM})`}
          >
            <ListaRider
              itens={riderCamarim}
              onChange={setRiderCamarim}
              catalogoSugestoes={CATALOGO_CAMARIM}
              placeholderItem="Ex: Jack Daniels"
              limite={LIMITE_RIDER_CAMARIM}
            />
          </Secao>

          {/* Seção 6 — Rider de efeitos */}
          <Secao
            titulo={`Rider de efeitos (${riderEfeitos.length}/${LIMITE_RIDER_EFEITOS})`}
          >
            <ListaRider
              itens={riderEfeitos}
              onChange={setRiderEfeitos}
              catalogoSugestoes={CATALOGO_EFEITOS}
              placeholderItem="Ex: CO²"
              limite={LIMITE_RIDER_EFEITOS}
            />
          </Secao>

          {/* Seção 7 — Privacidade (permissões do DJ) */}
          <Secao titulo="Privacidade — o que ele pode ver/fazer">
            <div className="flex flex-col gap-1.5">
              <TogglePriv
                label="Ver orçamentos"
                sub="Vê os orçamentos dele"
                valor={privacidade.orcamentosVer}
                onChange={(v) =>
                  setPrivacidade((p) => ({
                    ...p,
                    orcamentosVer: v,
                    orcamentosCriar: v ? p.orcamentosCriar : false,
                  }))
                }
              />
              <TogglePriv
                label="Criar orçamentos"
                sub="Pode gerar orçamento"
                valor={privacidade.orcamentosCriar}
                disabled={!privacidade.orcamentosVer}
                onChange={(v) => setPrivacidade((p) => ({ ...p, orcamentosCriar: v }))}
              />
              <TogglePriv
                label="Ver vendas"
                sub="Vê o histórico de vendas dele"
                valor={privacidade.vendasVer}
                onChange={(v) =>
                  setPrivacidade((p) => ({
                    ...p,
                    vendasVer: v,
                    vendasCriar: v ? p.vendasCriar : false,
                  }))
                }
              />
              <TogglePriv
                label="Fechar vendas"
                sub="Pode concretizar venda"
                valor={privacidade.vendasCriar}
                disabled={!privacidade.vendasVer}
                onChange={(v) => setPrivacidade((p) => ({ ...p, vendasCriar: v }))}
              />
              <TogglePriv
                label="Ver financeiro"
                sub="Vê o financeiro dele"
                valor={privacidade.financeiroVer}
                onChange={(v) =>
                  setPrivacidade((p) => ({
                    ...p,
                    financeiroVer: v,
                    financeiroInformar: v ? p.financeiroInformar : false,
                  }))
                }
              />
              <TogglePriv
                label="Informar pagamento"
                sub="Pode registrar pagamento no financeiro"
                valor={privacidade.financeiroInformar}
                disabled={!privacidade.financeiroVer}
                onChange={(v) => setPrivacidade((p) => ({ ...p, financeiroInformar: v }))}
              />
              <TogglePriv
                label="Ver contratos"
                sub="Vê os contratos dele"
                valor={privacidade.contratosVer}
                onChange={(v) =>
                  setPrivacidade((p) => ({
                    ...p,
                    contratosVer: v,
                    contratosCriar: v ? p.contratosCriar : false,
                  }))
                }
              />
              <TogglePriv
                label="Criar contratos"
                sub="Pode gerar contrato"
                valor={privacidade.contratosCriar}
                disabled={!privacidade.contratosVer}
                onChange={(v) => setPrivacidade((p) => ({ ...p, contratosCriar: v }))}
              />

              {/* Contatos */}
              <div className="p-2.5 rounded-md border border-border bg-elevated">
                <div className="text-sm font-medium text-primary mb-2">
                  Contatos que ele enxerga
                </div>
                <div className="pill-group">
                  <button
                    type="button"
                    onClick={() => setPrivacidade((p) => ({ ...p, contatos: "proprios" }))}
                    className={`pill ${privacidade.contatos === "proprios" ? "active" : ""}`}
                  >
                    Só dos shows dele
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivacidade((p) => ({ ...p, contatos: "todos" }))}
                    className={`pill ${privacidade.contatos === "todos" ? "active" : ""}`}
                  >
                    Toda a agência
                  </button>
                </div>
              </div>

              {/* Agenda — trava de sistema */}
              <div className="p-2.5 rounded-md border border-border bg-elevated opacity-60 flex items-center gap-2">
                <Lock size={13} className="text-muted flex-shrink-0" />
                <span className="text-sm text-secondary">
                  Agenda — ele sempre vê só a própria (trava do sistema).
                </span>
              </div>
            </div>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Por enquanto isso <strong className="text-secondary">configura</strong> as
              permissões. A restrição efetiva no acesso do DJ (esconder/bloquear de fato)
              entra numa próxima etapa.
            </p>
          </Secao>

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
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-surface">
          <button onClick={onCancelar} className="btn btn-secondary text-sm">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={enviando || temColisao}
            className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              temColisao
                ? "Resolva os avisos de nome/login antes de salvar"
                : undefined
            }
          >
            <Check size={14} />
            {enviando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
  );

  // ---- Modo inline: PERFIL EDITÁVEL ----
  // Mesma cara do perfil read-only do AbaArtistas (header com banda de cor
  // + avatar 64px, depois um grid de cards), só que com os campos
  // editáveis e Salvar/Cancelar no topo. Reaproveita exatamente o mesmo
  // estado/handlers do form em seções (box) acima.
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
              {(nome.trim().charAt(0) || "?").toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do artista"
                className="campo-input text-xl font-bold"
              />
              {colisaoNome === "ativo" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--danger)" }}
                >
                  <AlertCircle size={11} />
                  Já existe um artista ATIVO com esse nome. Escolha outro.
                </p>
              )}
              {colisaoNome === "lixeira" && (
                <p
                  className="text-xs mt-1 inline-flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={11} />
                  Existe um artista na <strong>lixeira</strong> com esse nome.
                  Restaure ou apague pra reutilizar.
                </p>
              )}
            </div>

            {/* Ações: Salvar / Cancelar */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button
                onClick={onCancelar}
                className="btn btn-secondary text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={enviando || temColisao}
                className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1"
                title={
                  temColisao
                    ? "Resolva os avisos de nome/login antes de salvar"
                    : undefined
                }
              >
                <Check size={14} />
                {enviando ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>

          {/* Corpo do header: cor + cidade */}
          <div className="grid gap-4 md:grid-cols-2">
            <SeletorDeCor cor={cor} onChange={setCor} />
            <Campo label="Cidade onde reside">
              <CidadeIBGEAutocomplete
                value={cidade}
                onChange={setCidade}
                placeholder="Cidade onde reside"
              />
            </Campo>
          </div>
        </div>
      </div>

      {/* Grid de cards editáveis */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Acesso ao sistema */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
            <KeyRound size={12} style={{ color: "var(--module-agencia)" }} />
            Acesso ao sistema
          </div>

          {/* Login (username) */}
          <Campo label="Login (username)">
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
                aria-label="Copiar username completo"
                title={
                  usernameValido
                    ? "Copiar username completo"
                    : "Preencha um username válido pra copiar"
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
                Use 3+ chars (letras, números, hífen).
              </p>
            )}
            {usernameValido && colisaoUsername === "ativo" && (
              <p
                className="text-xs mt-1 inline-flex items-center gap-1"
                style={{ color: "var(--danger)" }}
              >
                <AlertCircle size={11} />
                Esse login já está em uso por outro artista ATIVO.
              </p>
            )}
            {usernameValido && colisaoUsername === "lixeira" && (
              <p
                className="text-xs mt-1 inline-flex items-center gap-1"
                style={{ color: "var(--warning)" }}
              >
                <AlertTriangle size={11} />
                Esse login pertence a um artista na <strong>lixeira</strong>.
                Restaure ou apague pra reutilizar.
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
                  O artista vai precisar usar este novo login na próxima entrada.
                </span>
              </div>
            )}
          </Campo>

          {/* Conta: e-mail + senha */}
          {carregandoConta ? (
            <div className="flex items-center gap-2 text-sm text-muted py-2">
              <Loader2 size={14} className="animate-spin" />
              Carregando dados da conta...
            </div>
          ) : !conta ? (
            <p className="text-xs text-danger">
              Não foi possível carregar os dados da conta.
            </p>
          ) : (
            <>
              <Campo label="E-mail cadastrado">
                {editandoEmail ? (
                  <>
                    {/* Modo edição: input + cancelar */}
                    <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
                      <Mail size={14} className="text-muted flex-shrink-0" />
                      <input
                        type="email"
                        value={emailEditavel}
                        onChange={(e) => setEmailEditavel(e.target.value)}
                        placeholder="email@exemplo.com"
                        className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0"
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoEmail(false);
                          // Restaura valor original (vazio se estava fake)
                          setEmailEditavel(
                            conta.emailFakeInterno ? "" : conta.email
                          );
                        }}
                        className="text-[0.7rem] text-muted hover:text-secondary underline"
                      >
                        Cancelar
                      </button>
                      {emailMudou && (
                        <span
                          className="text-[0.7rem] inline-flex items-center gap-1"
                          style={{ color: "var(--warning)" }}
                        >
                          <AlertTriangle size={11} />
                          Salve pra confirmar a troca.
                        </span>
                      )}
                    </div>
                  </>
                ) : conta.emailFakeInterno ? (
                  <>
                    {/* Sem e-mail real */}
                    <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                      <Mail size={14} className="text-muted flex-shrink-0" />
                      <span className="flex-1 text-sm text-muted italic">
                        Usuário não cadastrou nenhum email
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditandoEmail(true)}
                      className="text-[0.7rem] mt-1.5 inline-flex items-center gap-1 hover:underline"
                      style={{ color: "var(--module-vendas)" }}
                    >
                      <Pencil size={11} /> Definir e-mail
                    </button>
                  </>
                ) : (
                  <>
                    {/* Tem e-mail real — leitura em cinza + editar */}
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
                          Verificado
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ color: "var(--warning)" }}
                        >
                          <AlertTriangle size={11} />
                          Não verificado
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditandoEmail(true)}
                        className="inline-flex items-center gap-1 hover:underline"
                        style={{ color: "var(--module-vendas)" }}
                      >
                        <Pencil size={11} /> Editar
                      </button>
                    </div>
                  </>
                )}
              </Campo>

              {/* ---- Senha ---- */}
              <Campo label="Senha">
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
                        aria-label="Copiar senha"
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
                      Senha padrão gerada pelo sistema — usuário ainda não
                      trocou.
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
                      Usuário ainda está com a <strong>senha padrão</strong>{" "}
                      gerada pelo sistema, mas o valor não está disponível
                      (artista criado antes desta versão). Gere uma nova
                      abaixo pra conseguir copiar.
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
                    <span>Senha já foi alterada pelo usuário.</span>
                  </div>
                )}
              </Campo>

              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Gerar uma nova senha aleatória pro artista ${artista.nome}?`
                    )
                  ) {
                    void onResetarSenha();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors hover:bg-elevated"
                style={{
                  borderColor: "var(--module-vendas)",
                  color: "var(--module-vendas)",
                }}
              >
                <KeyRound size={14} />
                Gerar nova senha aleatória
              </button>
            </>
          )}
        </div>

        {/* Privacidade */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
            <ShieldCheck size={12} style={{ color: "var(--module-agencia)" }} />
            Privacidade
          </div>
          <p className="text-xs text-muted -mt-1">
            Escolha o nível de cada área. Cada opção diz exatamente o que o DJ
            pode fazer.
          </p>
          <div className="flex flex-col gap-4">
            <SegmentedChoice
              titulo="Orçamentos"
              valor={nivelDe(privacidade.orcamentosVer, privacidade.orcamentosCriar)}
              opcoes={[
                { val: "nenhum", label: "Não vê" },
                { val: "ver", label: "Só vê" },
                { val: "agir", label: "Vê e cria" },
              ]}
              onChange={(n) =>
                setPrivacidade((p) => ({
                  ...p,
                  orcamentosVer: n !== "nenhum",
                  orcamentosCriar: n === "agir",
                }))
              }
            />
            <SegmentedChoice
              titulo="Vendas"
              valor={nivelDe(privacidade.vendasVer, privacidade.vendasCriar)}
              opcoes={[
                { val: "nenhum", label: "Não vê" },
                { val: "ver", label: "Só vê" },
                { val: "agir", label: "Vê e fecha" },
              ]}
              onChange={(n) =>
                setPrivacidade((p) => ({
                  ...p,
                  vendasVer: n !== "nenhum",
                  vendasCriar: n === "agir",
                }))
              }
            />
            <SegmentedChoice
              titulo="Financeiro"
              valor={nivelDe(privacidade.financeiroVer, privacidade.financeiroInformar)}
              opcoes={[
                { val: "nenhum", label: "Não vê" },
                { val: "ver", label: "Só vê" },
                { val: "agir", label: "Vê e informa" },
              ]}
              onChange={(n) =>
                setPrivacidade((p) => ({
                  ...p,
                  financeiroVer: n !== "nenhum",
                  financeiroInformar: n === "agir",
                }))
              }
            />
            <SegmentedChoice
              titulo="Contratos"
              valor={nivelDe(privacidade.contratosVer, privacidade.contratosCriar)}
              opcoes={[
                { val: "nenhum", label: "Não vê" },
                { val: "ver", label: "Só vê" },
                { val: "agir", label: "Vê e cria" },
              ]}
              onChange={(n) =>
                setPrivacidade((p) => ({
                  ...p,
                  contratosVer: n !== "nenhum",
                  contratosCriar: n === "agir",
                }))
              }
            />
            <SegmentedChoice
              titulo="Contatos"
              valor={privacidade.contatos}
              opcoes={[
                { val: "proprios", label: "Só dos shows dele" },
                { val: "todos", label: "Toda a agência" },
              ]}
              onChange={(c) => setPrivacidade((p) => ({ ...p, contatos: c }))}
            />

            {/* Agenda — trava de sistema */}
            <div className="p-2.5 rounded-md border border-border bg-elevated opacity-60 flex items-center gap-2">
              <Lock size={13} className="text-muted flex-shrink-0" />
              <span className="text-sm text-secondary">
                Agenda — ele sempre vê só a própria (trava do sistema).
              </span>
            </div>
          </div>
        </div>

        {/* Rider de camarim */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Rider de camarim ({riderCamarim.length}/{LIMITE_RIDER_CAMARIM})
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
            Rider de efeitos ({riderEfeitos.length}/{LIMITE_RIDER_EFEITOS})
          </div>
          <ListaRider
            itens={riderEfeitos}
            onChange={setRiderEfeitos}
            catalogoSugestoes={CATALOGO_EFEITOS}
            placeholderItem="Ex: CO²"
            limite={LIMITE_RIDER_EFEITOS}
          />
        </div>

        {/* Taxa de agência */}
        <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted inline-flex items-center gap-1.5">
            {taxaModo.startsWith("perc") ? (
              <Percent size={12} style={{ color: "var(--module-agencia)" }} />
            ) : (
              <DollarSign size={12} style={{ color: "var(--module-agencia)" }} />
            )}
            Taxa de agência
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
                  <span className="text-sm flex-1">{LABELS_TAXA_MODO[m]}</span>
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
    </>
  );

  if (modoInline) return boxInline;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onCancelar}
    >
      {box}
    </div>
  );
}

/** Toggle on/off de uma permissão (estilo switch), na cor da Agência. */
function TogglePriv({
  label,
  sub,
  valor,
  onChange,
  disabled,
}: {
  label: string;
  sub: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary">{label}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!valor)}
        className="relative h-6 w-11 rounded-full transition-colors flex-shrink-0 disabled:cursor-not-allowed"
        style={{
          backgroundColor: valor ? "var(--module-agencia)" : "var(--border-strong)",
        }}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: valor ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
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
                      borderColor: "var(--module-agencia)",
                      backgroundColor: "rgba(99,102,241,0.14)",
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
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="bg-surface border border-border rounded w-full max-w-[420px]"
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
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
            {mostraUsuario ? "Artista cadastrado" : "Senha redefinida"}
          </div>
          <div className="text-xs text-secondary mt-1">
            {mostraUsuario
              ? `Copie e mande pro ${nomeArtista}. Aparece só uma vez.`
              : `Nova senha do ${nomeArtista}. Copie agora — aparece só uma vez.`}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {mostraUsuario && (
            <div>
              <div className="text-xs font-medium text-secondary mb-1">Login</div>
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
            <div className="text-xs font-medium text-secondary mb-1">Senha</div>
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
            <strong>Importante:</strong> essas credenciais não ficam salvas.
            Se fechar essa janela, vai precisar gerar nova senha.
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
                Copiado!
              </>
            ) : (
              <>
                <Copy size={14} />
                {mostraUsuario ? "Copiar login + senha" : "Copiar senha"}
              </>
            )}
          </button>
          <button onClick={onFechar} className="btn btn-primary text-sm">
            Entendi, fechar
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
function SeletorDeCor({
  cor,
  onChange,
}: {
  cor: string;
  onChange: (cor: string) => void;
}) {
  // A cor atual está nas predefinidas? Se não, é "personalizada".
  const ePersonalizada = !CORES.includes(cor);
  const [pickerAberto, setPickerAberto] = useState(false);
  // Ref do botão "+" — o popover usa pra calcular a altura vertical
  const botaoPickerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-secondary">
        Cor de identificação
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
                backgroundColor: c,
                boxShadow: sel
                  ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${c}`
                  : "0 1px 2px rgba(0,0,0,0.3)",
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
          aria-label="Escolher cor personalizada"
          title="Cor personalizada"
          className="relative h-8 w-8 rounded-full transition-all hover:scale-110 flex items-center justify-center overflow-hidden"
          style={{
            // Quando personalizada está ativa: mostra a cor escolhida
            // Quando inativa: mostra um gradient arco-íris como "hint" de paleta
            background: ePersonalizada
              ? cor
              : "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #14b8a6, #3b82f6, #a855f7, #ec4899, #ef4444)",
            boxShadow: ePersonalizada
              ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${cor}`
              : "0 1px 2px rgba(0,0,0,0.3)",
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
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}
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
          ? "Cor personalizada — clique pra trocar"
          : "Clique no + pra escolher uma cor personalizada"}
      </p>
    </div>
  );
}

// ============================================================
// Helpers de UI
// ============================================================

function Secao({
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

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-secondary">{label}</span>
      {children}
    </label>
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
        Liste apenas os itens. A <strong>quantidade</strong> é definida em
        cada orçamento (varia por evento).
      </p>

      {/* Itens já adicionados */}
      {itens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {itens.map((nome, idx) => (
            <span
              key={nome}
              className="inline-flex items-center gap-1.5 bg-elevated border border-border rounded-md pl-3 pr-1.5 py-1 text-sm text-primary"
            >
              {nome}
              <button
                type="button"
                onClick={() => remover(idx)}
                className="hover:text-danger transition-colors"
                aria-label="Remover item"
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
          placeholder={cheio ? `Limite de ${limite} atingido` : placeholderItem}
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
            Sugestões:
          </span>
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => adicionar(s)}
              className="text-[0.7rem] px-2 py-0.5 rounded-full border border-border bg-elevated hover:border-border-strong text-secondary hover:text-primary transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
