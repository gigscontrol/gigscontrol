"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  X,
  Heading,
  Users,
  ListOrdered,
  PenLine,
  Paperclip,
} from "lucide-react";
import { useModelos } from "@/lib/modelos-context";
import type { SecaoModelo, ItemClausula } from "@/lib/mappers/contratoModelo";
import { calcularNumeracao } from "@/lib/contratos/numeracao";
import {
  VARIAVEIS_CONTRATO,
  VALORES_EXEMPLO,
  preencher,
  type VariavelContrato,
} from "@/lib/contratos/variaveis";

const ACCENT = "var(--module-contratos)";

type Props = {
  /** Quando presente, o editor atualiza um modelo existente; senão cria um novo. */
  modeloId?: string | null;
  nomeInicial: string;
  secoesIniciais: SecaoModelo[];
  onVoltar: () => void;
  onSalvo: () => void;
};

/** Tipos de seção que o usuário pode adicionar, na ordem do menu. */
type TipoSecao = SecaoModelo["tipo"];

const TIPOS_SECAO: { tipo: TipoSecao; label: string; Icon: typeof Heading }[] = [
  { tipo: "titulo", label: "Título", Icon: Heading },
  { tipo: "partes", label: "Das partes", Icon: Users },
  { tipo: "clausula", label: "Cláusula", Icon: ListOrdered },
  { tipo: "assinaturas", label: "Assinaturas", Icon: PenLine },
  { tipo: "anexo", label: "Anexo", Icon: Paperclip },
];

/** Cria uma seção vazia do tipo pedido (com ids novos). */
function novaSecao(tipo: TipoSecao): SecaoModelo {
  const id = crypto.randomUUID();
  switch (tipo) {
    case "titulo":
      return { id, tipo: "titulo", titulo: "", subtitulo: "" };
    case "partes":
      return { id, tipo: "partes", contratante: "", contratado: "", paragrafo: "" };
    case "clausula":
      return {
        id,
        tipo: "clausula",
        titulo: "",
        itens: [{ id: crypto.randomUUID(), tipo: "subclausula", texto: "" }],
      };
    case "assinaturas":
      return { id, tipo: "assinaturas", testemunhas: [] };
    case "anexo":
      return { id, tipo: "anexo", titulo: "", conteudo: "" };
  }
}

/**
 * Campo editável de texto. Identifica exatamente qual string do estado um
 * input/textarea edita, para inserir variáveis no ponto do cursor.
 */
/** Campos de string de seção (sem os itens de cláusula). */
type CampoTextoSimples =
  | "titulo"
  | "subtitulo"
  | "contratante"
  | "contratado"
  | "paragrafo"
  | "conteudo";

/** Qualquer campo editável: os simples acima OU um item de cláusula. */
type CampoTexto = CampoTextoSimples | "item";

type Descritor = { secaoId: string; campo: CampoTexto; itemId?: string };

/** Chave única (estável) de um campo editável, para indexar o ref do DOM. */
function chaveCampo(d: Descritor): string {
  return d.campo === "item"
    ? `${d.secaoId}:item:${d.itemId}`
    : `${d.secaoId}:${d.campo}`;
}

/**
 * Agrupa as variáveis por `grupo`, preservando a ordem em que aparecem em
 * VARIAVEIS_CONTRATO (tanto a ordem dos grupos quanto a das variáveis dentro
 * de cada grupo).
 */
function agruparVariaveis(): { grupo: string; itens: VariavelContrato[] }[] {
  const grupos: { grupo: string; itens: VariavelContrato[] }[] = [];
  for (const v of VARIAVEIS_CONTRATO) {
    let bucket = grupos.find((g) => g.grupo === v.grupo);
    if (!bucket) {
      bucket = { grupo: v.grupo, itens: [] };
      grupos.push(bucket);
    }
    bucket.itens.push(v);
  }
  return grupos;
}

const GRUPOS_VARIAVEIS = agruparVariaveis();

/** Há algo digitado em alguma seção? (para validações/preview). */
function temConteudo(secoes: SecaoModelo[]): boolean {
  return secoes.some((s) => {
    switch (s.tipo) {
      case "titulo":
        return !!(s.titulo.trim() || s.subtitulo.trim());
      case "partes":
        return !!(s.contratante.trim() || s.contratado.trim() || s.paragrafo.trim());
      case "clausula":
        return !!(s.titulo.trim() || s.itens.some((i) => i.texto.trim()));
      case "anexo":
        return !!(s.titulo.trim() || s.conteudo.trim());
      case "assinaturas":
        return true; // assinaturas sempre geram blocos
    }
  });
}

export default function EditorModelo({
  modeloId,
  nomeInicial,
  secoesIniciais,
  onVoltar,
  onSalvo,
}: Props) {
  const { criarModelo, atualizarModelo } = useModelos();

  const [nome, setNome] = useState(nomeInicial);
  const [secoes, setSecoes] = useState<SecaoModelo[]>(secoesIniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  // Numeração automática (cláusulas + sub-cláusulas), recalculada a cada render.
  const num = calcularNumeracao(secoes);

  // Rastreamento do caret: referência de cada campo editável (input/textarea),
  // indexado pela chave do descritor, e qual recebeu foco por último.
  const camposRef = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const focoRef = useRef<Descritor | null>(null);

  // Fecha o menu de "Adicionar seção" ao clicar fora.
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuAberto) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuAberto]);

  // ---- Manipulação de seções ----

  function adicionarSecao(tipo: TipoSecao) {
    setSecoes((prev) => [...prev, novaSecao(tipo)]);
    setMenuAberto(false);
  }

  function removerSecao(id: string) {
    if (temConteudo(secoes.filter((s) => s.id === id)) &&
        !window.confirm("Remover esta seção? O conteúdo será perdido.")) {
      return;
    }
    setSecoes((prev) => prev.filter((s) => s.id !== id));
    if (focoRef.current?.secaoId === id) focoRef.current = null;
    for (const chave of Object.keys(camposRef.current)) {
      if (chave.startsWith(`${id}:`)) delete camposRef.current[chave];
    }
  }

  function moverSecao(index: number, dir: -1 | 1) {
    setSecoes((prev) => {
      const destino = index + dir;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      const [item] = copia.splice(index, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  }

  /**
   * Atualiza um campo de texto simples de uma seção, imutavelmente. O `switch`
   * por `tipo` garante que só escrevemos o campo onde ele realmente existe
   * (TS narrows corretamente cada membro da união).
   */
  function setCampo(secaoId: string, campo: CampoTextoSimples, valor: string) {
    setSecoes((prev) =>
      prev.map((s): SecaoModelo => {
        if (s.id !== secaoId) return s;
        switch (s.tipo) {
          case "titulo":
            if (campo === "titulo") return { ...s, titulo: valor };
            if (campo === "subtitulo") return { ...s, subtitulo: valor };
            return s;
          case "partes":
            if (campo === "contratante") return { ...s, contratante: valor };
            if (campo === "contratado") return { ...s, contratado: valor };
            if (campo === "paragrafo") return { ...s, paragrafo: valor };
            return s;
          case "clausula":
            if (campo === "titulo") return { ...s, titulo: valor };
            return s;
          case "anexo":
            if (campo === "titulo") return { ...s, titulo: valor };
            if (campo === "conteudo") return { ...s, conteudo: valor };
            return s;
          case "assinaturas":
            return s;
        }
      })
    );
  }

  /** Adiciona uma testemunha (manual) numa seção de assinaturas — máx. 2. */
  function adicionarTestemunha(secaoId: string) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "assinaturas" && s.testemunhas.length < 2
          ? {
              ...s,
              testemunhas: [
                ...s.testemunhas,
                { id: crypto.randomUUID(), nome: "", documento: "" },
              ],
            }
          : s
      )
    );
  }

  function removerTestemunha(secaoId: string, testemunhaId: string) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "assinaturas"
          ? { ...s, testemunhas: s.testemunhas.filter((t) => t.id !== testemunhaId) }
          : s
      )
    );
  }

  function atualizarTestemunha(
    secaoId: string,
    testemunhaId: string,
    campo: "nome" | "documento",
    valor: string
  ) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "assinaturas"
          ? {
              ...s,
              testemunhas: s.testemunhas.map((t) =>
                t.id === testemunhaId ? { ...t, [campo]: valor } : t
              ),
            }
          : s
      )
    );
  }

  // ---- Manipulação de itens de cláusula ----

  function atualizarItem(secaoId: string, itemId: string, texto: string) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "clausula"
          ? {
              ...s,
              itens: s.itens.map((i) => (i.id === itemId ? { ...i, texto } : i)),
            }
          : s
      )
    );
  }

  function adicionarItem(secaoId: string, tipo: ItemClausula["tipo"]) {
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "clausula"
          ? {
              ...s,
              itens: [...s.itens, { id: crypto.randomUUID(), tipo, texto: "" }],
            }
          : s
      )
    );
  }

  function removerItem(secaoId: string, itemId: string) {
    const secao = secoes.find((s) => s.id === secaoId);
    const item =
      secao?.tipo === "clausula" ? secao.itens.find((i) => i.id === itemId) : null;
    if (item?.texto.trim() &&
        !window.confirm("Remover este item? O conteúdo será perdido.")) {
      return;
    }
    setSecoes((prev) =>
      prev.map((s) =>
        s.id === secaoId && s.tipo === "clausula"
          ? { ...s, itens: s.itens.filter((i) => i.id !== itemId) }
          : s
      )
    );
    if (focoRef.current?.itemId === itemId) focoRef.current = null;
    delete camposRef.current[chaveCampo({ secaoId, campo: "item", itemId })];
  }

  // ---- Inserção de variáveis no caret ----

  /** Lê o valor atual da string que um descritor edita (ou null se obsoleto). */
  function lerValor(d: Descritor): string | null {
    const secao = secoes.find((s) => s.id === d.secaoId);
    if (!secao) return null;
    switch (d.campo) {
      case "titulo":
        return secao.tipo === "titulo" || secao.tipo === "clausula" || secao.tipo === "anexo"
          ? secao.titulo
          : null;
      case "subtitulo":
        return secao.tipo === "titulo" ? secao.subtitulo : null;
      case "contratante":
        return secao.tipo === "partes" ? secao.contratante : null;
      case "contratado":
        return secao.tipo === "partes" ? secao.contratado : null;
      case "paragrafo":
        return secao.tipo === "partes" ? secao.paragrafo : null;
      case "conteudo":
        return secao.tipo === "anexo" ? secao.conteudo : null;
      case "item": {
        if (secao.tipo !== "clausula") return null;
        const it = secao.itens.find((i) => i.id === d.itemId);
        return it ? it.texto : null;
      }
    }
  }

  /** Escreve um novo valor na string que um descritor edita. */
  function escreverValor(d: Descritor, valor: string) {
    if (d.campo === "item") {
      if (d.itemId) atualizarItem(d.secaoId, d.itemId, valor);
      return;
    }
    setCampo(d.secaoId, d.campo, valor);
  }

  function inserirVariavel(token: string) {
    const trecho = `{{${token}}}`;
    const foco = focoRef.current;

    // Sem foco válido: anexa ao 1º campo de texto disponível (sem crashar).
    const alvo: Descritor | null =
      foco && lerValor(foco) !== null ? foco : primeiroCampoTexto(secoes);
    if (!alvo) return;

    const valor = lerValor(alvo);
    if (valor === null) return;

    const chave = chaveCampo(alvo);
    const el = camposRef.current[chave];
    const mesmoFoco =
      !!el &&
      foco?.secaoId === alvo.secaoId &&
      foco?.campo === alvo.campo &&
      foco?.itemId === alvo.itemId;

    const inicio = mesmoFoco ? el!.selectionStart ?? valor.length : valor.length;
    const fim = mesmoFoco ? el!.selectionEnd ?? valor.length : valor.length;

    const novoValor = valor.slice(0, inicio) + trecho + valor.slice(fim);
    escreverValor(alvo, novoValor);

    const novaPos = inicio + trecho.length;
    requestAnimationFrame(() => {
      const ref = camposRef.current[chave];
      if (ref) {
        ref.focus();
        try {
          ref.setSelectionRange(novaPos, novaPos);
        } catch {
          /* ignora navegadores que não suportam */
        }
      }
    });
  }

  // ---- Salvar ----

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: nome.trim() || "Modelo sem nome",
        tipo: "editavel" as const,
        secoes,
      };
      if (modeloId) {
        await atualizarModelo(modeloId, payload);
      } else {
        await criarModelo(payload);
      }
      onSalvo();
    } catch (e) {
      setErro((e as Error).message || "Não foi possível salvar o modelo.");
    } finally {
      setSalvando(false);
    }
  }

  // ---- Helpers de render de campos ----

  /** Props comuns de um campo editável (ref + foco). */
  function campoProps(d: Descritor) {
    return {
      ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
        camposRef.current[chaveCampo(d)] = el;
      },
      onFocus: () => {
        focoRef.current = d;
      },
    };
  }

  // ---- Render ----

  return (
    <div>
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button type="button" onClick={onVoltar} className="btn btn-ghost">
          <ArrowLeft size={15} />
          Voltar
        </button>

        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do modelo"
          className="campo-input flex-1 min-w-[220px] max-w-md font-medium"
        />

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="btn btn-secondary"
            aria-pressed={preview}
          >
            {preview ? <EyeOff size={15} /> : <Eye size={15} />}
            {preview ? "Editar" : "Preview"}
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="btn"
            style={{ backgroundColor: ACCENT, color: "#fff", opacity: salvando ? 0.6 : 1 }}
          >
            <Save size={15} />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {erro && (
        <div className="card mb-6" style={{ borderColor: "var(--danger)" }}>
          <p className="text-sm text-danger">{erro}</p>
        </div>
      )}

      {/* Layout em duas colunas (no lg): conteúdo + paleta de variáveis */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Coluna esquerda: editor de seções OU preview */}
        <div className="min-w-0">
          {preview ? (
            <PreviewSecoes secoes={secoes} />
          ) : (
            <div className="flex flex-col gap-4">
              {secoes.map((secao, index) => (
                <div key={secao.id} className="card">
                  {/* Cabeçalho do card: rótulo do tipo + mover/remover */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="stat-label" style={{ color: ACCENT }}>
                      {TIPOS_SECAO.find((t) => t.tipo === secao.tipo)?.label ?? secao.tipo}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => moverSecao(index, -1)}
                        disabled={index === 0}
                        title="Mover para cima"
                        aria-label="Mover para cima"
                        className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverSecao(index, 1)}
                        disabled={index === secoes.length - 1}
                        title="Mover para baixo"
                        aria-label="Mover para baixo"
                        className="btn-ghost p-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removerSecao(secao.id)}
                        title="Remover seção"
                        aria-label="Remover seção"
                        className="btn-ghost p-1.5 rounded hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Corpo do card por tipo */}
                  {secao.tipo === "titulo" && (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        {...campoProps({ secaoId: secao.id, campo: "titulo" })}
                        value={secao.titulo}
                        onChange={(e) => setCampo(secao.id, "titulo", e.target.value)}
                        placeholder="Título do contrato"
                        className="campo-input font-semibold"
                      />
                      <input
                        type="text"
                        {...campoProps({ secaoId: secao.id, campo: "subtitulo" })}
                        value={secao.subtitulo}
                        onChange={(e) => setCampo(secao.id, "subtitulo", e.target.value)}
                        placeholder="Subtítulo"
                        className="campo-input"
                      />
                    </div>
                  )}

                  {secao.tipo === "partes" && (
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="stat-label">Contratante</span>
                        <textarea
                          {...campoProps({ secaoId: secao.id, campo: "contratante" })}
                          value={secao.contratante}
                          onChange={(e) => setCampo(secao.id, "contratante", e.target.value)}
                          placeholder="Identificação do contratante. Use as variáveis ao lado."
                          className="campo-input min-h-[70px] resize-y leading-relaxed"
                          style={{ whiteSpace: "pre-wrap" }}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="stat-label">Contratado</span>
                        <textarea
                          {...campoProps({ secaoId: secao.id, campo: "contratado" })}
                          value={secao.contratado}
                          onChange={(e) => setCampo(secao.id, "contratado", e.target.value)}
                          placeholder="Identificação do contratado. Use as variáveis ao lado."
                          className="campo-input min-h-[70px] resize-y leading-relaxed"
                          style={{ whiteSpace: "pre-wrap" }}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="stat-label">Parágrafo</span>
                        <textarea
                          {...campoProps({ secaoId: secao.id, campo: "paragrafo" })}
                          value={secao.paragrafo}
                          onChange={(e) => setCampo(secao.id, "paragrafo", e.target.value)}
                          placeholder="Parágrafo de abertura (ex: 'As partes acima têm, entre si...')."
                          className="campo-input min-h-[70px] resize-y leading-relaxed"
                          style={{ whiteSpace: "pre-wrap" }}
                        />
                      </label>
                    </div>
                  )}

                  {secao.tipo === "clausula" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="badge flex-shrink-0"
                          style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                        >
                          Cláusula {num.clausulas[secao.id]}
                        </span>
                        <input
                          type="text"
                          {...campoProps({ secaoId: secao.id, campo: "titulo" })}
                          value={secao.titulo}
                          onChange={(e) => setCampo(secao.id, "titulo", e.target.value)}
                          placeholder="Título da cláusula (ex: DO OBJETO)"
                          className="campo-input font-semibold"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pl-1">
                        {secao.itens.map((item) => (
                          <div key={item.id} className="flex items-start gap-1.5">
                            <span
                              className="text-xs font-semibold flex-shrink-0 mt-2 w-9 text-right"
                              style={{
                                color:
                                  item.tipo === "subclausula" ? ACCENT : "var(--text-muted)",
                              }}
                              title={item.tipo === "subclausula" ? "Sub-cláusula" : "Parágrafo"}
                            >
                              {item.tipo === "subclausula" ? num.itens[item.id] : "¶"}
                            </span>
                            <textarea
                              {...campoProps({
                                secaoId: secao.id,
                                campo: "item",
                                itemId: item.id,
                              })}
                              value={item.texto}
                              onChange={(e) => atualizarItem(secao.id, item.id, e.target.value)}
                              placeholder={
                                item.tipo === "subclausula"
                                  ? "Sub-cláusula numerada automaticamente."
                                  : "Parágrafo (sem número)."
                              }
                              className="campo-input min-h-[80px] resize-y leading-relaxed flex-1"
                              style={{ whiteSpace: "pre-wrap" }}
                            />
                            <button
                              type="button"
                              onClick={() => removerItem(secao.id, item.id)}
                              title="Remover item"
                              aria-label="Remover item"
                              className="btn-ghost p-1 rounded hover:text-danger flex-shrink-0 mt-1"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}

                        <div className="flex items-center gap-2 pl-9">
                          <button
                            type="button"
                            onClick={() => adicionarItem(secao.id, "subclausula")}
                            className="btn btn-ghost text-xs px-2 py-1"
                          >
                            <Plus size={13} />
                            Cláusula
                          </button>
                          <button
                            type="button"
                            onClick={() => adicionarItem(secao.id, "paragrafo")}
                            className="btn btn-ghost text-xs px-2 py-1"
                          >
                            <Plus size={13} />
                            Parágrafo
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {secao.tipo === "assinaturas" && (
                    <div className="flex flex-col gap-3">
                      <p className="section-subtitle">
                        Blocos de <strong>Contratante</strong> e{" "}
                        <strong>Contratado</strong> são automáticos (dados do
                        contrato). Testemunhas são preenchidas manualmente:
                      </p>

                      {secao.testemunhas.map((t, i) => (
                        <div
                          key={t.id}
                          className="bg-surface border border-border rounded p-3 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                              Testemunha {i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerTestemunha(secao.id, t.id)}
                              className="btn-ghost p-1 rounded text-muted hover:text-danger"
                              title="Remover testemunha"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={t.nome}
                            onChange={(e) =>
                              atualizarTestemunha(secao.id, t.id, "nome", e.target.value)
                            }
                            placeholder="Nome da testemunha"
                            className="campo-input"
                          />
                          <input
                            type="text"
                            value={t.documento}
                            onChange={(e) =>
                              atualizarTestemunha(
                                secao.id,
                                t.id,
                                "documento",
                                e.target.value
                              )
                            }
                            placeholder="CPF / documento"
                            className="campo-input"
                          />
                        </div>
                      ))}

                      {secao.testemunhas.length < 2 && (
                        <button
                          type="button"
                          onClick={() => adicionarTestemunha(secao.id)}
                          className="btn-ghost text-xs inline-flex items-center gap-1.5 self-start"
                          style={{ color: "var(--module-contratos)" }}
                        >
                          <Plus size={13} /> Testemunha
                        </button>
                      )}
                    </div>
                  )}

                  {secao.tipo === "anexo" && (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        {...campoProps({ secaoId: secao.id, campo: "titulo" })}
                        value={secao.titulo}
                        onChange={(e) => setCampo(secao.id, "titulo", e.target.value)}
                        placeholder="Título do anexo (ex: ANEXO — RIDER TÉCNICO)"
                        className="campo-input font-semibold"
                      />
                      <textarea
                        {...campoProps({ secaoId: secao.id, campo: "conteudo" })}
                        value={secao.conteudo}
                        onChange={(e) => setCampo(secao.id, "conteudo", e.target.value)}
                        placeholder="Conteúdo do anexo. Use as variáveis ao lado para inserir {{campos}}."
                        className="campo-input min-h-[110px] resize-y leading-relaxed"
                        style={{ whiteSpace: "pre-wrap" }}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Menu "Adicionar seção" */}
              <div ref={menuRef} className="relative self-start">
                <button
                  type="button"
                  onClick={() => setMenuAberto((a) => !a)}
                  className="btn btn-secondary"
                  aria-haspopup="menu"
                  aria-expanded={menuAberto}
                >
                  <Plus size={15} />
                  Adicionar seção
                </button>
                {menuAberto && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-1 z-10 min-w-[200px] rounded-md border p-1 shadow-lg"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    {TIPOS_SECAO.map(({ tipo, label, Icon }) => (
                      <button
                        key={tipo}
                        type="button"
                        role="menuitem"
                        onClick={() => adicionarSecao(tipo)}
                        className="btn-ghost w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left"
                      >
                        <Icon size={15} style={{ color: ACCENT }} />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita: paleta de variáveis (sticky) */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="card p-4">
            <div className="section-title mb-1">Variáveis</div>
            <p className="section-subtitle mb-4">
              Clique para inserir no ponto do cursor.
            </p>
            <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
              {GRUPOS_VARIAVEIS.map((g) => (
                <div key={g.grupo}>
                  <div className="stat-label mb-2">{g.grupo}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.itens.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => inserirVariavel(v.token)}
                        title={`Inserir {{${v.token}}}`}
                        className="badge badge-neutral hover:text-primary transition-colors"
                        style={{ cursor: "pointer" }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Primeiro campo de texto editável de um conjunto de seções (ou null). */
function primeiroCampoTexto(secoes: SecaoModelo[]): Descritor | null {
  for (const s of secoes) {
    switch (s.tipo) {
      case "titulo":
        return { secaoId: s.id, campo: "titulo" };
      case "partes":
        return { secaoId: s.id, campo: "contratante" };
      case "clausula":
        if (s.itens.length > 0) {
          return { secaoId: s.id, campo: "item", itemId: s.itens[0].id };
        }
        return { secaoId: s.id, campo: "titulo" };
      case "anexo":
        return { secaoId: s.id, campo: "titulo" };
      case "assinaturas":
        break; // sem campo de texto
    }
  }
  return null;
}

/** Preview do modelo com os dados de exemplo já substituídos. */
function PreviewSecoes({ secoes }: { secoes: SecaoModelo[] }) {
  const num = calcularNumeracao(secoes);
  const ex = (t: string) => preencher(t, VALORES_EXEMPLO);

  return (
    <div className="card">
      <p className="section-subtitle mb-5">Preview com dados de exemplo</p>
      {!temConteudo(secoes) ? (
        <p className="text-sm text-muted italic">
          Nada para mostrar ainda — adicione seções e preencha o conteúdo.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {secoes.map((secao) => (
            <div key={secao.id}>{renderPreviewSecao(secao, num, ex)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderPreviewSecao(
  secao: SecaoModelo,
  num: ReturnType<typeof calcularNumeracao>,
  ex: (t: string) => string
) {
  switch (secao.tipo) {
    case "titulo":
      return (
        <div className="text-center">
          {secao.titulo.trim() && (
            <h2 className="text-lg font-bold tracking-wide">{ex(secao.titulo)}</h2>
          )}
          {secao.subtitulo.trim() && (
            <p className="text-sm text-secondary mt-1">{ex(secao.subtitulo)}</p>
          )}
        </div>
      );

    case "partes":
      return (
        <div>
          <h3
            className="text-sm font-bold uppercase tracking-wide mb-2"
            style={{ color: ACCENT }}
          >
            Das partes
          </h3>
          <div className="flex flex-col gap-3">
            {[secao.contratante, secao.contratado, secao.paragrafo]
              .filter((t) => t.trim())
              .map((t, i) => (
                <div
                  key={i}
                  className="text-sm text-secondary leading-relaxed whitespace-pre-wrap"
                >
                  {ex(t)}
                </div>
              ))}
          </div>
        </div>
      );

    case "clausula":
      return (
        <div>
          <h3
            className="text-sm font-bold uppercase tracking-wide mb-2"
            style={{ color: ACCENT }}
          >
            {num.clausulas[secao.id]}ª — {ex(secao.titulo)}
          </h3>
          <div className="flex flex-col gap-3">
            {secao.itens.map((item) => (
              <div
                key={item.id}
                className="text-sm text-secondary leading-relaxed whitespace-pre-wrap"
              >
                {item.tipo === "subclausula"
                  ? `${num.itens[item.id]} ${ex(item.texto)}`
                  : ex(item.texto)}
              </div>
            ))}
          </div>
        </div>
      );

    case "assinaturas": {
      const blocos: { nome: string; doc?: string; papel: string }[] = [
        { nome: ex("{{contratante}}"), doc: ex("{{documento}}"), papel: "CONTRATANTE" },
        { nome: ex("{{artista}}"), papel: "CONTRATADO" },
      ];
      secao.testemunhas.forEach((t, i) => {
        blocos.push({ nome: t.nome, doc: t.documento, papel: `Testemunha ${i + 1}` });
      });
      return (
        <div className="flex flex-col gap-6 pt-2">
          {blocos.map((b, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className="w-64 border-t border-strong" />
              {b.nome && (
                <span className="text-sm text-secondary mt-1">{b.nome}</span>
              )}
              {b.doc && b.doc.trim() && (
                <span className="text-xs text-muted mt-0.5">{b.doc}</span>
              )}
              <span className="text-xs text-muted uppercase tracking-wide mt-0.5">
                {b.papel}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case "anexo":
      return (
        <div>
          <h3
            className="text-sm font-bold uppercase tracking-wide mb-2"
            style={{ color: ACCENT }}
          >
            {ex(secao.titulo)}
          </h3>
          <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
            {ex(secao.conteudo)}
          </div>
        </div>
      );
  }
}
