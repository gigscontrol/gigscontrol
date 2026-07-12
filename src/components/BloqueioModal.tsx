"use client";

import { useCallback, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useT, useMoeda } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { getPlano, valorMensal, formatarPreco, type PlanoId } from "@/lib/planos";
import CheckoutEmbutido from "@/components/checkout/CheckoutEmbutido";

type Props = {
  papel: string;
  adminContato: string | null;
  plano: { id: string; nome: string } | null;
  ciclo: string;
};

/**
 * Pop-up que TRAVA o app quando a assinatura está bloqueada (graça expirou,
 * suspensa ou cancelada). Não fecha: sem X, sem clicar fora, sem ESC. Única
 * ação é Sair (logout). Admin vê o mini-checkout pra renovar; os demais
 * (artista/equipe) veem o aviso pra avisar o administrador.
 */
export default function BloqueioModal({ papel, adminContato, plano, ciclo }: Props) {
  const t = useT();
  const moeda = useMoeda();
  const { logout } = useAuth();
  const [indo, setIndo] = useState(false);
  // Admin vê o checkout embutido; se a chave pública faltar, degrada
  // pro fluxo hospedado (botão "Pagar e renovar" que redireciona).
  const [usarHosted, setUsarHosted] = useState(false);
  const degradarParaHosted = useCallback(() => setUsarHosted(true), []);
  const isAdmin = papel === "admin";

  async function renovar() {
    if (indo || !plano) return;
    setIndo(true);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: plano.id, ciclo }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.url) {
        window.location.href = body.url as string;
        return;
      }
    } catch {
      /* ignora — o botão reabilita */
    }
    setIndo(false);
  }

  const planoFull = plano ? getPlano(plano.id as PlanoId) : null;
  const precoTxt = planoFull
    ? `${planoFull.nome} · ${formatarPreco(valorMensal(planoFull, moeda), moeda)}/${t("mês")}`
    : "";

  // Admin com plano e checkout embutido disponível → modal largo pro iframe.
  const embutido = isAdmin && !!plano && !usarHosted;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,12,.72)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`card w-full p-6 text-center ${
          embutido ? "max-w-lg" : "max-w-sm"
        }`}
      >
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: "color-mix(in srgb, var(--danger) 16%, transparent)",
            color: "var(--danger)",
          }}
        >
          <Lock size={22} />
        </div>

        {isAdmin ? (
          <>
            <h2 className="text-lg font-bold text-primary">{t("Renovação pendente")}</h2>
            <p className="mt-1.5 text-sm text-secondary">
              {precoTxt && (
                <>
                  <span className="font-medium text-primary">{precoTxt}</span>
                  <br />
                </>
              )}
              {t("Renove pra reativar o acesso do seu workspace.")}
            </p>
            {embutido ? (
              // Checkout embutido dentro do modal (no lugar do redirect).
              <div className="mt-5 text-left">
                <CheckoutEmbutido
                  plano={plano.id}
                  ciclo={ciclo}
                  onIndisponivel={degradarParaHosted}
                />
              </div>
            ) : (
              // Fallback hospedado: sem chave pública ou sem plano.
              <button
                onClick={renovar}
                disabled={indo || !plano}
                className="btn btn-primary mt-5 w-full justify-center disabled:opacity-60"
              >
                {indo ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  t("Pagar e renovar")
                )}
              </button>
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-primary">{t("Pagamento pendente")}</h2>
            <p className="mt-1.5 text-sm text-secondary">
              {adminContato
                ? t(
                    "Informe seu administrador ({nome}) sobre a renovação do plano pra liberar o acesso.",
                    { nome: adminContato }
                  )
                : t(
                    "Informe seu administrador sobre a renovação do plano pra liberar o acesso."
                  )}
            </p>
          </>
        )}

        <button
          onClick={() => logout()}
          className="mt-4 text-xs text-muted underline hover:text-secondary"
        >
          {t("Sair")}
        </button>
      </div>
    </div>
  );
}
