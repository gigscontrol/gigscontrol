"use client";

import type { ReactNode } from "react";

/**
 * Estado vazio padrão das listas (o mesmo bloco estava copiado em 10 telas):
 * ícone num círculo, título, explicação e, opcionalmente, a ação que resolve.
 * Textos chegam já traduzidos.
 */
export default function EstadoVazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  texto?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-muted">
        {icone}
      </div>
      <h2 className="section-title mb-1">{titulo}</h2>
      {texto && <div className={`section-subtitle ${acao ? "mb-4" : ""}`}>{texto}</div>}
      {acao}
    </div>
  );
}
