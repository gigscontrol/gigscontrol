"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Save } from "lucide-react";
import { useModelos } from "@/lib/modelos-context";
import type { SecaoModelo } from "@/lib/mappers/contratoModelo";
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

function novaSecao(): SecaoModelo {
  return { id: crypto.randomUUID(), titulo: "", corpo: "" };
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
  const [secoes, setSecoes] = useState<SecaoModelo[]>(() =>
    secoesIniciais.length > 0 ? secoesIniciais : [novaSecao()]
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // Rastreamento do caret: guardamos a referência ao último <textarea> de
  // corpo que recebeu foco e o id da seção correspondente, para inserir
  // variáveis no ponto certo.
  const textareasRef = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const focoRef = useRef<string | null>(null);

  // ---- Manipulação de seções ----

  function atualizarSecao(id: string, patch: Partial<SecaoModelo>) {
    setSecoes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function adicionarSecao() {
    setSecoes((prev) => [...prev, novaSecao()]);
  }

  function removerSecao(id: string) {
    const alvo = secoes.find((s) => s.id === id);
    const temConteudo = !!(alvo && (alvo.titulo.trim() || alvo.corpo.trim()));
    if (temConteudo && !window.confirm("Remover esta seção? O conteúdo será perdido.")) {
      return;
    }
    setSecoes((prev) => prev.filter((s) => s.id !== id));
    if (focoRef.current === id) focoRef.current = null;
    delete textareasRef.current[id];
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

  // ---- Inserção de variáveis no caret ----

  function inserirVariavel(token: string) {
    const trecho = `{{${token}}}`;

    // Sem nenhum textarea focado ainda: anexa na primeira seção.
    const alvoId = focoRef.current ?? secoes[0]?.id ?? null;
    if (!alvoId) return;

    const el = textareasRef.current[alvoId];
    const secao = secoes.find((s) => s.id === alvoId);
    if (!secao) return;

    // Posição de inserção: caret atual quando há textarea; senão, fim do corpo.
    const temCaret = !!el && focoRef.current === alvoId;
    const inicio = temCaret ? el!.selectionStart : secao.corpo.length;
    const fim = temCaret ? el!.selectionEnd : secao.corpo.length;

    const novoCorpo = secao.corpo.slice(0, inicio) + trecho + secao.corpo.slice(fim);
    atualizarSecao(alvoId, { corpo: novoCorpo });

    // Restaura o foco e posiciona o caret logo após o trecho inserido.
    const novaPos = inicio + trecho.length;
    requestAnimationFrame(() => {
      const ref = textareasRef.current[alvoId];
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
    const nomeLimpo = nome.trim();
    const temSecaoComConteudo = secoes.some((s) => s.titulo.trim() || s.corpo.trim());

    // Guarda básica: exige nome OU ao menos uma seção com algo.
    if (!nomeLimpo && !temSecaoComConteudo) {
      setErro("Dê um nome ao modelo ou preencha ao menos uma seção.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: nomeLimpo || "Modelo sem nome",
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
        <div className="card mb-6 border-danger/40" style={{ borderColor: "var(--danger)" }}>
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
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={secao.titulo}
                      onChange={(e) => atualizarSecao(secao.id, { titulo: e.target.value })}
                      placeholder="Título da seção"
                      className="campo-input font-semibold"
                    />
                    <div className="flex items-center gap-0.5 flex-shrink-0">
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

                  <textarea
                    ref={(el) => {
                      textareasRef.current[secao.id] = el;
                    }}
                    value={secao.corpo}
                    onChange={(e) => atualizarSecao(secao.id, { corpo: e.target.value })}
                    onFocus={() => {
                      focoRef.current = secao.id;
                    }}
                    placeholder="Escreva o conteúdo da seção. Use as variáveis ao lado para inserir {{campos}} automáticos."
                    className="campo-input min-h-[140px] resize-y leading-relaxed"
                    style={{ whiteSpace: "pre-wrap" }}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={adicionarSecao}
                className="btn btn-secondary self-start"
              >
                <Plus size={15} />
                Adicionar seção
              </button>
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

/** Preview do modelo com os dados de exemplo já substituídos. */
function PreviewSecoes({ secoes }: { secoes: SecaoModelo[] }) {
  const semConteudo = secoes.every((s) => !s.titulo.trim() && !s.corpo.trim());

  return (
    <div className="card">
      <p className="section-subtitle mb-5">Preview com dados de exemplo</p>
      {semConteudo ? (
        <p className="text-sm text-muted italic">
          Nada para mostrar ainda — adicione título e conteúdo às seções.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {secoes.map((secao) => (
            <div key={secao.id}>
              {secao.titulo.trim() && (
                <h3
                  className="text-sm font-bold uppercase tracking-wide mb-2"
                  style={{ color: ACCENT }}
                >
                  {secao.titulo}
                </h3>
              )}
              <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">
                {preencher(secao.corpo, VALORES_EXEMPLO)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
