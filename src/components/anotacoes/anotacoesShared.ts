"use client";

import { useEffect, useState } from "react";
import { formatarDiaMes, formatarHora } from "@/lib/formatters";

/**
 * Utilitários compartilhados das Anotações (fora de qualquer componente de UI).
 * Lista enxuta da equipe pros rótulos de autoria e formatador de data curto.
 */

export type UsuarioResumo = { id: string; nome: string; cor?: string };

/** Lista enxuta da equipe (id/nome/cor) pros rótulos "criado/editado por". */
export function useEquipe(): UsuarioResumo[] {
  const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
  useEffect(() => {
    fetch("/api/usuarios", { credentials: "include" })
      .then((r) => r.json())
      .then((b) => setUsuarios((b.usuarios as UsuarioResumo[]) ?? []))
      .catch(() => undefined);
  }, []);
  return usuarios;
}

export function fmtQuando(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const hora = formatarHora(d);
  if (d.toDateString() === hoje.toDateString()) return hora;
  return `${formatarDiaMes(d)} ${hora}`;
}
