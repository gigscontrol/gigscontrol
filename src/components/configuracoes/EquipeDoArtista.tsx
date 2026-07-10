"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { MODULOS } from "@/lib/permissoes/catalogo";
import {
  capacidadesDoModulo,
  capacidadeAtiva,
  varianteAtiva,
  toggleCapacidade,
  selecionarVariante,
  normalizarPerms,
} from "@/lib/permissoes/capacidades";
import { PERFIS, permissoesDosPerfis, type PerfilId } from "@/lib/permissoes/perfis";

type Membro = {
  userId: string;
  nome: string;
  papel: string;
  perfis: string[];
  permissoes: string[];
};

type UsuarioDisp = { id: string; nome: string; papel: string };

type EditorState = {
  userId: string;
  perfis: PerfilId[];
  perms: Set<string>;
  novo: boolean;
  nome: string;
};

/**
 * EDITOR DE PERMISSÕES POR VÍNCULO (usuário × artista) — reutilizável.
 *
 * Renderiza o modal "Permissões — {nome}" (subtítulo "No artista {artista}")
 * com os presets de perfil e os checkboxes por módulo. Usado tanto pela aba
 * Equipe do artista (EquipeDoArtista) quanto pelo modal "Criar usuário" da
 * Equipe (permissões definidas já na criação).
 *
 * O estado (perfis + perms) é interno; ao salvar, devolve o array plano e
 * normalizado de chaves via `onSalvar`. O catálogo é dinâmico: nada aqui
 * depende de chaves específicas, então novas permissões aparecem sozinhas.
 */
export function EditorPermissoesVinculo({
  nomeUsuario,
  nomeArtista,
  permissoes,
  perfisIniciais,
  onSalvar,
  onFechar,
  titulo,
  slotTopo,
  podeSalvar = true,
  rotuloSalvar,
}: {
  nomeUsuario: string;
  nomeArtista: string;
  permissoes: string[];
  /** Perfis (presets) iniciais — semeiam os botões de perfil. */
  perfisIniciais?: PerfilId[];
  onSalvar: (permissoes: string[], perfis: PerfilId[]) => void | Promise<void>;
  onFechar: () => void;
  /** Sobrescreve o título (default: "Permissões — {nomeUsuario}"). */
  titulo?: string;
  /** Conteúdo extra no topo (ex.: seletor de usuário ao adicionar membro). */
  slotTopo?: ReactNode;
  /** Desabilita o botão salvar (ex.: nenhum usuário escolhido ainda). */
  podeSalvar?: boolean;
  /** Rótulo do botão salvar (default: "Salvar permissões"). */
  rotuloSalvar?: string;
}) {
  const [perfis, setPerfis] = useState<PerfilId[]>(perfisIniciais ?? []);
  const [perms, setPerms] = useState<Set<string>>(() => normalizarPerms(new Set(permissoes)));
  const [salvando, setSalvando] = useState(false);

  // Selecionar/desmarcar perfil RE-SEMEIA os checkboxes com a união dos perfis.
  function togglePerfil(id: PerfilId) {
    setPerfis((atual) => {
      const proximo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
      setPerms(normalizarPerms(new Set(permissoesDosPerfis(proximo))));
      return proximo;
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar([...normalizarPerms(perms)], perfis);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onFechar}
      title={titulo ?? `Permissões — ${nomeUsuario}`}
      subtitle={`No artista ${nomeArtista}`}
      maxWidth={640}
    >
      <div className="flex flex-col gap-5">
        {slotTopo}

        {/* Perfis (presets) */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-secondary">Perfil (marca as permissões-base — depois personalize)</span>
          <div className="flex flex-wrap gap-2">
            {PERFIS.filter((p) => p.id !== "artista").map((p) => {
              const on = perfis.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePerfil(p.id)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md border transition-colors"
                  style={{
                    borderColor: on ? p.cor : "var(--border-strong)",
                    backgroundColor: on ? `${p.cor}22` : "transparent",
                    color: on ? p.cor : "var(--text-secondary)",
                  }}
                  title={p.descricao}
                >
                  {p.nome}
                </button>
              );
            })}
          </div>
        </div>

        {/* Checkboxes por módulo */}
        <div className="flex flex-col gap-3">
          {MODULOS.filter((mod) => capacidadesDoModulo(mod.id).length > 0).map((mod) => (
            <div key={mod.id} className="bg-surface-2 border border-border rounded-md p-3">
              <div className="stat-label mb-2">{mod.label}</div>
              <div className="flex flex-col gap-1.5">
                {capacidadesDoModulo(mod.id).map((cap) => {
                  const ativa = capacidadeAtiva(perms, cap);
                  const varSel = varianteAtiva(perms, cap);
                  return (
                    <div key={cap.id}>
                      <button
                        type="button"
                        onClick={() => setPerms((p) => toggleCapacidade(p, cap))}
                        className="flex items-center gap-2 text-left text-xs py-1 w-full rounded hover:bg-elevated transition-colors"
                      >
                        <span
                          className="h-4 w-4 rounded-[3px] flex items-center justify-center flex-shrink-0 border"
                          style={{
                            backgroundColor: ativa ? "var(--brand)" : "transparent",
                            borderColor: ativa ? "var(--brand)" : "var(--border-strong)",
                          }}
                        >
                          {ativa && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </span>
                        <span className={cap.existe ? "text-secondary" : "text-muted"}>
                          {cap.label}
                          {!cap.existe && <span className="text-[0.6rem] text-disabled ml-1">(em breve)</span>}
                        </span>
                      </button>

                      {ativa && cap.variantes && (
                        <div
                          role="radiogroup"
                          aria-label={cap.label}
                          className="ml-6 mt-1.5 inline-flex gap-0.5 p-0.5 rounded-lg border"
                          style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                        >
                          {cap.variantes.map((v) => {
                            const sel = varSel === v.chave;
                            return (
                              <button
                                key={v.chave}
                                type="button"
                                role="radio"
                                aria-checked={sel}
                                onClick={() => setPerms((p) => selecionarVariante(p, cap, v.chave))}
                                className={`text-[0.7rem] font-medium px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                                  sel ? "" : "text-muted hover:text-secondary"
                                }`}
                                style={
                                  sel
                                    ? { backgroundColor: "var(--brand)", color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.35)" }
                                    : undefined
                                }
                              >
                                {v.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onFechar} className="btn btn-secondary text-sm" disabled={salvando}>
            Cancelar
          </button>
          <button onClick={salvar} className="btn btn-primary text-sm" disabled={salvando || !podeSalvar}>
            {salvando ? "Salvando…" : rotuloSalvar ?? "Salvar permissões"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Gestão da EQUIPE de UM artista (novo modelo de permissões por-vínculo).
 * As permissões definidas aqui valem SÓ para este artista.
 */
export default function EquipeDoArtista({
  artistaId,
  artistaNome,
}: {
  artistaId: string;
  artistaNome: string;
}) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioDisp[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [resEq, resUs] = await Promise.all([
        fetch(`/api/artistas/${artistaId}/equipe`, { credentials: "include" }),
        fetch(`/api/usuarios`, { credentials: "include" }),
      ]);
      const eq = await resEq.json();
      if (!resEq.ok) throw new Error(eq.erro ?? "Falha ao carregar a equipe.");
      const us = await resUs.json();
      setMembros((eq.membros as Membro[]) ?? []);
      setUsuarios(((us.usuarios as UsuarioDisp[]) ?? []).map((u) => ({ id: u.id, nome: u.nome, papel: u.papel })));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }, [artistaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirNovo() {
    setEditor({ userId: "", perfis: [], perms: new Set(), novo: true, nome: "" });
  }
  function abrirEdicao(m: Membro) {
    setEditor({
      userId: m.userId,
      perfis: m.perfis as PerfilId[],
      perms: new Set(m.permissoes),
      novo: false,
      nome: m.nome,
    });
  }

  async function salvar(permissoes: string[], perfis: PerfilId[]) {
    if (!editor || !editor.userId) {
      setErro("Selecione um usuário.");
      return;
    }
    setErro(null);
    try {
      const res = await fetch(`/api/artistas/${artistaId}/equipe/${editor.userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfis, permissoes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.erro ?? "Falha ao salvar.");
      setEditor(null);
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
      throw e;
    }
  }

  async function remover(userId: string) {
    try {
      const res = await fetch(`/api/artistas/${artistaId}/equipe/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.erro ?? "Falha ao remover.");
      }
      await carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  // Usuários que ainda não estão vinculados (para o "+")
  const disponiveis = usuarios.filter((u) => !membros.some((m) => m.userId === u.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="section-subtitle min-w-0">
          O que cada membro pode fazer com {artistaNome} — vale só para este artista.
        </div>
        <button onClick={abrirNovo} className="btn btn-primary text-sm flex-shrink-0">
          <Plus size={14} /> Adicionar membro
        </button>
      </div>

      {erro && <div className="text-xs text-danger">{erro}</div>}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted py-6 justify-center">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : membros.length === 0 ? (
        <div className="card text-center py-8 text-sm text-muted">
          Ninguém vinculado ainda. Clique em <strong>Adicionar membro</strong> para dar acesso a este artista.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {membros.map((m) => (
            <div key={m.userId} className="card flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-primary truncate">{m.nome}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.perfis.length > 0 ? (
                    m.perfis.map((p) => {
                      const perfil = PERFIS.find((x) => x.id === p);
                      return (
                        <span
                          key={p}
                          className="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${perfil?.cor ?? "#3D7BFF"}22`, color: perfil?.cor ?? "#3D7BFF" }}
                        >
                          {perfil?.nome ?? p}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[0.65rem] text-muted">Personalizado</span>
                  )}
                  <span className="mono-label text-[0.6rem]">{m.permissoes.length} permissões</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => abrirEdicao(m)} className="btn-ghost p-1.5 rounded" aria-label="Editar permissões">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => remover(m.userId)}
                  className="btn-ghost p-1.5 rounded"
                  style={{ color: "var(--danger)" }}
                  aria-label="Remover do artista"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editor && (
        <EditorPermissoesVinculo
          // key força re-montar (e re-semear o estado) ao trocar de membro.
          key={editor.novo ? "novo" : editor.userId}
          nomeUsuario={editor.nome}
          nomeArtista={artistaNome}
          permissoes={[...editor.perms]}
          perfisIniciais={editor.perfis}
          onSalvar={salvar}
          onFechar={() => setEditor(null)}
          titulo={editor.novo ? "Adicionar membro" : undefined}
          podeSalvar={!!editor.userId}
          slotTopo={
            editor.novo ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-secondary">Usuário</span>
                <select
                  className="campo-input"
                  value={editor.userId}
                  onChange={(e) =>
                    setEditor((s) =>
                      s ? { ...s, userId: e.target.value, nome: disponiveis.find((u) => u.id === e.target.value)?.nome ?? "" } : s
                    )
                  }
                >
                  <option value="">Selecione…</option>
                  {disponiveis.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
                {disponiveis.length === 0 && (
                  <span className="text-xs text-muted">Todos os membros da equipe já estão vinculados. Crie um novo usuário em Configurações → Equipe.</span>
                )}
              </label>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
