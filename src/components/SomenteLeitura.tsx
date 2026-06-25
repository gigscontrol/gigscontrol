"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";

/**
 * Em modo visitante (super-admin visualizando a dashboard de um cliente),
 * tudo continua VISÍVEL e navegável, mas qualquer ação de escrita
 * (criar, salvar, editar, excluir, informar pagamento) é bloqueada.
 *
 * Como funciona:
 *  - Envolve a área de conteúdo da dashboard.
 *  - Em modo visitante, intercepta cliques na fase de captura.
 *  - Botões marcados com data-acao="navegar" continuam funcionando
 *    (trocar de aba, abrir detalhe, voltar, fechar modal...).
 *  - Botões de escrita (qualquer <button> não marcado como navegar,
 *    e todos os submits de formulário) são bloqueados e mostram um aviso.
 *
 * Telas e botões de leitura/navegação NÃO precisam de marcação.
 * Para liberar um botão específico, adicione data-acao="navegar".
 */

/** Heurística: o elemento dispara escrita? (criar/salvar/editar/excluir) */
function ehAcaoDeEscrita(el: HTMLElement): boolean {
  // Sobe até achar um botão ou link
  const alvo = el.closest("button, [role='button'], a") as HTMLElement | null;
  if (!alvo) return false;

  // Liberado explicitamente
  if (alvo.dataset.acao === "navegar") return false;
  // Bloqueado explicitamente
  if (alvo.dataset.acao === "escrita") return true;

  const txt = (alvo.textContent || "").toLowerCase().trim();
  // Apenas AÇÕES FINAIS de escrita. Botões que só navegam para um
  // formulário (ex: "Novo Orçamento" no dashboard) NÃO entram aqui —
  // o visitante pode abrir e ver a tela, só não consegue salvar.
  const PALAVRAS_ESCRITA = [
    "salvar",
    "concretizar venda",
    "transformar em venda",
    "excluir",
    "remover",
    "apagar",
    "informar pagamento",
    "desfazer",
    "confirmar",
    "gerar venda",
    "registrar venda",
    "criar orçamento",
    "criar venda",
    "adicionar parcela",
    "adicionar dj",
    "+ dj",
    "salvar alterações",
  ];
  return PALAVRAS_ESCRITA.some((p) => txt.includes(p));
}

export default function SomenteLeitura({
  children,
}: {
  children: React.ReactNode;
}) {
  const { modoVisitante } = useAuth();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modoVisitante) return;
    const node = ref.current;
    if (!node) return;

    const msg = t("Modo visualização — criar e editar estão desativados.");

    function bloquear(e: Event) {
      const alvo = e.target as HTMLElement;
      if (!alvo) return;
      if (ehAcaoDeEscrita(alvo)) {
        e.preventDefault();
        e.stopPropagation();
        avisar(msg);
      }
    }
    function bloquearSubmit(e: Event) {
      e.preventDefault();
      e.stopPropagation();
      avisar(msg);
    }

    // Fase de captura — intercepta antes de qualquer handler do React
    node.addEventListener("click", bloquear, true);
    node.addEventListener("submit", bloquearSubmit, true);
    return () => {
      node.removeEventListener("click", bloquear, true);
      node.removeEventListener("submit", bloquearSubmit, true);
    };
  }, [modoVisitante]);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

// ---- Aviso flutuante (toast simples, sem dependências) ----
let avisoTimeout: ReturnType<typeof setTimeout> | null = null;

function avisar(msg: string) {
  const ID = "gigscontrol-aviso-visitante";
  let el = document.getElementById(ID);
  if (!el) {
    el = document.createElement("div");
    el.id = ID;
    el.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:9999",
      "background:var(--module-vendas,#a855f7)",
      "color:#fff",
      "padding:10px 18px",
      "border-radius:8px",
      "font-size:13px",
      "font-weight:600",
      "box-shadow:0 8px 24px rgba(0,0,0,0.4)",
      "pointer-events:none",
      "transition:opacity .2s ease",
    ].join(";");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  if (avisoTimeout) clearTimeout(avisoTimeout);
  avisoTimeout = setTimeout(() => {
    if (el) el.style.opacity = "0";
  }, 2200);
}
