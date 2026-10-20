"use client";

import { Music, Calendar, Plane, Car } from "lucide-react";
import Modal from "../Modal";
import { useT } from "@/lib/i18n";
import { DayCell } from "./calendario";

export const ACOES_NOVO_ITEM: {
  key: string;
  label: string;
  desc: string;
  icon: typeof Music;
  cor: string;
  emBreve?: boolean;
}[] = [
  { key: "show", label: "Nova venda", desc: "Show neste dia (cria a venda e o show)", icon: Music, cor: "var(--brand)" },
  { key: "voo", label: "Novo Voo", desc: "Voo com passageiros (busca por número)", icon: Plane, cor: "var(--brand)" },
  {
    key: "transporte",
    label: "Novo Transporte Terrestre",
    desc: "Transfer/van com motorista",
    icon: Car,
    cor: "var(--brand)",
  },
  {
    key: "evento",
    label: "Novo Evento Personalizado",
    desc: "Reserva o dia ou um horário",
    icon: Calendar,
    cor: "var(--brand)",
  },
];

/** Action-sheet do "+": escolhe o tipo de item a adicionar no dia.
 *  Usa o Modal do app (portal pra document.body) → sempre centralizado na
 *  viewport, sem o bug de `fixed` ancorando no <main> com transform. */
export function NovoItemModal({
  day,
  podeCriarItem,
  podeCriarShow,
  onClose,
  onNovoShow,
  onNovoEvento,
  onNovoVoo,
  onNovoTransporte,
}: {
  day: DayCell;
  /** agenda.criar — voo, transporte terrestre e evento personalizado. */
  podeCriarItem: boolean;
  /** vendas.criar — "Novo Show" (não é mais permissão de agenda). */
  podeCriarShow: boolean;
  onClose: () => void;
  onNovoShow: () => void;
  onNovoEvento: () => void;
  onNovoVoo: () => void;
  onNovoTransporte: () => void;
}) {
  const t = useT();
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t("Adicionar ao dia")}
      subtitle={`${t(day.name)} · ${day.date}`}
      maxWidth={400}
    >
      <div className="flex flex-col gap-1">
        {ACOES_NOVO_ITEM.filter((a) =>
          // L5c — gate POR CHAVE, não um só pra todos:
          //   voo/transporte/evento → agenda.criar (item de agenda);
          //   show                  → vendas.criar (abre a Nova Venda
          //                           Direta; agenda.criar NÃO serve mais).
          // ESCONDE, não desabilita: o dono pediu que "Novo Show" só APAREÇA
          // pra quem tem vendas.criar. Diverge do grey-out usado no resto
          // do app de propósito — aqui o pedido foi literal, e um item cinza
          // vaza a existência da ação pra quem não pode executá-la.
          a.key === "show" ? podeCriarShow : podeCriarItem
        ).map((a) => {
          const Icone = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              disabled={a.emBreve}
              onClick={
                a.key === "show"
                  ? onNovoShow
                  : a.key === "evento"
                    ? onNovoEvento
                    : a.key === "voo"
                      ? onNovoVoo
                      : a.key === "transporte"
                        ? onNovoTransporte
                        : undefined
              }
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors enabled:hover:bg-elevated disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <span
                className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `color-mix(in srgb, ${a.cor} 16%, transparent)`,
                  color: a.cor,
                }}
              >
                <Icone size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-primary">{t(a.label)}</span>
                <span className="block text-xs text-muted">{t(a.desc)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
