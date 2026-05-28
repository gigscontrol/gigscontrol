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
} from "lucide-react";
import Toast from "../Toast";
import CidadeIBGEAutocomplete, {
  type CidadeIBGE,
} from "../CidadeIBGEAutocomplete";
import ColorPicker from "../ColorPicker";
import {
  useWorkspace,
  type NovoArtistaInput,
} from "@/lib/workspace-context";
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

  // Reset de senha agora vive só dentro do modal "Editar artista" —
  // o botão antigo direto na linha foi removido (a função existe no
  // workspace-context e é chamada pelo onResetarSenha do ModalEditar).

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Resumo do limite */}
      <div className="card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="section-title">Artistas da agência</div>
            <div className="section-subtitle">
              {plano
                ? `Seu plano ${plano.nome} permite até ${limite} ${
                    limite === 1 ? "artista" : "artistas"
                  }.`
                : "Cadastre os artistas da sua agência."}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">
              {usados}
              <span className="text-muted text-base font-normal"> / {limite}</span>
            </div>
            <div className="text-xs text-muted">em uso</div>
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
            Você atingiu o limite de artistas do plano {plano?.nome}. Para
            adicionar mais, faça upgrade do plano ou remova um artista.
          </span>
        </div>
      )}

      {/* Lista de artistas */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="section-title">Lista de artistas</div>
          <button
            onClick={() => setCriando(true)}
            disabled={noLimite}
            className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Adicionar artista
          </button>
        </div>

        {artistas.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            Nenhum artista cadastrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {artistas.map((a) => {
              const suspenso = !!a.acessoSuspenso;
              const sendoArrastado = arrastandoId === a.id;
              const ehAlvo = sobreId === a.id && arrastandoId && arrastandoId !== a.id;
              return (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => {
                    setArrastandoId(a.id);
                    e.dataTransfer.effectAllowed = "move";
                    // Necessário no Firefox pro drag começar
                    e.dataTransfer.setData("text/plain", a.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (sobreId !== a.id) setSobreId(a.id);
                  }}
                  onDragLeave={() => {
                    if (sobreId === a.id) setSobreId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    aoSoltar(a.id);
                  }}
                  onDragEnd={() => {
                    setArrastandoId(null);
                    setSobreId(null);
                  }}
                  className="flex items-center gap-3 px-4 py-3 transition-all"
                  style={{
                    opacity: sendoArrastado ? 0.4 : suspenso ? 0.55 : 1,
                    borderTop: ehAlvo ? "2px solid var(--module-vendas)" : undefined,
                    cursor: "grab",
                  }}
                >
                  <GripVertical
                    size={14}
                    className="text-muted flex-shrink-0"
                    style={{ cursor: "grab" }}
                  />
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{
                      background: suspenso
                        ? "var(--border-strong)"
                        : `linear-gradient(135deg, ${a.color}, ${a.color}99)`,
                    }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {a.name}
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2 flex-wrap mt-0.5">
                      {a.username && (
                        <button
                          type="button"
                          onClick={() => copiarUsername(a.username!)}
                          className="inline-flex items-center gap-1 hover:text-primary transition-colors group"
                          title="Clique pra copiar o login"
                        >
                          <AtSign size={10} />
                          <span className="font-mono">{a.username}</span>
                          {usernameCopiado === a.username ? (
                            <CheckCircle2
                              size={10}
                              style={{ color: "var(--success)" }}
                            />
                          ) : (
                            <Copy
                              size={10}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          )}
                        </button>
                      )}
                      {a.cidadeNome && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={10} />
                          {a.cidadeNome}
                          {a.cidadeUf ? `/${a.cidadeUf}` : ""}
                        </span>
                      )}
                      {a.taxaModo && a.taxaModo !== "sem-taxa" && (
                        <span className="inline-flex items-center gap-1">
                          {a.taxaModo.startsWith("perc") ? (
                            <Percent size={10} />
                          ) : (
                            <DollarSign size={10} />
                          )}
                          {LABELS_TAXA_MODO[a.taxaModo]}
                          {a.taxaValor !== undefined &&
                            (a.taxaModo === "perc-fixa"
                              ? ` ${a.taxaValor}%`
                              : a.taxaModo === "valor-fixo"
                              ? ` R$ ${a.taxaValor.toFixed(2)}`
                              : "")}
                        </span>
                      )}
                      {suspenso && (
                        <span
                          className="font-medium"
                          style={{ color: "var(--warning)" }}
                        >
                          Acesso suspenso
                        </span>
                      )}
                    </div>
                  </div>

                  {removendo === a.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted">Remover?</span>
                      <button
                        onClick={() => {
                          removerArtista(a.id);
                          setRemovendo(null);
                        }}
                        className="btn text-xs px-2 py-1"
                        style={{ backgroundColor: "var(--danger)", color: "#fff" }}
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setRemovendo(null)}
                        className="btn-ghost text-xs px-2 py-1"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setEditando({
                            id: a.id,
                            nome: a.name,
                            cor: a.color,
                            usernameAtual: a.username ?? "",
                            cidadeIbgeId: a.cidadeIbgeId,
                            cidadeNome: a.cidadeNome,
                            cidadeUf: a.cidadeUf,
                            taxaModo: a.taxaModo ?? "sem-taxa",
                            taxaValor: a.taxaValor,
                            riderCamarim: a.riderCamarim ?? [],
                            riderEfeitos: a.riderEfeitos ?? [],
                          })
                        }
                        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1"
                        title="Editar artista"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        onClick={() => alternarSuspensaoArtista(a.id)}
                        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1"
                        style={{
                          color: suspenso ? "var(--success)" : "var(--warning)",
                        }}
                      >
                        {suspenso ? (
                          <>
                            <PlayCircle size={14} />
                            Reativar
                          </>
                        ) : (
                          <>
                            <PauseCircle size={14} />
                            Suspender
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setRemovendo(a.id)}
                        className="btn-ghost p-1.5 rounded"
                        style={{ color: "var(--danger)" }}
                        aria-label="Remover artista"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
        <strong className="text-primary">Ordem:</strong> arraste pelo{" "}
        <span className="inline-flex items-center gap-0.5 font-mono">
          <GripVertical size={11} />
        </span>{" "}
        à esquerda pra reordenar — a ordem reflete na sidebar de DJs e em
        todos os filtros do app.
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
        />
      )}

      {/* Modal de edição */}
      {editando && (
        <ModalEditarArtista
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
        />
      )}

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
  nomesExistentes: string[];
};

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

  const usernameCompleto = useMemo(() => {
    if (!usernameRaiz.trim()) return "";
    return `${usernameRaiz.trim().toLowerCase()}-${slugAgencia}`;
  }, [usernameRaiz, slugAgencia]);

  const usernameValido = useMemo(() => {
    const v = usernameRaiz.trim();
    if (v.length < 3) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v);
  }, [usernameRaiz]);

  // Validação por seção (pra habilitar/desabilitar submit)
  function validarTudo(): string | null {
    const n = nome.trim();
    if (!n) return "Informe o nome do artista.";
    if (nomesExistentes.includes(n.toLowerCase()))
      return "Já existe um artista com esse nome.";
    if (!usernameValido) return "Username inválido (3+ chars, letras/números/hífen).";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onCancelar}
    >
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-[560px] max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Music size={16} style={{ color: "var(--module-vendas)" }} />
            <div className="section-title">Novo artista</div>
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
              <div className="flex items-center gap-1 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
                <input
                  value={usernameRaiz}
                  onChange={(e) => {
                    setUsernameFoiEditado(true);
                    setUsernameRaiz(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    );
                  }}
                  placeholder="ex: djlunar"
                  className="bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0 flex-1"
                />
                <span className="text-xs text-muted whitespace-nowrap">
                  -{slugAgencia || "agencia"}
                </span>
              </div>
              {usernameCompleto && (
                <p className="text-xs mt-1" style={{ color: usernameValido ? "var(--success)" : "var(--danger)" }}>
                  {usernameValido
                    ? `Login completo: `
                    : "Use 3+ chars (letras, números, hífen)"}
                  {usernameValido && (
                    <strong className="font-mono text-primary">
                      {usernameCompleto}
                    </strong>
                  )}
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

        <div className="flex justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-surface">
          <button onClick={onCancelar} className="btn btn-secondary text-sm">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={enviando}
            className="btn btn-primary text-sm disabled:opacity-60"
          >
            <Plus size={14} />
            {enviando
              ? "Cadastrando..."
              : `Cadastrar em ${nomeAgencia || "agência"}`}
          </button>
        </div>
      </div>
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
};

type DadosConta = {
  email: string;
  emailVerificado: boolean;
  emailFakeInterno: boolean;
};

function ModalEditarArtista({
  artista,
  slugAgencia,
  onCancelar,
  onSalvo,
  onResetarSenha,
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
  const [taxaModo, setTaxaModo] = useState<TaxaAgenciaModo>(artista.taxaModo);
  const [taxaValor, setTaxaValor] = useState<string>(
    artista.taxaValor !== undefined ? String(artista.taxaValor) : ""
  );
  const [riderCamarim, setRiderCamarim] = useState<string[]>(artista.riderCamarim);
  const [riderEfeitos, setRiderEfeitos] = useState<string[]>(artista.riderEfeitos);

  // Dados da conta (email + verificado) — async ao abrir
  const [conta, setConta] = useState<DadosConta | null>(null);
  const [carregandoConta, setCarregandoConta] = useState(true);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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

  const usernameMudou = usernameRaiz.trim() !== usernameRaizInicial;
  const emailMudou =
    !!conta &&
    !conta.emailFakeInterno &&
    emailEditavel.trim().toLowerCase() !== conta.email.toLowerCase();

  function validar(): string | null {
    const n = nome.trim();
    if (!n) return "Informe o nome do artista.";
    if (!cidade) return "Informe a cidade onde o artista reside.";
    if (!usernameValido)
      return "Username inválido (3+ chars, letras/números/hífen).";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onCancelar}
    >
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-[560px] max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Pencil size={16} style={{ color: "var(--module-vendas)" }} />
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
              <div className="flex items-center gap-1 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
                <input
                  value={usernameRaiz}
                  onChange={(e) =>
                    setUsernameRaiz(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  className="bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0 flex-1"
                />
                <span className="text-xs text-muted whitespace-nowrap">
                  -{slugAgencia}
                </span>
              </div>
              {!usernameValido && usernameRaiz.length > 0 && (
                <p className="text-[0.7rem] mt-1" style={{ color: "var(--danger)" }}>
                  Use 3+ chars (letras, números, hífen).
                </p>
              )}
              {usernameMudou && usernameValido && (
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
                  <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong">
                    <Mail size={14} className="text-muted flex-shrink-0" />
                    <input
                      type="email"
                      value={emailEditavel}
                      onChange={(e) => setEmailEditavel(e.target.value)}
                      placeholder={
                        conta.emailFakeInterno
                          ? "Defina um e-mail real (opcional)"
                          : conta.email
                      }
                      className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0"
                    />
                  </div>
                  {/* Status do email */}
                  <div className="mt-1.5 text-[0.7rem] flex items-center gap-1">
                    {conta.emailFakeInterno ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: "var(--warning)" }}
                      >
                        <AlertTriangle size={11} />
                        Ainda usando e-mail interno (
                        <span className="font-mono">{conta.email}</span>) — o
                        artista ainda não trocou.
                      </span>
                    ) : conta.emailVerificado ? (
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
                  </div>
                  {emailMudou && (
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
                        Você está trocando o e-mail. O artista vai usar este
                        novo endereço pra recuperar senha.
                      </span>
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
            disabled={enviando}
            className="btn btn-primary text-sm disabled:opacity-60"
          >
            <Check size={14} />
            {enviando ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
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
  const [copiou, setCopiou] = useState<"user" | "pass" | null>(null);
  const mostraUsuario = username !== "—";

  function copiar(texto: string, qual: "user" | "pass") {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiou(qual);
      setTimeout(() => setCopiou(null), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-[420px]"
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

        <div className="p-4 border-t border-border flex justify-end">
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
