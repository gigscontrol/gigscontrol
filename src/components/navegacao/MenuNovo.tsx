"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useNavegacao } from "../NavOverlay";
import { useAcoesNovo, type AcaoNovo } from "./acoesNovo";

function ListaAcoes({ acoes, onEscolher }: { acoes: AcaoNovo[]; onEscolher: (a: AcaoNovo) => void }) {
  const t = useT();
  return (
    <div className="flex flex-col p-1.5">
      {acoes.map((a) => {
        const Icone = a.icone;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onEscolher(a)}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-elevated"
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
              style={{
                backgroundColor: "color-mix(in srgb, var(--brand) 12%, transparent)",
                color: "var(--brand)",
              }}
            >
              <Icone size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-primary">{t(a.rotulo)}</span>
              <span className="block truncate text-xs text-muted">{t(a.descricao)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "+ Novo" da barra do topo (computador). Some se a pessoa não pode criar nada. */
export function BotaoNovo() {
  const t = useT();
  const acoes = useAcoesNovo();
  const { navegar } = useNavegacao();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  if (acoes.length === 0) return null;
  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        // Mesmo desenho dos vizinhos da barra (busca, sino, idioma, tema):
        // contorno, h-9, texto normal — o "+" azul já destaca sem pesar.
        className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-secondary transition-colors hover:border-border-strong hover:text-primary"
      >
        <Plus size={15} style={{ color: "var(--brand)" }} />
        {t("Novo")}
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-surface animate-in"
          style={{ boxShadow: "0 12px 30px var(--shadow-color)" }}
        >
          <ListaAcoes
            acoes={acoes}
            onEscolher={(a) => {
              setAberto(false);
              navegar(a.href);
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Folha de baixo do celular com as mesmas ações (aberta pelo "+" da barra). */
export function FolhaNovo({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const t = useT();
  const acoes = useAcoesNovo();
  const { navegar } = useNavegacao();
  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("Criar")}>
      <button
        type="button"
        aria-label={t("Fechar")}
        onClick={onFechar}
        className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm animate-fade"
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] animate-in"
        style={{ boxShadow: "0 -12px 30px var(--shadow-color)" }}
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="stat-label">{t("Criar")}</span>
          <button type="button" onClick={onFechar} className="btn-ghost rounded p-2" aria-label={t("Fechar")}>
            <X size={16} />
          </button>
        </div>
        <ListaAcoes
          acoes={acoes}
          onEscolher={(a) => {
            onFechar();
            navegar(a.href);
          }}
        />
      </div>
    </div>
  );
}
