"use client";

import Modal from "./Modal";
import { useT } from "@/lib/i18n";
import { formatarMoeda, formatarDataBR } from "@/lib/formatters";
import type { Moeda } from "@/types";
import { CalendarCheck2 } from "lucide-react";

export type ResumoVenda = {
  artistaNome: string;
  artistaCor: string;
  contratanteNome: string;
  nomeEvento: string;
  nomeLocal: string;
  cidadeNome: string;
  dataShow: string; // ISO
  horario: string; // "" = a definir
  cache: number;
  moeda: Moeda;
  qtdParcelas: number;
};

/**
 * Confirmação final antes de CONCRETIZAR a venda (I5). O medo real que ela
 * fecha: clicar no artista errado no meio do form e a venda ir pro artista
 * errado — por isso o ARTISTA é a primeira linha e a mais gritada do resumo.
 * Só na criação; a edição tem o próprio fluxo de salvar.
 */
export default function ConfirmarVendaModal({
  resumo,
  onConfirmar,
  onVoltar,
  salvando,
}: {
  resumo: ResumoVenda;
  onConfirmar: () => void;
  onVoltar: () => void;
  salvando: boolean;
}) {
  const t = useT();
  const linha = (rotulo: string, valor: string) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted uppercase tracking-wide shrink-0">{rotulo}</span>
      <span className="text-sm text-primary text-right font-medium">{valor}</span>
    </div>
  );

  return (
    <Modal isOpen onClose={onVoltar} title={t("Confirmar venda?")} maxWidth={440}>
      {/* Artista em destaque — a linha que evita a venda no artista errado. */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-md border mb-3"
        style={{
          borderColor: resumo.artistaCor,
          boxShadow: `0 0 0 1px ${resumo.artistaCor}`,
        }}
      >
        <span
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: resumo.artistaCor, color: "#fff" }}
        >
          {resumo.artistaNome.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="text-[0.65rem] text-muted uppercase tracking-wide">{t("Artista")}</div>
          <div className="text-sm font-bold text-primary truncate">{resumo.artistaNome}</div>
        </div>
      </div>

      <div className="mb-4">
        {linha(t("Contratante"), resumo.contratanteNome || "—")}
        {linha(t("Evento"), resumo.nomeEvento || "—")}
        {linha(t("Local"), [resumo.nomeLocal, resumo.cidadeNome].filter(Boolean).join(" · ") || "—")}
        {linha(
          t("Data"),
          `${formatarDataBR(resumo.dataShow)}${resumo.horario ? ` · ${resumo.horario}` : ` · ${t("horário a definir")}`}`
        )}
        {linha(t("Cachê"), formatarMoeda(resumo.cache, resumo.moeda))}
        {linha(
          t("Pagamento"),
          resumo.qtdParcelas === 1
            ? t("1 parcela")
            : t("{n} parcelas", { n: String(resumo.qtdParcelas) })
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onVoltar} className="btn btn-secondary" disabled={salvando}>
          {t("Voltar")}
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={salvando}
          className="btn"
          style={{ backgroundColor: "var(--success)", color: "#fff", opacity: salvando ? 0.6 : 1 }}
        >
          <CalendarCheck2 size={15} />
          {salvando ? t("Salvando...") : t("Confirmar venda")}
        </button>
      </div>
    </Modal>
  );
}
