"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarSearch, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContatos } from "@/lib/contatos-context";
import {
  idsDaCidade,
  orcamentosDaCidade,
  orcamentosDoEvento,
  type CidadeAlvo,
} from "@/lib/orcamentosAnteriores";
import type { Orcamento } from "@/types";
import { CartaoOrcamento } from "./HistoricoContratante";

const MAX = 5;

/**
 * Prévia dos orçamentos que já saíram pra mesma cidade / mesmo evento, no
 * Novo orçamento — apoio pra não passar valor diferente do que já foi
 * passado (pedido do Bruno, 21/10/2026). Some quando não há nada.
 */
function ListaAnteriores({
  icone,
  titulo,
  orcamentos,
}: {
  icone: ReactNode;
  titulo: string;
  orcamentos: Orcamento[];
}) {
  const t = useT();
  if (orcamentos.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4 mt-3">
      <div className="flex items-center gap-2 mb-2.5">
        {icone}
        <span className="text-sm font-bold text-primary">{titulo}</span>
        <span className="badge badge-neutral tabular-nums">{orcamentos.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {orcamentos.slice(0, MAX).map((o) => (
          <CartaoOrcamento key={o.id} o={o} mostrarContratante />
        ))}
      </div>
      {orcamentos.length > MAX && (
        <div className="text-xs text-muted mt-2">
          {t("Mostrando os {n} mais recentes de {total}.", { n: MAX, total: orcamentos.length })}
        </div>
      )}
    </div>
  );
}

/** Últimos orçamentos enviados pra cidade escolhida. */
export function OrcamentosDaCidade({ cidade }: { cidade: CidadeAlvo | null }) {
  const t = useT();
  const { orcamentos } = useOrcamentos();
  const { cidades } = useContatos();
  const lista = useMemo(
    () => (cidade ? orcamentosDaCidade(orcamentos, idsDaCidade(cidade, cidades)) : []),
    [cidade, orcamentos, cidades]
  );
  if (!cidade) return null;
  return (
    <ListaAnteriores
      icone={<MapPin size={15} style={{ color: "var(--brand)" }} />}
      titulo={t("Últimos orçamentos para {cidade}", { cidade: `${cidade.nome}${cidade.uf ? `/${cidade.uf}` : ""}` })}
      orcamentos={lista}
    />
  );
}

/** Últimos orçamentos do mesmo evento ou local (orçamento detalhado). */
export function OrcamentosDoEvento({ nomeEvento, nomeLocal }: { nomeEvento: string; nomeLocal: string }) {
  const t = useT();
  const { orcamentos } = useOrcamentos();
  const { casas } = useContatos();
  const lista = useMemo(
    () => orcamentosDoEvento(orcamentos, casas, [nomeEvento, nomeLocal]),
    [orcamentos, casas, nomeEvento, nomeLocal]
  );
  return (
    <ListaAnteriores
      icone={<CalendarSearch size={15} style={{ color: "var(--brand)" }} />}
      titulo={t("Orçamentos anteriores deste evento / local")}
      orcamentos={lista}
    />
  );
}
