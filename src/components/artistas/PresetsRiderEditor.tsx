"use client";

import { useMemo, useState } from "react";
import { Wand2, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import Modal from "../Modal";
import QuantitySelector from "../QuantitySelector";
import { useT } from "@/lib/i18n";
import type { Artista, ItemQuantidade } from "@/types";
import { CATALOGO_CAMARIM, CATALOGO_EFEITOS, CATALOGO_TECNICO } from "@/types";
import { formatarQuantidade } from "@/lib/contratos/extenso";
import {
  CATEGORIAS_PRESET,
  LABELS_CATEGORIA_PRESET,
  MAX_PRESETS_POR_CATEGORIA,
  MAX_NOME_PRESET,
  normalizarPresets,
  type CategoriaPreset,
  type PresetRider,
  type PresetsRider,
} from "@/lib/presetsRider";

/**
 * Editor de PRESETS DE RIDER do artista (mig 97) — vive no detalhe do artista
 * (AbaArtistas). Até 3 presets nomeados por categoria (Camarim, Efeitos,
 * Técnico), cada um com itens + quantidade. No Novo Orçamento / Concretizar
 * Venda esses presets viram chips de 1 clique (PresetChips).
 *
 * Sugestões de item = rider do artista (o cardápio dele) + catálogo do
 * produto; texto livre também vale — o preset não fica refém do catálogo.
 */
export default function PresetsRiderEditor({
  artista,
  podeEditar,
  onSalvar,
}: {
  artista: Artista;
  podeEditar: boolean;
  /** Recebe o objeto COMPLETO de presets (as 3 categorias) pra persistir. */
  onSalvar: (presets: PresetsRider) => Promise<void>;
}) {
  const t = useT();
  const presets = useMemo(
    () => normalizarPresets(artista.presets),
    [artista.presets]
  );

  // Modal de edição: qual categoria + índice do slot (null = novo).
  const [editando, setEditando] = useState<{
    categoria: CategoriaPreset;
    indice: number | null;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const sugestoesDe = (categoria: CategoriaPreset): string[] => {
    const rider =
      categoria === "camarim"
        ? artista.riderCamarim ?? []
        : categoria === "efeitos"
        ? artista.riderEfeitos ?? []
        : artista.riderTecnico ?? [];
    const catalogo =
      categoria === "camarim"
        ? CATALOGO_CAMARIM
        : categoria === "efeitos"
        ? CATALOGO_EFEITOS
        : CATALOGO_TECNICO;
    // Rider do artista primeiro (é o cardápio DELE), catálogo completa.
    return Array.from(new Set([...rider, ...catalogo]));
  };

  async function persistir(
    categoria: CategoriaPreset,
    indice: number | null,
    novo: PresetRider | null // null = excluir o slot
  ) {
    setSalvando(true);
    setErro(null);
    try {
      const lista = [...presets[categoria]];
      if (novo === null) {
        if (indice !== null) lista.splice(indice, 1);
      } else if (indice === null) {
        lista.push(novo);
      } else {
        lista[indice] = novo;
      }
      await onSalvar({ ...presets, [categoria]: lista });
      setEditando(null);
    } catch (e) {
      setErro((e as Error).message ?? t("Falha ao salvar o preset."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-surface-2 border border-border rounded p-4 flex flex-col gap-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        <Wand2 size={13} />
        {t("Presets de rider")}
        <span className="normal-case font-normal tracking-normal">
          · {t("combinações prontas pra aplicar com 1 clique no orçamento/venda")}
        </span>
      </div>

      {CATEGORIAS_PRESET.map((categoria) => {
        const lista = presets[categoria];
        return (
          <div key={categoria} className="flex flex-col gap-2">
            <div className="text-xs font-semibold text-secondary">
              {t(LABELS_CATEGORIA_PRESET[categoria])}
            </div>
            <div className="flex flex-wrap gap-2">
              {lista.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!podeEditar}
                  onClick={() => setEditando({ categoria, indice: i })}
                  title={p.itens.map((it) => `${formatarQuantidade(it.qtd)} ${it.nome}`).join("\n")}
                  className="group flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 text-left hover:border-border-strong transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary truncate">
                      {p.nome}
                    </div>
                    <div className="text-[0.7rem] text-muted">
                      {t("{n} itens", { n: p.itens.length })}
                    </div>
                  </div>
                  {podeEditar && (
                    <Pencil
                      size={12}
                      className="text-muted group-hover:text-primary flex-shrink-0"
                    />
                  )}
                </button>
              ))}
              {podeEditar && lista.length < MAX_PRESETS_POR_CATEGORIA && (
                <button
                  type="button"
                  onClick={() => setEditando({ categoria, indice: null })}
                  className="flex items-center gap-1.5 border border-dashed border-border-strong rounded-md px-3 py-2 text-xs font-semibold text-secondary hover:text-primary hover:border-primary transition-colors"
                >
                  <Plus size={13} />
                  {t("Novo preset")}
                </button>
              )}
              {lista.length === 0 && !podeEditar && (
                <span className="text-sm text-muted">{t("Nenhum preset configurado.")}</span>
              )}
            </div>
          </div>
        );
      })}

      {editando && (
        <PresetModal
          key={`${editando.categoria}-${editando.indice ?? "novo"}`}
          categoria={editando.categoria}
          inicial={
            editando.indice !== null
              ? presets[editando.categoria][editando.indice]
              : null
          }
          sugestoes={sugestoesDe(editando.categoria)}
          salvando={salvando}
          erro={erro}
          onFechar={() => {
            setEditando(null);
            setErro(null);
          }}
          onSalvar={(p) => persistir(editando.categoria, editando.indice, p)}
          onExcluir={
            editando.indice !== null
              ? () => persistir(editando.categoria, editando.indice, null)
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Modal de criação/edição de UM preset. */
function PresetModal({
  categoria,
  inicial,
  sugestoes,
  salvando,
  erro,
  onFechar,
  onSalvar,
  onExcluir,
}: {
  categoria: CategoriaPreset;
  inicial: PresetRider | null;
  sugestoes: string[];
  salvando: boolean;
  erro: string | null;
  onFechar: () => void;
  onSalvar: (p: PresetRider) => void;
  onExcluir?: () => void;
}) {
  const t = useT();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [itens, setItens] = useState<ItemQuantidade[]>(inicial?.itens ?? []);
  const [novoItem, setNovoItem] = useState("");

  const nomesNoPreset = new Set(itens.map((i) => i.nome));
  const sugestoesLivres = sugestoes.filter((s) => !nomesNoPreset.has(s));

  const adicionar = (nomeItem: string) => {
    const limpo = nomeItem.trim();
    if (!limpo || nomesNoPreset.has(limpo)) return;
    setItens((prev) => [...prev, { nome: limpo, qtd: 1 }]);
    setNovoItem("");
  };

  const valido = nome.trim().length > 0 && itens.some((i) => i.qtd > 0);

  return (
    <Modal
      isOpen
      onClose={onFechar}
      title={inicial ? t("Editar preset") : t("Novo preset")}
      subtitle={t(LABELS_CATEGORIA_PRESET[categoria])}
      maxWidth={520}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">{t("Nome do preset")}</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={MAX_NOME_PRESET}
            placeholder={t("Ex: Padrão, Festival, Internacional…")}
            className="campo-input w-full"
            autoFocus
          />
        </div>

        {/* Itens do preset */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">
            {t("Itens e quantidades")}
          </label>
          {itens.length === 0 && (
            <div className="text-sm text-muted italic">
              {t("Adicione itens abaixo — do rider do artista ou digitando livre.")}
            </div>
          )}
          {itens.map((item, idx) => (
            <div key={item.nome} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <QuantitySelector
                  label={item.nome}
                  value={item.qtd}
                  onChange={(v) =>
                    setItens((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, qtd: v } : it))
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))}
                aria-label={t("Remover item")}
                className="btn-ghost p-1.5 rounded text-muted hover:text-danger flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Adicionar item: texto livre + sugestões do rider/catálogo */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionar(novoItem);
                }
              }}
              placeholder={t("Adicionar item (digite e Enter)…")}
              className="campo-input flex-1"
              maxLength={120}
            />
            <button
              type="button"
              onClick={() => adicionar(novoItem)}
              disabled={!novoItem.trim()}
              className="btn btn-secondary disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
          {sugestoesLivres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {sugestoesLivres.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => adicionar(s)}
                  className="text-xs bg-elevated border border-border rounded-md px-2 py-1 text-secondary hover:text-primary hover:border-border-strong transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {erro && <div className="text-sm text-danger">{erro}</div>}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          {onExcluir ? (
            <button
              type="button"
              onClick={onExcluir}
              disabled={salvando}
              className="text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={12} />
              {t("Excluir preset")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="btn btn-secondary"
            >
              {t("Cancelar")}
            </button>
            <button
              type="button"
              onClick={() =>
                onSalvar({
                  nome: nome.trim(),
                  itens: itens.filter((i) => i.qtd > 0),
                })
              }
              disabled={salvando || !valido}
              className="btn btn-primary disabled:opacity-50"
            >
              <Check size={14} />
              {salvando ? t("Salvando...") : t("Salvar preset")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
