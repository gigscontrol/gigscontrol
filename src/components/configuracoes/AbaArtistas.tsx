"use client";

import { useEffect, useMemo, useState } from "react";
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
  CheckCircle2,
  KeyRound,
  MapPin,
  Percent,
  DollarSign,
} from "lucide-react";
import Toast from "../Toast";
import CidadeIBGEAutocomplete, {
  type CidadeIBGE,
} from "../CidadeIBGEAutocomplete";
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
  type ItemRider,
  type TaxaAgenciaModo,
} from "@/types";

/**
 * Aba "Artistas" das Configurações.
 *
 * Versão expandida (etapa 21+): o cadastro de artista agora é um modal
 * com 5 seções — dados, acesso (login+senha gerada), cidade IBGE, taxa
 * de agência (5 modos), rider de camarim e rider de efeitos.
 */

const CORES = [
  "#ef4444", "#f59e0b", "#22c55e", "#3b82f6",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
];

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
    lixeiraArtistas,
    recarregarLixeira,
    restaurarDaLixeira,
  } = useWorkspace();
  const { sessao } = useAuth();

  const plano = sessao?.workspace ? getPlano(sessao.workspace.plano) : null;
  const slugAgencia = sessao?.workspace?.slug ?? "";
  const limite = plano?.maxArtistas ?? 0;
  const usados = artistas.length;
  const noLimite = usados >= limite;

  const [criando, setCriando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [resetando, setResetando] = useState<string | null>(null);
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{
    nomeArtista: string;
    username: string;
    senha: string;
  } | null>(null);

  const [acaoLixeira, setAcaoLixeira] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);

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

  async function aoResetar(id: string, nomeArt: string) {
    if (!confirm(`Gerar uma nova senha aleatória pro artista ${nomeArt}?`)) return;
    setResetando(id);
    try {
      const novaSenha = await resetarSenhaArtista(id);
      // Reusa o modal de credenciais — só com a senha, sem username
      setCredenciaisGeradas({
        nomeArtista: nomeArt,
        username: "—",
        senha: novaSenha,
      });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setResetando(null);
    }
  }

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
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ opacity: suspenso ? 0.55 : 1 }}
                >
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
                        onClick={() => aoResetar(a.id, a.name)}
                        disabled={resetando === a.id}
                        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1 disabled:opacity-50"
                        style={{ color: "var(--module-vendas)" }}
                        title="Gerar nova senha"
                      >
                        <KeyRound size={13} />
                        {resetando === a.id ? "..." : "Senha"}
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
        <strong className="text-primary">Suspender acesso</strong> deixa o
        artista visível porém em cinza e sem poder criar/editar nada.{" "}
        <strong className="text-primary">Senha</strong> gera uma nova senha
        aleatória pro artista (substitui a anterior).{" "}
        <strong className="text-primary">Remover</strong> manda pra Lixeira
        (recuperável por 30 dias).
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

function ModalNovoArtista({
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

  // Seção 4 e 5 — rider
  const [riderCamarim, setRiderCamarim] = useState<ItemRider[]>([]);
  const [riderEfeitos, setRiderEfeitos] = useState<ItemRider[]>([]);

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

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-secondary">
                Cor de identificação
              </span>
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className="h-7 w-7 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      outline:
                        cor === c ? "2px solid var(--text-primary)" : "none",
                      outlineOffset: 2,
                      transform: cor === c ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            <Campo label="Cidade onde reside (opcional)">
              <CidadeIBGEAutocomplete
                value={cidade}
                onChange={setCidade}
                placeholder="Buscar no catálogo do IBGE..."
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
              className="text-xs rounded-md px-3 py-2"
              style={{
                backgroundColor: "rgba(168,85,247,0.08)",
                color: "var(--text-secondary)",
              }}
            >
              <strong>Senha:</strong> será gerada automaticamente (algo
              tipo <span className="font-mono">Lyra-Bravo-7421</span>) e
              mostrada uma única vez ao final pra você copiar e mandar pro
              artista. Depois, ele pode trocar quando quiser.
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
          <Secao titulo="Rider de camarim">
            <ListaRider
              itens={riderCamarim}
              onChange={setRiderCamarim}
              catalogoSugestoes={CATALOGO_CAMARIM}
              placeholderItem="Ex: Jack Daniels"
            />
          </Secao>

          {/* Seção 5 — Rider de efeitos */}
          <Secao titulo="Rider de efeitos">
            <ListaRider
              itens={riderEfeitos}
              onChange={setRiderEfeitos}
              catalogoSugestoes={CATALOGO_EFEITOS}
              placeholderItem="Ex: CO²"
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
// Modal — Credenciais geradas (mostradas uma única vez)
// ============================================================

function ModalCredenciais({
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
}: {
  itens: ItemRider[];
  onChange: (itens: ItemRider[]) => void;
  catalogoSugestoes: readonly string[];
  placeholderItem: string;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [novaQtd, setNovaQtd] = useState(1);

  function adicionar(nome: string, qtd: number) {
    const n = nome.trim();
    if (!n) return;
    // Evita duplicado por nome
    if (itens.some((i) => i.nome.toLowerCase() === n.toLowerCase())) return;
    onChange([...itens, { nome: n, qtdSugerida: qtd }]);
    setNovoNome("");
    setNovaQtd(1);
  }

  function remover(idx: number) {
    onChange(itens.filter((_, i) => i !== idx));
  }

  function atualizarQtd(idx: number, qtd: number) {
    onChange(
      itens.map((it, i) => (i === idx ? { ...it, qtdSugerida: qtd } : it))
    );
  }

  // Sugestões do catálogo global que ainda não estão na lista
  const sugestoes = catalogoSugestoes.filter(
    (s) => !itens.some((i) => i.nome.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Itens já adicionados */}
      {itens.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {itens.map((item, idx) => (
            <div
              key={item.nome}
              className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-1.5"
            >
              <span className="flex-1 text-sm text-primary truncate">
                {item.nome}
              </span>
              <input
                type="number"
                min={1}
                max={99}
                value={item.qtdSugerida}
                onChange={(e) =>
                  atualizarQtd(idx, Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-14 bg-main border border-border rounded px-2 py-0.5 text-xs text-right outline-none focus:border-border-strong"
              />
              <button
                type="button"
                onClick={() => remover(idx)}
                className="btn-ghost p-1 rounded text-danger"
                aria-label="Remover item"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar novo */}
      <div className="flex items-center gap-2">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder={placeholderItem}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar(novoNome, novaQtd);
            }
          }}
          className="campo-input flex-1 text-sm"
        />
        <input
          type="number"
          min={1}
          max={99}
          value={novaQtd}
          onChange={(e) =>
            setNovaQtd(Math.max(1, parseInt(e.target.value) || 1))
          }
          className="w-14 bg-elevated border border-border rounded-md px-2 py-2 text-xs text-right outline-none focus:border-border-strong"
        />
        <button
          type="button"
          onClick={() => adicionar(novoNome, novaQtd)}
          disabled={!novoNome.trim()}
          className="btn-ghost p-2 rounded disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Chips de sugestões */}
      {sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="text-[0.65rem] text-muted self-center">
            Sugestões:
          </span>
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => adicionar(s, 1)}
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
