"use client";

import { useEffect, useState } from "react";
import { Music, Plus, Trash2, X, AlertCircle, PauseCircle, PlayCircle, RotateCcw } from "lucide-react";
import Toast from "../Toast";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { getPlano } from "@/lib/planos";

/**
 * Aba "Artistas" das Configurações.
 * O admin cadastra e remove artistas (DJs/cantores/MCs). O total é
 * limitado pelo plano do workspace (campo maxArtistas).
 */

// Paleta sugerida para a cor do artista (usada em badges e bordas)
const CORES = [
  "#ef4444", "#f59e0b", "#22c55e", "#3b82f6",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316",
];

export default function AbaArtistas() {
  const {
    artistas,
    adicionarArtista,
    removerArtista,
    alternarSuspensaoArtista,
    lixeiraArtistas,
    recarregarLixeira,
    restaurarDaLixeira,
  } = useWorkspace();
  const { sessao } = useAuth();

  const plano = sessao?.workspace
    ? getPlano(sessao.workspace.plano)
    : null;
  const limite = plano?.maxArtistas ?? 0;
  const usados = artistas.length;
  const noLimite = usados >= limite;

  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  // Mini-lixeira: só restauração — remoção definitiva é automática
  // após 30 dias pelo pg_cron.
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

  function abrirCriar() {
    setNome("");
    setCor(CORES[usados % CORES.length]);
    setErro(null);
    setCriando(true);
  }

  async function salvar() {
    const limpo = nome.trim();
    if (!limpo) {
      setErro("Informe o nome do artista.");
      return;
    }
    if (artistas.some((a) => a.name.toLowerCase() === limpo.toLowerCase())) {
      setErro("Já existe um artista com esse nome.");
      return;
    }
    try {
      await adicionarArtista(limpo, cor);
      setCriando(false);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
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
              <span className="text-muted text-base font-normal">
                {" "}/ {limite}
              </span>
            </div>
            <div className="text-xs text-muted">em uso</div>
          </div>
        </div>

        {/* Barra de uso */}
        <div className="mt-3 h-1.5 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${limite > 0 ? Math.min(100, (usados / limite) * 100) : 0}%`,
              backgroundColor: noLimite
                ? "var(--danger)"
                : "var(--module-vendas)",
            }}
          />
        </div>
      </div>

      {/* Aviso de limite atingido */}
      {noLimite && (
        <div
          className="flex items-start gap-2 text-sm rounded-md px-3 py-2.5"
          style={{
            backgroundColor: "rgba(245,158,11,0.1)",
            color: "var(--warning)",
          }}
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
            onClick={abrirCriar}
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
                    {suspenso ? (
                      <div
                        className="text-xs font-medium"
                        style={{ color: "var(--warning)" }}
                      >
                        Acesso suspenso
                      </div>
                    ) : (
                      <div className="text-xs text-muted">Artista</div>
                    )}
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
                        style={{
                          backgroundColor: "var(--danger)",
                          color: "#fff",
                        }}
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
                      {/* Suspender / reativar acesso */}
                      <button
                        onClick={() => alternarSuspensaoArtista(a.id)}
                        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1"
                        style={{
                          color: suspenso
                            ? "var(--success)"
                            : "var(--warning)",
                        }}
                        title={
                          suspenso
                            ? "Reativar acesso do artista"
                            : "Suspender acesso do artista"
                        }
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
                      {/* Remover */}
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

      {/* Mini-lixeira: aparece só quando há artistas removidos. A aba
          completa fica em Configurações → Lixeira (admin). */}
      {lixeiraArtistas.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Trash2 size={14} style={{ color: "var(--module-financeiro)" }} />
              <div className="section-title">
                Na lixeira ({lixeiraArtistas.length})
              </div>
            </div>
            <span className="text-xs text-muted">
              Recuperáveis por 30 dias
            </span>
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
        artista visível na dashboard, porém em cinza e sem poder criar ou
        editar nada — útil para afastamentos temporários. Você e a equipe
        continuam com acesso normal. É reversível a qualquer momento.{" "}
        <strong className="text-primary">Remover</strong> manda o artista
        pra Lixeira; ele pode ser restaurado em até 30 dias e depois é
        apagado automaticamente.
      </div>

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />

      <p className="text-xs text-muted">
        As alterações valem durante esta sessão. A persistência será ativada
        quando o backend for conectado.
      </p>

      {/* Modal de criação */}
      {criando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={() => setCriando(false)}
        >
          <div
            className="bg-surface border border-border rounded-lg w-full max-w-[400px]"
            style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Music size={16} style={{ color: "var(--module-vendas)" }} />
                <div className="section-title">Novo artista</div>
              </div>
              <button
                onClick={() => setCriando(false)}
                className="btn-ghost p-1.5 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-secondary">
                  Nome do artista
                </span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: DJ Lunar"
                  className="campo-input"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && salvar()}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-secondary">
                  Cor de identificação
                </span>
                <div className="flex flex-wrap gap-2">
                  {CORES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCor(c)}
                      className="h-8 w-8 rounded-full transition-transform"
                      style={{
                        backgroundColor: c,
                        outline:
                          cor === c ? "2px solid var(--text-primary)" : "none",
                        outlineOffset: 2,
                        transform: cor === c ? "scale(1.1)" : "scale(1)",
                      }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </div>

              {erro && (
                <div className="text-xs" style={{ color: "var(--danger)" }}>
                  {erro}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => setCriando(false)}
                className="btn btn-secondary text-sm"
              >
                Cancelar
              </button>
              <button onClick={salvar} className="btn btn-primary text-sm">
                <Plus size={14} />
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
