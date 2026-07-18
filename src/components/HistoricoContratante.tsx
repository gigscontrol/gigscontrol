"use client";

import { useMemo } from "react";
import { History } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { useContatos } from "@/lib/contatos-context";
import { formatarMoeda } from "@/lib/formatters";
import { LABELS_STATUS_ORCAMENTO } from "@/types";

/**
 * Histórico comercial de um contratante (Vendas — Passo 2). Mostra os últimos
 * orçamentos e shows fechados dele pra apoiar a negociação e evitar divergência
 * de valores entre vendedores. Respeita permissões: as listas de orçamento/venda
 * já vêm filtradas do servidor pelo que o usuário pode ver.
 */
type Props = { contratanteId: string | null };

const MAX = 4;

export default function HistoricoContratante({ contratanteId }: Props) {
  const t = useT();
  const { orcamentos } = useOrcamentos();
  const { vendas } = useVendas();
  const artistas = useArtistas();
  const { casas, cidades } = useContatos();

  const { orcs, vnds } = useMemo(() => {
    if (!contratanteId) return { orcs: [], vnds: [] };
    const idc = String(contratanteId);
    const orcs = orcamentos
      .filter((o) => String(o.contratanteId) === idc)
      .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
    const vnds = vendas
      .filter((v) => String(v.contratanteId) === idc)
      .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
    return { orcs, vnds };
  }, [contratanteId, orcamentos, vendas]);

  if (!contratanteId || (orcs.length === 0 && vnds.length === 0)) return null;

  const nomeArtista = (id: string) => artistas.find((a) => a.id === id)?.name ?? "—";
  const nomeCidade = (id?: string) =>
    (id ? cidades.find((c) => String(c.id) === String(id))?.nome : "") ?? "";
  const nomeCasa = (id?: string) =>
    (id ? casas.find((c) => String(c.id) === String(id))?.nome : "") ?? "";

  return (
    <div
      className="rounded-lg border p-4 mt-4"
      style={{ borderColor: "var(--warning)", background: "var(--warning-weak)" }}
    >
      <div className="flex items-center gap-2">
        <History size={15} style={{ color: "var(--warning)" }} />
        <span className="text-sm font-bold text-primary">
          {t("Histórico deste contratante")}
        </span>
      </div>
      <p className="text-xs text-muted mt-0.5 mb-3">
        {t("Apoio à negociação — confira valores já passados pra não divergir de outro vendedor.")}
      </p>

      {orcs.length > 0 && (
        <div className="mb-3">
          <div className="stat-label mb-1.5">
            {t("Últimos orçamentos")} · {orcs.length}
          </div>
          <div className="flex flex-col gap-1.5">
            {orcs.slice(0, MAX).map((o) => {
              const st = LABELS_STATUS_ORCAMENTO[o.status];
              const local = nomeCasa(o.casaId) || o.detalhesEvento?.nomeLocal || "";
              const linha = [
                nomeArtista(o.artistaId),
                o.detalhesEvento?.nomeEvento,
                local,
                nomeCidade(o.cidadeId),
                fmtTimestamp(o.criadoEm),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={o.id} className="rounded-md bg-surface border border-border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono font-bold" style={{ color: "var(--brand)" }}>
                      {o.numero}
                    </span>
                    <span className={`badge ${st.badge}`}>{t(st.label)}</span>
                    <span className="font-semibold tabular-nums text-primary ml-auto">
                      {formatarMoeda(o.valorCache, o.moeda)}
                    </span>
                  </div>
                  {linha && <div className="text-muted mt-1">{linha}</div>}
                  {o.criadoPorNome && (
                    <div className="text-muted mt-0.5">
                      {t("Vendedor")}: {o.criadoPorNome}
                    </div>
                  )}
                  {o.observacoes && (
                    <div className="text-secondary mt-0.5 truncate italic">“{o.observacoes}”</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vnds.length > 0 && (
        <div>
          <div className="stat-label mb-1.5">
            {t("Shows fechados")} · {vnds.length}
          </div>
          <div className="flex flex-col gap-1.5">
            {vnds.slice(0, MAX).map((v) => {
              const linha = [
                nomeArtista(v.artistaId),
                v.nomeEvento,
                v.nomeLocal || nomeCasa(v.casaId),
                nomeCidade(v.cidadeId),
                fmtData(v.dataShow),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={v.id} className="rounded-md bg-surface border border-border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono font-bold" style={{ color: "var(--success)" }}>
                      {v.numero}
                    </span>
                    <span className="font-semibold tabular-nums text-primary ml-auto">
                      {formatarMoeda(v.cache, v.moeda)}
                    </span>
                  </div>
                  {linha && <div className="text-muted mt-1">{linha}</div>}
                  {v.criadoPorNome && (
                    <div className="text-muted mt-0.5">
                      {t("Vendedor")}: {v.criadoPorNome}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** timestamp ISO → DD/MM/AAAA. */
function fmtTimestamp(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "YYYY-MM-DD" → DD/MM/AAAA (ancorada ao meio-dia, sem pulo de fuso). */
function fmtData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
