"use client";

import { useState } from "react";
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import PageHeader from "../PageHeader";
import EditorModelo from "./EditorModelo";
import { useModelos } from "@/lib/modelos-context";
import { useAuth } from "@/lib/auth-context";
import { getPlano } from "@/lib/planos";
import { useT } from "@/lib/i18n";
import type {
  ContratoModelo,
  SecaoModelo,
  EstiloModelo,
} from "@/lib/mappers/contratoModelo";
import { ESTILO_PADRAO } from "@/lib/mappers/contratoModelo";
import {
  NOME_MODELO_EXEMPLO,
  SECOES_MODELO_EXEMPLO,
} from "@/lib/contratos/modeloExemplo";

const ACCENT = "#14b8a6";

type Vista = "lista" | "editor";

/**
 * Estado inicial do editor quando aberto. `modeloId` null = criação de um
 * modelo novo (ainda não salvo).
 */
type EditorInicial = {
  modeloId: string | null;
  nome: string;
  secoes: SecaoModelo[];
  estilo: EstiloModelo;
};

/**
 * Clona seções gerando ids NOVOS (para o "Duplicar e editar" do exemplo).
 * Faz `switch` por `tipo` para preservar todos os campos e regenerar também
 * os ids dos itens das cláusulas.
 */
function clonarSecoes(secoes: SecaoModelo[]): SecaoModelo[] {
  return secoes.map((s): SecaoModelo => {
    const id = crypto.randomUUID();
    switch (s.tipo) {
      case "titulo":
        return { id, tipo: "titulo", titulo: s.titulo, subtitulo: s.subtitulo };
      case "partes":
        return {
          id,
          tipo: "partes",
          contratante: s.contratante,
          contratado: s.contratado,
          paragrafo: s.paragrafo,
        };
      case "clausula":
        return {
          id,
          tipo: "clausula",
          titulo: s.titulo,
          itens: s.itens.map((i) => ({
            id: crypto.randomUUID(),
            tipo: i.tipo,
            texto: i.texto,
          })),
        };
      case "assinaturas":
        return { id, tipo: "assinaturas", testemunhas: s.testemunhas };
      case "anexo":
        return { id, tipo: "anexo", titulo: s.titulo, conteudo: s.conteudo };
    }
  });
}

/**
 * Cópia estrutural de seções PRESERVANDO os ids (para editar um modelo
 * existente — só o "Duplicar" gera ids novos).
 */
function copiarSecoes(secoes: SecaoModelo[]): SecaoModelo[] {
  return secoes.map((s): SecaoModelo =>
    s.tipo === "clausula" ? { ...s, itens: s.itens.map((i) => ({ ...i })) } : { ...s }
  );
}

export default function ModelosPage() {
  const t = useT();
  const { modelos, carregando, removerModelo } = useModelos();
  const { sessao } = useAuth();

  const [vista, setVista] = useState<Vista>("lista");
  const [editando, setEditando] = useState<EditorInicial | null>(null);

  // Apenas modelos editáveis nesta tela (PDF é um sub-passo futuro).
  const editaveis = modelos.filter((m) => m.tipo === "editavel");

  // Limite de modelos do plano (mesmo padrão da aba Equipe): usado/limite +
  // bloqueio dos botões de criação + banner ao atingir o teto.
  const plano = sessao?.workspace ? getPlano(sessao.workspace.plano) : null;
  const limite = plano?.maxModelos ?? 0;
  const usados = editaveis.length;
  const noLimite = !!plano && usados >= limite;

  // ---- Aberturas do editor ----

  function abrirExemplo() {
    setEditando({
      modeloId: null,
      nome: NOME_MODELO_EXEMPLO,
      secoes: clonarSecoes(SECOES_MODELO_EXEMPLO),
      estilo: ESTILO_PADRAO,
    });
    setVista("editor");
  }

  function abrirNovoEmBranco() {
    // Em branco: sem seções — o usuário adiciona pelo menu "Adicionar seção".
    setEditando({ modeloId: null, nome: "", secoes: [], estilo: ESTILO_PADRAO });
    setVista("editor");
  }

  function abrirEdicao(modelo: ContratoModelo) {
    setEditando({
      modeloId: modelo.id,
      nome: modelo.nome,
      // Cópia estrutural preservando os ids (não regenera como o "Duplicar").
      secoes: copiarSecoes(modelo.secoes),
      estilo: modelo.estilo,
    });
    setVista("editor");
  }

  function voltarParaLista() {
    setVista("lista");
    setEditando(null);
  }

  async function excluir(modelo: ContratoModelo) {
    if (!window.confirm(t("Excluir o modelo \"{nome}\"? Esta ação não pode ser desfeita.", { nome: modelo.nome }))) {
      return;
    }
    try {
      await removerModelo(modelo.id);
    } catch (e) {
      window.alert((e as Error).message || t("Não foi possível excluir o modelo."));
    }
  }

  // ---- Render ----

  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title="Modelos de contrato"
        subtitle={
          plano
            ? t("Plano {nome} — {usados} de {limite} modelos", {
                nome: plano.nome,
                usados,
                limite,
              })
            : "Monte os modelos que vão gerar seus contratos"
        }
        accentColor={ACCENT}
        actions={
          plano ? (
            <div className="min-w-[160px]">
              <div className="text-right">
                <span className="text-2xl font-bold tabular-nums text-primary">
                  {usados}
                </span>
                <span className="text-muted text-base font-normal"> / {limite}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${limite > 0 ? Math.min(100, (usados / limite) * 100) : 0}%`,
                    backgroundColor: noLimite ? "var(--danger)" : ACCENT,
                  }}
                />
              </div>
            </div>
          ) : undefined
        }
      />

      {vista === "lista" && noLimite && (
        <div
          className="flex items-start gap-2 text-sm rounded-md px-3 py-2.5 mb-6"
          style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "var(--warning)" }}
        >
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            {t(
              "Limite de modelos do plano {nome} atingido. Faça upgrade ou exclua um modelo para criar outro.",
              { nome: plano?.nome ?? "" }
            )}
          </span>
        </div>
      )}

      {vista === "editor" && editando ? (
        <EditorModelo
          modeloId={editando.modeloId}
          nomeInicial={editando.nome}
          secoesIniciais={editando.secoes}
          estiloInicial={editando.estilo}
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
                      {t("Comece por aqui")}
                    </span>
                  </div>
                  <div className="section-title mt-1.5">{NOME_MODELO_EXEMPLO}</div>
                  <p className="section-subtitle mt-1 max-w-2xl">
                    {t("Modelo pronto de apresentação artística, com seções automáticas (variáveis já posicionadas) e cláusulas para você completar. Duplique e ajuste do seu jeito.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={abrirExemplo}
                disabled={noLimite}
                title={noLimite ? t("Limite de modelos do plano atingido") : undefined}
                className="btn flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: ACCENT, color: "#fff" }}
              >
                <Copy size={15} />
                {t("Duplicar e editar")}
              </button>
            </div>
          </div>

          {/* Ação: novo modelo em branco */}
          <div>
            <button
              type="button"
              onClick={abrirNovoEmBranco}
              disabled={noLimite}
              title={noLimite ? t("Limite de modelos do plano atingido") : undefined}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={15} />
              {t("Novo modelo em branco")}
            </button>
          </div>

          {/* Lista dos modelos do workspace */}
          <div>
            <div className="stat-label mb-3">{t("Seus modelos")}</div>

            {carregando ? (
              <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" />
                {t("Carregando modelos...")}
              </div>
            ) : editaveis.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-elevated flex items-center justify-center mb-3">
                  <FileText size={18} className="text-muted" />
                </div>
                <div className="section-title mb-1">{t("Nenhum modelo ainda")}</div>
                <div className="section-subtitle">
                  {t("Duplique o modelo de exemplo acima ou crie um do zero.")}
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
                          {modelo.secoes.length === 1 ? t("seção") : t("seções")}
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
                        {t("Editar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => excluir(modelo)}
                        title={t("Excluir modelo")}
                        aria-label={t("Excluir modelo")}
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
