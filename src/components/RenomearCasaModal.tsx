"use client";

import { Building2 } from "lucide-react";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

export type EscolhaRenomearCasa = "renomear" | "manter";

/**
 * K1 — o nome do local mudou na EDIÇÃO da venda e a venda já tem casa vinculada
 * ("LVL CLUB" virou "LVL Club"). A casa é registro COMPARTILHADO: ela aparece em
 * shows e vendas antigos, então renomear o cadastro reescreve o histórico de
 * todo mundo.
 *
 * Mesma doutrina do CasaParecidaModal: NUNCA renomeia em silêncio.
 * - "Renomear o cadastro" → PATCH na casa (afeta o histórico), a exibição
 *   acompanha em todo lugar.
 * - "Só nesta venda" → o cadastro fica intacto; muda apenas o texto da venda.
 * - Fechar (X / clique-fora / ESC) → MANTER o cadastro. Não decidir não é opção:
 *   o submit está esperando essa Promise, e o caminho seguro é o de hoje.
 *
 * Diferença de caixa/acento CONTA: `normalizar()` iguala "CLUB" e "Club", por
 * isso a comparação que abre este popup é LITERAL (ver `resolverCasaId`).
 */
export default function RenomearCasaModal({
  aberto,
  nomeAtual,
  nomeNovo,
  onEscolher,
  onFechar,
}: {
  aberto: boolean;
  nomeAtual: string;
  nomeNovo: string;
  onEscolher: (r: EscolhaRenomearCasa) => void;
  onFechar: () => void;
}) {
  const t = useT();
  if (!aberto) return null;

  return (
    <Modal isOpen onClose={onFechar} title={t("Renomear o cadastro do local?")} maxWidth={520}>
      <div className="flex items-start gap-3 mb-4">
        <span
          className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "color-mix(in srgb, var(--info) 12%, transparent)",
            color: "var(--info)",
          }}
        >
          <Building2 size={18} />
        </span>
        <p className="text-sm text-secondary leading-relaxed">
          {t(
            'O local desta venda está cadastrado como "{atual}" e você escreveu "{novo}".',
            { atual: nomeAtual, novo: nomeNovo }
          )}
        </p>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        {t(
          "Esse local aparece em shows já cadastrados — trocar o nome atualiza o histórico também. Se preferir, o cadastro fica como está e o nome novo vale só para esta venda."
        )}
      </p>

      <div className="flex items-center justify-end gap-2 flex-wrap mt-5">
        <button onClick={() => onEscolher("manter")} className="btn btn-secondary text-sm">
          {t("Só nesta venda")}
        </button>
        <button onClick={() => onEscolher("renomear")} className="btn btn-primary text-sm">
          {t("Renomear o cadastro")}
        </button>
      </div>
    </Modal>
  );
}
