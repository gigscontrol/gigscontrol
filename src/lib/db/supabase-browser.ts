"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso no NAVEGADOR (Client Components).
 *
 * Usa a chave pública (anon). Toda query feita por aqui passa pelo
 * Row Level Security do banco — o usuário só enxerga o que as policies
 * permitem para a sessão dele.
 */
export function criarClienteBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
