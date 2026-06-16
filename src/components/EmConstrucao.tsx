"use client";

import { Hammer } from "lucide-react";

/**
 * Tela placeholder "em construção" — usada por módulos/telas cuja
 * funcionalidade ainda vai ser implementada (ex.: Contratos, Agência →
 * Dashboard). Mostra o título da tela e uma mensagem padrão.
 */
export default function EmConstrucao({
  titulo,
  subtitulo,
  cor,
}: {
  titulo: string;
  subtitulo?: string;
  cor?: string;
}) {
  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: cor ?? "var(--text-muted)" }}
          />
          <h1 className="text-xl font-bold text-primary">{titulo}</h1>
        </div>
        {subtitulo && <p className="text-sm text-muted mt-0.5">{subtitulo}</p>}
      </div>

      <div className="card flex flex-col items-center justify-center text-center gap-3 py-16">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center bg-elevated"
          style={{ color: cor ?? "var(--text-muted)" }}
        >
          <Hammer size={22} />
        </div>
        <div className="section-title">Em construção</div>
        <p className="text-sm text-muted max-w-sm">
          Este módulo está sendo desenvolvido e estará disponível em breve.
        </p>
      </div>
    </div>
  );
}
