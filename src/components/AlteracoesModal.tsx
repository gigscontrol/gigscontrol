"use client";

import { useT } from "@/lib/i18n";
import Modal from "./Modal";
import type { HistoricoAcao } from "@/lib/mappers/historico";

/**
 * Popup do rastro (D4): mostra O QUE mudou numa ação da venda — o diff
 * campo-a-campo que o servidor gravou em `historico_acoes.dados`.
 *
 * NÃO reformata nada: `antes`/`depois` já vêm formatados pra humano do
 * vendaDiff.ts (R$ 1.400,00, nome da casa em vez de uuid) e os rótulos vêm em
 * PT de propósito — é registro histórico, não UI traduzível.
 */

export type AlteracaoRastro = {
  campo: string;
  rotulo: string;
  antes: string;
  depois: string;
};

/**
 * Lê o `dados` defensivamente: registro antigo (pré-rastro), de outra `versao`
 * ou torto não pode quebrar a tela do detalhe — só vem lista vazia.
 */
export function lerAlteracoes(dados: Record<string, unknown> | null): AlteracaoRastro[] {
  const brutas = (dados as { alteracoes?: unknown } | null)?.alteracoes;
  if (!Array.isArray(brutas)) return [];
  return brutas.filter(
    (a): a is AlteracaoRastro =>
      !!a &&
      typeof a === "object" &&
      typeof (a as AlteracaoRastro).rotulo === "string" &&
      typeof (a as AlteracaoRastro).antes === "string" &&
      typeof (a as AlteracaoRastro).depois === "string"
  );
}

export function lerMotivo(dados: Record<string, unknown> | null): string | null {
  const motivo = (dados as { motivo?: unknown } | null)?.motivo;
  return typeof motivo === "string" && motivo.trim() ? motivo.trim() : null;
}

export function lerParcelas(
  dados: Record<string, unknown> | null
): { recalculadas?: boolean; motivo?: string } | null {
  const p = (dados as { parcelas?: unknown } | null)?.parcelas;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  return p as { recalculadas?: boolean; motivo?: string };
}

/** true quando há conteúdo pro popup — senão o botão "Ver alterações" nem aparece. */
export function temDetalhe(acao: HistoricoAcao): boolean {
  return (
    lerAlteracoes(acao.dados).length > 0 ||
    !!lerMotivo(acao.dados) ||
    lerParcelas(acao.dados)?.recalculadas === false
  );
}

export default function AlteracoesModal({
  aberto,
  onFechar,
  acao,
}: {
  aberto: boolean;
  onFechar: () => void;
  acao: HistoricoAcao;
}) {
  const t = useT();
  const alteracoes = lerAlteracoes(acao.dados);
  const motivo = lerMotivo(acao.dados);
  const parcelas = lerParcelas(acao.dados);
  const quando = new Date(acao.criadoEm);

  return (
    <Modal
      isOpen={aberto}
      onClose={onFechar}
      title={t("Alterações")}
      subtitle={`${acao.actorNome ?? acao.actorEmail ?? t("Alguém")} · ${quando.toLocaleDateString(
        "pt-BR"
      )} ${t("às")} ${quando.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`}
      maxWidth={520}
    >
      <div className="flex flex-col gap-4">
        <div className="text-sm text-secondary">{acao.descricao}</div>

        {motivo && (
          <div className="text-sm text-secondary">
            <span className="text-muted">{t("Motivo:")}</span> {motivo}
          </div>
        )}

        {parcelas?.recalculadas === false && (
          <div>
            <span className="badge badge-warning">{t("Parcelas não recalculadas")}</span>
            {parcelas.motivo ? (
              <span className="text-xs text-muted ml-2">{parcelas.motivo}</span>
            ) : null}
          </div>
        )}

        {alteracoes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {alteracoes.map((a) => (
              <li
                key={a.campo}
                className="rounded-md border border-border p-2.5 flex flex-col gap-1"
              >
                <div className="stat-label">{a.rotulo}</div>
                <div className="text-sm flex flex-wrap items-center gap-1.5">
                  <s className="text-muted">{a.antes}</s>
                  <span className="text-muted">→</span>
                  <strong className="text-primary">{a.depois}</strong>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted">
            {t("Nenhuma alteração de campo foi registrada nesta ação.")}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <button onClick={onFechar} className="btn btn-secondary text-sm">
            {t("Fechar")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
