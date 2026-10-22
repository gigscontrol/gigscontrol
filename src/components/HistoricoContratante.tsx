"use client";

import { useMemo } from "react";
import { History } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useVendas } from "@/lib/vendas-context";
import { useArtistas } from "@/lib/workspace-context";
import { useContatos } from "@/lib/contatos-context";
import { formatarMoeda, formatarData } from "@/lib/formatters";
import { urls } from "@/lib/navegacao/rotas";
import { LABELS_STATUS_ORCAMENTO, type Orcamento } from "@/types";

/**
 * Histórico comercial de um contratante (Vendas — Passo 2). Mostra os últimos
 * orçamentos e shows fechados dele pra apoiar a negociação e evitar divergência
 * de valores entre vendedores. Respeita permissões: as listas de orçamento/venda
 * já vêm filtradas do servidor pelo que o usuário pode ver.
 */
type Props = { contratanteId: string | null };

const MAX = 4;

/**
 * Um orçamento anterior em cartão compacto (histórico do contratante, da
 * cidade, do evento). O número abre o orçamento em OUTRA aba — quem está no
 * meio de um orçamento novo não perde o que já preencheu.
 */
export function CartaoOrcamento({ o, mostrarContratante = false }: { o: Orcamento; mostrarContratante?: boolean }) {
  const t = useT();
  const artistas = useArtistas();
  const { casas, cidades, contratantes } = useContatos();
  const st = LABELS_STATUS_ORCAMENTO[o.status];
  const casa = o.casaId ? casas.find((c) => String(c.id) === String(o.casaId))?.nome : "";
  const cidade = o.cidadeId ? cidades.find((c) => String(c.id) === String(o.cidadeId))?.nome : "";
  const contratante = mostrarContratante
    ? contratantes.find((c) => String(c.id) === String(o.contratanteId))?.nome
    : "";
  const linha = [
    artistas.find((a) => a.id === o.artistaId)?.name,
    contratante,
    o.detalhesEvento?.nomeEvento,
    casa || o.detalhesEvento?.nomeLocal,
    cidade,
    o.dataShow ? `${t("show")} ${fmtData(o.dataShow)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const rodape = [
    o.criadoEm ? `${t("Enviado em")} ${fmtTimestamp(o.criadoEm)}` : "",
    o.criadoPorNome ? `${t("Vendedor")}: ${o.criadoPorNome}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-md bg-surface border border-border px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <a
          href={urls.orcamento(o.id)}
          target="_blank"
          rel="noopener noreferrer"
          title={t("Abrir em outra aba")}
          className="font-mono font-bold hover:underline"
          style={{ color: "var(--brand)" }}
        >
          {o.numero}
        </a>
        <span className={`badge ${st.badge}`}>{t(st.label)}</span>
        <span className="font-semibold tabular-nums text-primary ml-auto">
          {formatarMoeda(o.valorCache, o.moeda)}
        </span>
      </div>
      {linha && <div className="text-muted mt-1">{linha}</div>}
      {rodape && <div className="text-muted mt-0.5">{rodape}</div>}
      {o.observacoes && <div className="text-secondary mt-0.5 truncate italic">“{o.observacoes}”</div>}
    </div>
  );
}

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

      {vnds.length > 0 && (
        <div className="mb-3">
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
                    <a
                      href={urls.venda(v.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t("Abrir em outra aba")}
                      className="font-mono font-bold hover:underline"
                      style={{ color: "var(--success)" }}
                    >
                      {v.numero}
                    </a>
                    {v.status === "cancelada" && <span className="badge badge-danger">{t("Cancelada")}</span>}
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

      {orcs.length > 0 && (
        <div>
          <div className="stat-label mb-1.5">
            {t("Últimos orçamentos")} · {orcs.length}
          </div>
          <div className="flex flex-col gap-1.5">
            {orcs.slice(0, MAX).map((o) => (
              <CartaoOrcamento key={o.id} o={o} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const fmtTimestamp = (iso?: string) => formatarData(iso);
const fmtData = (iso?: string) => formatarData(iso);
