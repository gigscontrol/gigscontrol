"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Estados de carga/erro das telas que leem os contexts de dados.
 *
 * Auditoria 27/08/2026 (achado ALTO de UX): os contexts sempre expuseram
 * `carregando`/`erro`, mas só o DashboardContratos consumia — falha de API
 * virava "Nenhuma venda fechada" (indistinguível de conta vazia) e o cold
 * load mostrava um flash de tela vazia. Este componente replica o padrão do
 * DashboardContratos pra qualquer tela em 3 linhas:
 *
 *   const guarda = <EstadoCarga carregando={carregando} erro={erro} aoTentar={recarregar} />;
 *   if (guarda) return <>{header}{guarda}</>;   // ou renderize inline
 *
 * Devolve null quando não há nada a cobrir (dados prontos e sem erro).
 */
export function EstadoCarga({
  carregando,
  erro,
  aoTentar,
  rotulo,
}: {
  carregando: boolean;
  erro: string | null;
  /** Chamado pelo botão "Tentar de novo" do estado de erro. */
  aoTentar?: () => void;
  /** Nome do dado no spinner (ex: "vendas"). Default: "dados". */
  rotulo?: string;
}) {
  const t = useT();

  if (erro) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="text-sm text-danger">{erro}</div>
        {aoTentar && (
          <button
            type="button"
            onClick={aoTentar}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            {t("Tentar de novo")}
          </button>
        )}
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="card flex items-center justify-center gap-2 py-12 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        {t("Carregando {que}...", { que: rotulo ?? t("dados") })}
      </div>
    );
  }

  return null;
}
