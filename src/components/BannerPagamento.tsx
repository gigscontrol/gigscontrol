"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

type Props = {
  papel: string;
  adminContato: string | null;
  plano: { id: string; nome: string } | null;
  ciclo: string;
};

/**
 * Banner do período de GRAÇA (1 dia após a renovação falhar / o trial acabar).
 * Acesso continua liberado; é só um aviso flutuante no topo. Admin tem o botão
 * "Renovar" (leva pra /pagamento, onde fica o checkout embutido); os demais
 * (artista/equipe) só veem o aviso pra avisar o admin.
 */
export default function BannerPagamento({ papel, adminContato, plano, ciclo }: Props) {
  const t = useT();
  const router = useRouter();
  const isAdmin = papel === "admin";
  // `ciclo` fica na assinatura do workspace (a página /pagamento lê o plano
  // atual pra montar o checkout); não é passado pela navegação.
  void ciclo;

  function renovar() {
    // O checkout embutido vive em /pagamento — navega pra lá em vez de
    // redirecionar direto pro Stripe.
    router.push("/pagamento");
  }

  return (
    <div className="fixed left-1/2 top-3 z-[60] max-w-[94vw] -translate-x-1/2">
      <div
        className="flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs shadow-lg"
        style={{
          background: "color-mix(in srgb, var(--warning) 14%, var(--bg-surface))",
          borderColor: "color-mix(in srgb, var(--warning) 45%, transparent)",
          color: "var(--text-primary)",
        }}
      >
        <AlertTriangle
          size={15}
          style={{ color: "var(--warning)" }}
          className="flex-shrink-0"
        />
        <span className="truncate">
          {isAdmin
            ? t("Pagamento pendente — a renovação do plano falhou.")
            : adminContato
            ? t("Pagamento pendente — avise seu administrador ({nome}) sobre a renovação.", {
                nome: adminContato,
              })
            : t("Pagamento pendente — avise seu administrador sobre a renovação.")}
        </span>
        {isAdmin && (
          <button
            onClick={renovar}
            className="flex-shrink-0 rounded-full px-3 py-1 text-[0.7rem] font-bold text-white"
            style={{ background: "var(--warning)" }}
          >
            {t("Renovar")}
          </button>
        )}
      </div>
    </div>
  );
}
