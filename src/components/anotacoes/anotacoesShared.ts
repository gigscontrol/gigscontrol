"use client";

import { useEffect, useState } from "react";

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
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return hora;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}
