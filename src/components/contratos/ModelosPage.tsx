"use client";

import { useState } from "react";
import { Plus, Copy, Pencil, Trash2, FileText, Sparkles, Loader2 } from "lucide-react";
import PageHeader from "../PageHeader";
import EditorModelo from "./EditorModelo";
import { useModelos } from "@/lib/modelos-context";
import type { ContratoModelo, SecaoModelo } from "@/lib/mappers/contratoModelo";
import {
  NOME_MODELO_EXEMPLO,
  SECOES_MODELO_EXEMPLO,
} from "@/lib/contratos/modeloExemplo";

const ACCENT = "var(--module-contratos)";

type Vista = "lista" | "editor";

/**
 * Estado inicial do editor quando aberto. `modeloId` null = criação de um
 * modelo novo (ainda não salvo).
 */
type EditorInicial = {
  modeloId: string | null;
  nome: string;
  secoes: SecaoModelo[];
};

/** Clona seções gerando ids novos (para o "Duplicar e editar" do exemplo). */
function clonarSecoes(secoes: SecaoModelo[]): SecaoModelo[] {
  return secoes.map((s) => ({
    id: crypto.randomUUID(),
    titulo: s.titulo,
    corpo: s.corpo,
  }));
}

export default function ModelosPage() {
  const { modelos, carregando, removerModelo } = useModelos();

  const [vista, setVista] = useState<Vista>("lista");
  const [editando, setEditando] = useState<EditorInicial | null>(null);

  // Apenas modelos editáveis nesta tela (PDF é um sub-passo futuro).
  const editaveis = modelos.filter((m) => m.tipo === "editavel");

  // ---- Aberturas do editor ----

  function abrirExemplo() {
    setEditando({
      modeloId: null,
      nome: NOME_MODELO_EXEMPLO,
      secoes: clonarSecoes(SECOES_MODELO_EXEMPLO),
    });
    setVista("editor");
  }

  function abrirNovoEmBranco() {
    setEditando({
      modeloId: null,
      nome: "",
      secoes: [{ id: crypto.randomUUID(), titulo: "", corpo: "" }],
    });
    setVista("editor");
  }

  function abrirEdicao(modelo: ContratoModelo) {
    setEditando({
      modeloId: modelo.id,
      nome: modelo.nome,
      // Garante ao menos uma seção para edição confortável.
      secoes:
        modelo.secoes.length > 0
          ? modelo.secoes.map((s) => ({ ...s }))
          : [{ id: crypto.randomUUID(), titulo: "", corpo: "" }],
    });
    setVista("editor");
  }

  function voltarParaLista() {
    setVista("lista");
    setEditando(null);
  }

  async function excluir(modelo: ContratoModelo) {
    if (!window.confirm(`Excluir o modelo "${modelo.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await removerModelo(modelo.id);
    } catch (e) {
      window.alert((e as Error).message || "Não foi possível excluir o modelo.");
    }
  }

  // ---- Render ----

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Modelos de contrato"
        subtitle="Monte os modelos que vão gerar seus contratos"
        accentColor={ACCENT}
      />

      {vista === "editor" && editando ? (
        <EditorModelo
          modeloId={editando.modeloId}
          nomeInicial={editando.nome}
          secoesIniciais={editando.secoes}
          onVoltar={voltarParaLista}
          onSalvo={voltarParaLista}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Card de exemplo em destaque */}
          <div
            className="card"
            style={{
              borderColor: ACCENT,
              boxShadow: `0 0 0 1px ${ACCENT}`,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
                >
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="badge" style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}>
                      Comece por aqui
                    </span>
                  </div>
                  <div className="section-title mt-1.5">{NOME_MODELO_EXEMPLO}</div>
                  <p className="section-subtitle mt-1 max-w-2xl">
                    Modelo pronto de apresentação artística, com seções automáticas
                    (variáveis já posicionadas) e cláusulas para você completar.
                    Duplique e ajuste do seu jeito.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={abrirExemplo}
                className="btn flex-shrink-0"
                style={{ backgroundColor: ACCENT, color: "#fff" }}
              >
                <Copy size={15} />
                Duplicar e editar
              </button>
            </div>
          </div>

          {/* Ação: novo modelo em branco */}
          <div>
            <button type="button" onClick={abrirNovoEmBranco} className="btn btn-secondary">
              <Plus size={15} />
              Novo modelo em branco
            </button>
          </div>

          {/* Lista dos modelos do workspace */}
          <div>
            <div className="stat-label mb-3">Seus modelos</div>

            {carregando ? (
              <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" />
                Carregando modelos...
              </div>
            ) : editaveis.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
                  <FileText size={18} className="text-muted" />
                </div>
                <div className="section-title mb-1">Nenhum modelo ainda</div>
                <div className="section-subtitle">
                  Duplique o modelo de exemplo acima ou crie um do zero.
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {editaveis.map((modelo) => (
                  <div key={modelo.id} className="card flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
                      >
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="section-title truncate" title={modelo.nome}>
                          {modelo.nome}
                        </div>
                        <span className="badge badge-neutral mt-1.5">
                          {modelo.secoes.length}{" "}
                          {modelo.secoes.length === 1 ? "seção" : "seções"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-auto pt-1">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(modelo)}
                        className="btn btn-secondary flex-1"
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => excluir(modelo)}
                        title="Excluir modelo"
                        aria-label="Excluir modelo"
                        className="btn-ghost p-2 rounded hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
