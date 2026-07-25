"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  DollarSign,
  Wallet,
  FileText,
  Users,
  Check,
  type LucideIcon,
} from "lucide-react";
import Modal from "@/components/Modal";
import {
  MODELOS_EQUIPE,
  derivarNivel,
  aplicarNivel,
  chavesDoModulo,
  chavesDoNivel,
  type ModuloModelo,
  type CapModelo,
  type NivelEquipe,
  type NivelNomeado,
} from "@/lib/permissoes/modelosEquipe";
import { expandirLegadoVinculo } from "@/lib/permissoes/legadoEquipe";
import { PERFIS, permissoesDosPerfis, type PerfilId } from "@/lib/permissoes/perfis";
import { useT } from "@/lib/i18n";

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

/** Ícone de cada módulo (espelha o protótipo). */
const ICONE_MODULO: Record<string, LucideIcon> = {
  agenda: Calendar,
  vendas: DollarSign,
  financeiro: Wallet,
  contratos: FileText,
  contatos: Users,
};

// ------------------------------------------------------------------
// Derivações puras que o editor consome (do MODELO da fundação).
// ------------------------------------------------------------------

/** Quantas CAPACIDADES (linhas/checkbox) deste módulo estão marcadas. */
function contarCaps(mod: ModuloModelo, perms: Set<string>): number {
  return mod.caps.filter((c) => perms.has(c.chave)).length;
}

/** Módulos que não têm liga/desliga próprio (agenda é sempre ativa). */
function modulosLigaveis(): ModuloModelo[] {
  return MODELOS_EQUIPE.filter((m) => !m.sempre);
}

/** Quais módulos ligáveis já têm ao menos uma chave no conjunto. */
function ligadosDoConjunto(perms: Set<string>): Set<string> {
  const s = new Set<string>();
  for (const mod of modulosLigaveis()) {
    if (chavesDoModulo(perms, mod).length > 0) s.add(mod.id);
  }
  return s;
}

const COR_NIVEL: Record<NivelEquipe, string> = {
  basico: "var(--brand)",
  inter: "var(--warning)",
  total: "var(--success)",
  pers: "var(--warning)",
};

/**
 * EDITOR DE PERMISSÕES POR VÍNCULO (usuário × artista) — reutilizável.
 *
 * Renderiza o modal "Permissões — {nome}" com os perfis prontos, os cards de
 * módulo (Agenda sempre ativa; os outros 4 com liga/desliga) e o resumo lateral
 * em PT. A mecânica espelha `public/permissoes-navegavel.html`:
 *
 *   - chips Básico/Intermediário/Acesso total/Personalizado DERIVADOS do
 *     conjunto marcado (via `derivarNivel`);
 *   - clicar num chip nomeado grava o conjunto exato daquele nível
 *     (`aplicarNivel`);
 *   - "Personalizado" clicável FIXA o modo (só abre a lista); mexer num check
 *     solta o modo e volta a derivar;
 *   - checkboxes SEMPRE visíveis enquanto o módulo está ligado;
 *   - desligar um módulo REMOVE as chaves dele do vínculo.
 *
 * O catálogo/escada vêm 100% do MODELO da fundação (`modelosEquipe.ts`): nada
 * de chave hard-coded aqui. Ao salvar, devolve o array plano de chaves e os
 * perfis via `onSalvar`.
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
  const t = useT();

  // Conjunto plano de chaves — a fonte da verdade do que será salvo. Expande o
  // legado na leitura (agenda por setor + os 4 módulos v2) pra o editor derivar
  // o nível certo mesmo de um vínculo antigo.
  const [perms, setPerms] = useState<Set<string>>(
    () => new Set(expandirLegadoVinculo(permissoes))
  );
  const [perfis, setPerfis] = useState<PerfilId[]>(perfisIniciais ?? []);

  // Liga/desliga dos 4 módulos ligáveis. Explícito (não só derivado do conjunto)
  // pra permitir um módulo LIGADO com 0 itens ("Personalizado 0/N"): desmarcar o
  // último box não fecha o card — igual ao protótipo.
  const [ligado, setLigado] = useState<Set<string>>(() => ligadosDoConjunto(perms));

  // Módulos FIXADOS em "Personalizado". "pers" não muda chave nenhuma (só abre a
  // lista), então derivá-lo do conjunto tinha beco sem saída: clicar Básico
  // grava o conjunto básico e clicar Personalizado depois não mexia em nada — o
  // conjunto seguia batendo "básico" e o chip nunca fixava. Guardar a escolha
  // resolve. Mexer num check limpa a fixação e volta a derivar.
  const [fixadoPers, setFixadoPers] = useState<Set<string>>(new Set());

  const [salvando, setSalvando] = useState(false);

  const nivelDe = (mod: ModuloModelo): NivelEquipe =>
    fixadoPers.has(mod.id) ? "pers" : derivarNivel(mod, perms);

  const moduloOn = (mod: ModuloModelo): boolean => !!mod.sempre || ligado.has(mod.id);

  // Selecionar/desmarcar perfil RE-SEMEIA todo o conjunto com a união dos perfis
  // (e recomputa ligado / limpa fixações).
  function togglePerfil(id: PerfilId) {
    setPerfis((atual) => {
      const proximo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
      const novas = new Set(permissoesDosPerfis(proximo));
      setPerms(novas);
      setLigado(ligadosDoConjunto(novas));
      setFixadoPers(new Set());
      return proximo;
    });
  }

  function toggleModulo(mod: ModuloModelo) {
    if (mod.sempre) return;
    if (ligado.has(mod.id)) {
      // Desligar: some do menu → tira TODAS as chaves do módulo do vínculo.
      setPerms((prev) => {
        const n = new Set(prev);
        for (const k of chavesDoModulo(prev, mod)) n.delete(k);
        return n;
      });
      setLigado((prev) => {
        const n = new Set(prev);
        n.delete(mod.id);
        return n;
      });
    } else {
      // Ligar: semeia o Básico (o piso do módulo).
      setPerms((prev) => aplicarNivel(mod, prev, "basico"));
      setLigado((prev) => new Set(prev).add(mod.id));
    }
    setFixadoPers((prev) => {
      const n = new Set(prev);
      n.delete(mod.id);
      return n;
    });
  }

  /** Clicar num chip nomeado (ou nos atalhos): grava o conjunto exato do nível. */
  function aplicarNivelNomeado(mod: ModuloModelo, k: NivelNomeado) {
    setPerms((prev) => aplicarNivel(mod, prev, k));
    setFixadoPers((prev) => {
      const n = new Set(prev);
      n.delete(mod.id);
      return n;
    });
  }

  /** Clicar em "Personalizado": só fixa o chip — o que marcar você escolhe abaixo. */
  function fixarPers(mod: ModuloModelo) {
    setFixadoPers((prev) => new Set(prev).add(mod.id));
  }

  /** Mexer num checkbox: alterna a chave e SOLTA a fixação (volta a derivar). */
  function toggleCap(mod: ModuloModelo, cap: CapModelo) {
    setPerms((prev) => {
      const n = new Set(prev);
      if (n.has(cap.chave)) n.delete(cap.chave);
      else n.add(cap.chave);
      // Chaves de AÇÃO que só existem no Acesso total (ex.: agenda.criar/
      // editar_todos/excluir_todos) não têm checkbox. Elas valem só quando TODOS
      // os caps do 'total' estão marcados; ao desmarcar um cap, saem — senão
      // ficariam órfãs no Personalizado concedendo um poder invisível.
      const total = mod.niveis.find((x) => x.k === "total");
      if (total) {
        const capChaves = new Set(mod.caps.map((c) => c.chave));
        const naoCaps = total.chaves.filter((k) => !capChaves.has(k));
        if (naoCaps.length) {
          const capsTotal = total.chaves.filter((k) => capChaves.has(k));
          const todosMarcados = capsTotal.every((k) => n.has(k));
          for (const k of naoCaps) {
            if (todosMarcados) n.add(k);
            else n.delete(k);
          }
        }
      }
      return n;
    });
    setFixadoPers((prev) => {
      const n = new Set(prev);
      n.delete(mod.id);
      return n;
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar([...perms], perfis);
    } finally {
      setSalvando(false);
    }
  }

  const chips: { k: NivelEquipe; rot: string }[] = [
    { k: "basico", rot: t("Básico") },
    { k: "inter", rot: t("Intermediário") },
    { k: "total", rot: t("Acesso total") },
    { k: "pers", rot: t("Personalizado") },
  ];

  return (
    <Modal
      isOpen
      onClose={onFechar}
      title={titulo ?? `${t("Permissões")} — ${nomeUsuario}`}
      subtitle={`${t("No artista")} ${nomeArtista}`}
      maxWidth={860}
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
        {/* Coluna principal: seletor de usuário (slot), perfis e cards */}
        <div className="flex flex-col gap-5 min-w-0">
          {slotTopo}

          {/* A escada de níveis — igual em todo módulo */}
          <div className="bg-surface-2 border border-border rounded-md p-3 text-xs text-secondary flex flex-wrap gap-x-4 gap-y-1.5 items-center">
            <span className="font-semibold text-primary">{t("A escada é a mesma em todo módulo:")}</span>
            <span>
              <b className="text-primary">1</b> {t("Básico")} — {t("faz o que é dele")}
            </span>
            <span>
              <b className="text-primary">2</b> {t("Intermediário")} — + {t("vê o dos outros")}
            </span>
            <span>
              <b className="text-primary">3</b> {t("Acesso total")} — + {t("administra tudo")}
            </span>
          </div>

          {/* Perfis prontos */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-secondary">
              {t("Perfil pronto — um clique configura este artista (depois personalize)")}
            </span>
            <div className="flex flex-wrap gap-2">
              {PERFIS.filter((p) => p.id !== "artista").map((p) => {
                const on = perfis.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerfil(p.id)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-md border transition-colors text-left"
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

          {/* Cards por módulo */}
          <div className="flex flex-col gap-3">
            {MODELOS_EQUIPE.map((mod) => {
              const on = moduloOn(mod);
              const nivel = nivelDe(mod);
              const marcadas = contarCaps(mod, perms);
              const total = mod.caps.length;
              const Icone = ICONE_MODULO[mod.id] ?? Users;
              const nivelDef = mod.niveis.find((n) => n.k === nivel);

              return (
                <div
                  key={mod.id}
                  className="bg-surface-2 border border-border rounded-md p-3"
                  style={{ opacity: on ? 1 : 0.72 }}
                >
                  {/* Cabeçalho: ícone, nome, hint e o switch (ou "sempre ativa") */}
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: on ? "var(--brand-weak, rgba(61,123,255,.14))" : "var(--surface)",
                        color: on ? "var(--brand)" : "var(--text-muted)",
                      }}
                    >
                      <Icone size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-primary">{mod.nome}</div>
                      <div className="text-[0.65rem] text-muted leading-tight">{mod.hint}</div>
                    </div>
                    {mod.sempre ? (
                      <span className="text-[0.6rem] text-muted flex-shrink-0">{t("sempre ativa")}</span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${t("Ativar")} ${mod.nome}`}
                        onClick={() => toggleModulo(mod)}
                        className="relative flex-shrink-0 w-10 h-[22px] rounded-full border transition-colors"
                        style={{
                          backgroundColor: on ? "var(--brand)" : "var(--elevated)",
                          borderColor: on ? "var(--brand)" : "var(--border-strong)",
                        }}
                      >
                        <span
                          className="absolute top-[2px] h-4 w-4 rounded-full transition-transform"
                          style={{
                            left: 2,
                            backgroundColor: on ? "#fff" : "var(--text-muted)",
                            transform: on ? "translateX(18px)" : "none",
                          }}
                        />
                      </button>
                    )}
                  </div>

                  {on && (
                    <div className="mt-3">
                      {/* Chips de nível (derivados) */}
                      <div
                        role="radiogroup"
                        aria-label={`${t("Nível de")} ${mod.nome}`}
                        className="inline-flex flex-wrap gap-0.5 p-0.5 rounded-lg border max-w-full"
                        style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                      >
                        {chips.map((c) => {
                          const sel = nivel === c.k;
                          return (
                            <button
                              key={c.k}
                              type="button"
                              role="radio"
                              aria-checked={sel}
                              onClick={() =>
                                c.k === "pers"
                                  ? fixarPers(mod)
                                  : aplicarNivelNomeado(mod, c.k as NivelNomeado)
                              }
                              className={`text-[0.7rem] font-semibold px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                                sel ? "" : "text-muted hover:text-secondary"
                              }`}
                              style={
                                sel
                                  ? {
                                      backgroundColor: "var(--brand)",
                                      color: "#fff",
                                      boxShadow: "0 1px 2px var(--shadow-color)",
                                    }
                                  : undefined
                              }
                            >
                              {c.rot}
                              {c.k === "pers" && sel && (
                                <span className="ml-1 mono-label text-[0.6rem] opacity-90">
                                  {marcadas}/{total}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Descrição viva: pode X · não pode Y */}
                      <div className="mt-2 text-xs text-secondary flex gap-1.5 items-start">
                        <span style={{ color: "var(--success)" }} className="flex-shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span>
                          {nivel === "pers" || !nivelDef ? (
                            `${t("Combinação personalizada")} — ${marcadas} ${t("de")} ${total} ${t("itens marcados.")}`
                          ) : (
                            <>
                              {nivelDef.desc}
                              {nivelDef.nao && <span className="text-muted"> · {nivelDef.nao}</span>}
                            </>
                          )}
                        </span>
                      </div>

                      {/* Checkboxes SEMPRE visíveis (módulo ligado) */}
                      <div className="mt-3 pt-3 border-t border-dashed border-border-strong">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="stat-label">
                            {mod.grupoLabel.ficha ?? t("Permissões deste módulo")}
                          </span>
                          {mod.sempre && (
                            <span className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => aplicarNivelNomeado(mod, "basico")}
                                className="text-[0.65rem] font-semibold px-2 py-0.5 rounded border border-border-strong text-muted hover:text-secondary transition-colors"
                              >
                                {t("Só o básico")}
                              </button>
                              <button
                                type="button"
                                onClick={() => aplicarNivelNomeado(mod, "total")}
                                className="text-[0.65rem] font-semibold px-2 py-0.5 rounded border border-border-strong text-muted hover:text-secondary transition-colors"
                              >
                                {t("Marcar todos")}
                              </button>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-0.5">
                          {mod.caps.map((cap, i) => {
                            const ativa = perms.has(cap.chave);
                            // Subcabeçalho de grupo (só quando muda e há rótulo).
                            const grupoAnterior = i > 0 ? mod.caps[i - 1].grupo : null;
                            const mostraGrupo =
                              !mod.sempre && cap.grupo !== grupoAnterior && !!mod.grupoLabel[cap.grupo];
                            return (
                              <div key={cap.chave}>
                                {mostraGrupo && (
                                  <div className="stat-label mt-2 mb-1">{mod.grupoLabel[cap.grupo]}</div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleCap(mod, cap)}
                                  className="flex items-center gap-2 text-left text-xs py-1 w-full rounded hover:bg-elevated transition-colors"
                                  role="checkbox"
                                  aria-checked={ativa}
                                >
                                  <span
                                    className="h-4 w-4 rounded-[4px] flex items-center justify-center flex-shrink-0 border"
                                    style={{
                                      backgroundColor: ativa ? "var(--brand)" : "transparent",
                                      borderColor: ativa
                                        ? "var(--brand)"
                                        : cap.piso
                                          ? "var(--text-muted)"
                                          : "var(--border-strong)",
                                    }}
                                  >
                                    {ativa && <Check size={10} strokeWidth={3.5} color="#fff" />}
                                  </span>
                                  <span className={ativa ? "text-secondary" : "text-muted"}>{cap.label}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {mod.nota && (
                        <div className="mt-2.5 text-[0.65rem] text-muted bg-surface rounded-md p-2 flex gap-1.5 items-start">
                          <span className="flex-shrink-0">💡</span>
                          {/* nota é conteúdo estático do MODELO (contém <b>). */}
                          <span dangerouslySetInnerHTML={{ __html: mod.nota }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumo lateral em PT */}
        <div className="md:sticky md:top-0 flex flex-col gap-3">
          <div className="bg-surface-2 border border-border rounded-md p-3.5">
            <div className="stat-label mb-2.5">
              {t("O que")} {nomeUsuario} {t("pode fazer")}
              <span className="text-brand normal-case tracking-normal"> {t("com")} {nomeArtista}</span>
            </div>
            <div className="flex flex-col gap-2">
              {MODELOS_EQUIPE.map((mod) => {
                const on = moduloOn(mod);
                let cor: string;
                let texto: ReactNode;
                if (!on) {
                  cor = "var(--text-muted)";
                  texto = (
                    <>
                      <b className="text-primary">{mod.nome}:</b> {t("desligado — não aparece no menu.")}
                    </>
                  );
                } else {
                  const nivel = nivelDe(mod);
                  cor = COR_NIVEL[nivel];
                  if (nivel === "pers") {
                    texto = (
                      <>
                        <b className="text-primary">{mod.nome}:</b> {t("personalizado")} —{" "}
                        {contarCaps(mod, perms)} {t("de")} {mod.caps.length} {t("itens.")}
                      </>
                    );
                  } else {
                    const def = mod.niveis.find((n) => n.k === nivel);
                    texto = (
                      <>
                        <b className="text-primary">{mod.nome}</b> ({def?.rot.toLowerCase()}):{" "}
                        {def?.desc}
                      </>
                    );
                  }
                }
                return (
                  <div key={mod.id} className="flex gap-2 text-xs text-secondary items-start">
                    <span
                      className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: cor }}
                    />
                    <span>{texto}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-2 border border-border rounded-md p-3.5 text-[0.65rem] text-muted">
            <div className="stat-label mb-1.5">{t("Regras que valem sempre")}</div>
            <ul className="list-disc ml-4 flex flex-col gap-1">
              <li>{t("O nível se ajusta sozinho: marcar tudo vira Acesso total; deixar só o piso do básico volta a Básico; qualquer outra combinação é Personalizado.")}</li>
              <li>{t("Orçamento e venda andam juntos — o mesmo módulo governa os dois.")}</li>
              <li>{t("Ver uma venda ≠ ver o rastro do dinheiro — comprovante e log são do Financeiro.")}</li>
              <li>{t("Cancelar ≠ excluir. Excluir venda ou contrato é só do admin.")}</li>
              <li>{t("Cada artista tem a própria configuração.")}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border">
        <button onClick={onFechar} className="btn btn-secondary text-sm" disabled={salvando}>
          {t("Cancelar")}
        </button>
        <button onClick={salvar} className="btn btn-primary text-sm" disabled={salvando || !podeSalvar}>
          {salvando ? t("Salvando…") : rotuloSalvar ?? t("Salvar permissões")}
        </button>
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
  const t = useT();
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
    // Membro novo nasce com a Agenda no Básico (piso da ficha) — a agenda é
    // sempre ativa, então começar vazio deixaria o card em "Personalizado 0/13".
    setEditor({
      userId: "",
      perfis: [],
      perms: new Set(chavesDoNivel("agenda", "basico")),
      novo: true,
      nome: "",
    });
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
          {t("O que cada membro pode fazer com")} {artistaNome} — {t("vale só para este artista.")}
        </div>
        <button onClick={abrirNovo} className="btn btn-primary text-sm flex-shrink-0">
          <Plus size={14} /> {t("Adicionar membro")}
        </button>
      </div>

      {erro && <div className="text-xs text-danger">{erro}</div>}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted py-6 justify-center">
          <Loader2 size={16} className="animate-spin" /> {t("Carregando…")}
        </div>
      ) : membros.length === 0 ? (
        <div className="card text-center py-8 text-sm text-muted">
          {t("Ninguém vinculado ainda. Clique em")} <strong>{t("Adicionar membro")}</strong>{" "}
          {t("para dar acesso a este artista.")}
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
                    <span className="text-[0.65rem] text-muted">{t("Personalizado")}</span>
                  )}
                  <span className="mono-label text-[0.6rem]">
                    {m.permissoes.length} {t("permissões")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => abrirEdicao(m)} className="btn-ghost p-1.5 rounded" aria-label={t("Editar permissões")}>
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => remover(m.userId)}
                  className="btn-ghost p-1.5 rounded"
                  style={{ color: "var(--danger)" }}
                  aria-label={t("Remover do artista")}
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
          titulo={editor.novo ? t("Adicionar membro") : undefined}
          podeSalvar={!!editor.userId}
          slotTopo={
            editor.novo ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-secondary">{t("Usuário")}</span>
                <select
                  className="campo-input"
                  value={editor.userId}
                  onChange={(e) =>
                    setEditor((s) =>
                      s ? { ...s, userId: e.target.value, nome: disponiveis.find((u) => u.id === e.target.value)?.nome ?? "" } : s
                    )
                  }
                >
                  <option value="">{t("Selecione…")}</option>
                  {disponiveis.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
                {disponiveis.length === 0 && (
                  <span className="text-xs text-muted">{t("Todos os membros da equipe já estão vinculados. Crie um novo usuário em Configurações → Equipe.")}</span>
                )}
              </label>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
