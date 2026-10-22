"use client";

import type { ReactNode } from "react";
import {
  CalendarCheck2,
  ChevronRight,
  FilePlus,
  FileSignature,
  FileText,
  Music,
  User,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useVendas } from "@/lib/vendas-context";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useContratos } from "@/lib/contratos-context";
import { useNavegacao } from "../NavOverlay";
import { urls } from "@/lib/navegacao/rotas";
import { useModulosVisiveis } from "@/lib/navegacao/useModulos";
import { resumoContratoDoShow, rotuloContratoShow } from "@/lib/contratoDoShow";
import { STATUS_SHOW } from "@/lib/statusUI";
import { formatarDataBR, formatarMoeda } from "@/lib/formatters";

export type ChaveVinculo = "venda" | "show" | "contrato" | "orcamento" | "contratante";

/**
 * O CICLO do negócio numa caixa só: orçamento → venda → show → contrato,
 * mais o contratante. Cada linha abre a coisa (o show abre no modal com
 * endereço; o resto vai pra ficha). Usada no detalhe da venda, no modal do
 * show, no contrato e no orçamento — a tela atual se esconde via `ocultar`.
 *
 * Tudo é resolvido a partir da VENDA (é ela que liga as pontas). Link só
 * aparece pra quem consegue abrir o destino (mesma regra do menu).
 */
export default function Vinculos({
  vendaId,
  ocultar = [],
  titulo,
  embutido = false,
}: {
  vendaId: string;
  /** Pontas que NÃO aparecem (a própria tela). */
  ocultar?: ChaveVinculo[];
  /** Título da caixa. Sem título quando `embutido`. */
  titulo?: string;
  /** Dentro de um Bloco de ficha (modal do show): sem card nem título próprio. */
  embutido?: boolean;
}) {
  const t = useT();
  const { podeUI } = useAuth();
  const { vendas } = useVendas();
  const { shows } = useShows();
  const { orcamentos } = useOrcamentos();
  const { contratos, assinantesPorContrato } = useContratos();
  const { navegar, abrirSobreposicao } = useNavegacao();
  const podeVer = useModulosVisiveis();

  const venda = vendas.find((v) => v.id === vendaId);
  if (!venda) return null;

  const mostra = (k: ChaveVinculo) => !ocultar.includes(k);
  const show = venda.showId ? shows.find((s) => s.id === venda.showId) ?? null : null;
  const orcamento = venda.orcamentoId
    ? orcamentos.find((o) => o.id === venda.orcamentoId) ?? null
    : null;
  const resumo = resumoContratoDoShow(venda.id, contratos, assinantesPorContrato);
  const rotuloContrato = rotuloContratoShow(resumo, t);
  const podeFazerContrato =
    podeVer("contratos") && podeUI(venda.artistaId || null, "contratos.criar");

  const linhas: ReactNode[] = [];

  if (mostra("venda")) {
    linhas.push(
      <LinhaVinculo
        key="venda"
        icone={<CalendarCheck2 size={14} />}
        rotulo={t("Venda")}
        valor={<span className="font-mono tabular-nums">{venda.numero}</span>}
        detalhe={formatarMoeda(venda.cache, venda.moeda)}
        onClick={() => navegar(urls.venda(venda.id))}
      />
    );
  }

  if (mostra("show")) {
    const st = show ? STATUS_SHOW[show.status] : null;
    linhas.push(
      <LinhaVinculo
        key="show"
        icone={<Music size={14} />}
        rotulo={t("Show")}
        valor={show ? formatarDataBR(show.data ?? venda.dataShow) || t("Show na agenda") : t("Sem show na agenda")}
        detalhe={show ? show.venue || show.location || undefined : undefined}
        badge={st ? { texto: t(st.label), classe: st.badge } : undefined}
        onClick={show ? () => abrirSobreposicao("show", show.id) : undefined}
        apagado={!show}
      />
    );
  }

  if (mostra("contrato")) {
    if (resumo.contrato) {
      const c = resumo.contrato;
      linhas.push(
        <LinhaVinculo
          key="contrato"
          icone={<FileSignature size={14} />}
          rotulo={t("Contrato")}
          valor={<span className="font-mono tabular-nums">{c.numero}</span>}
          badge={{ texto: rotuloContrato.texto, classe: rotuloContrato.badgeClass }}
          onClick={podeVer("contratos") ? () => navegar(urls.contrato(c.id)) : undefined}
        />
      );
    } else {
      linhas.push(
        <LinhaVinculo
          key="contrato"
          icone={<FileSignature size={14} />}
          rotulo={t("Contrato")}
          valor={t("Nenhum contrato ainda")}
          apagado
          acao={
            podeFazerContrato
              ? {
                  texto: t("Fazer contrato"),
                  icone: <FilePlus size={13} />,
                  onClick: () => navegar(urls.novoContrato({ venda: venda.id })),
                }
              : undefined
          }
        />
      );
    }
  }

  if (mostra("orcamento")) {
    linhas.push(
      <LinhaVinculo
        key="orcamento"
        icone={<FileText size={14} />}
        rotulo={t("Orçamento de origem")}
        valor={
          orcamento ? (
            <span className="font-mono tabular-nums">{orcamento.numero}</span>
          ) : (
            t("Venda direta (sem orçamento)")
          )
        }
        apagado={!orcamento}
        onClick={
          orcamento && podeVer("vendas") ? () => navegar(urls.orcamento(orcamento.id)) : undefined
        }
      />
    );
  }

  if (mostra("contratante") && venda.contratanteNome) {
    linhas.push(
      <LinhaVinculo
        key="contratante"
        icone={<User size={14} />}
        rotulo={t("Contratante")}
        valor={venda.contratanteNome}
        onClick={
          venda.contratanteId && podeVer("contatos")
            ? () => navegar(urls.contato("contratantes", venda.contratanteId))
            : undefined
        }
      />
    );
  }

  if (linhas.length === 0) return null;

  const grade = (
    <div className={`grid grid-cols-1 gap-2 ${embutido ? "" : "md:grid-cols-2"}`}>{linhas}</div>
  );
  if (embutido) return grade;
  return (
    <div className="card">
      {titulo && <div className="stat-label mb-3">{titulo}</div>}
      {grade}
    </div>
  );
}

function LinhaVinculo({
  icone,
  rotulo,
  valor,
  detalhe,
  badge,
  onClick,
  acao,
  apagado = false,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: ReactNode;
  detalhe?: string;
  badge?: { texto: string; classe: string };
  /** A linha inteira abre a coisa. */
  onClick?: () => void;
  /** Ação própria (ex.: "Fazer contrato") quando a coisa ainda não existe. */
  acao?: { texto: string; icone: ReactNode; onClick: () => void };
  apagado?: boolean;
}) {
  const conteudo = (
    <>
      <span
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: "color-mix(in srgb, var(--brand) 12%, transparent)",
          color: "var(--brand)",
        }}
      >
        {icone}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-micro uppercase tracking-wider text-muted">{rotulo}</span>
        <span
          className={`truncate text-sm font-semibold ${apagado ? "text-muted font-normal" : "text-primary"}`}
        >
          {valor}
        </span>
        {detalhe && <span className="truncate text-xs text-muted">{detalhe}</span>}
      </span>
      {badge && (
        <span className={`badge ${badge.classe} flex-shrink-0`}>{badge.texto}</span>
      )}
      {onClick && <ChevronRight size={15} className="flex-shrink-0 text-muted" />}
    </>
  );
  const base =
    "flex w-full items-center gap-3 rounded-md border border-border bg-elevated px-3 py-2.5";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} transition-colors hover:border-border-strong`}
      >
        {conteudo}
      </button>
    );
  }
  return (
    <div className={base}>
      {conteudo}
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="btn btn-secondary flex-shrink-0 px-2.5 py-1.5 text-xs"
        >
          {acao.icone}
          {acao.texto}
        </button>
      )}
    </div>
  );
}
