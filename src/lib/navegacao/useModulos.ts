"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { ctxDaSessao } from "@/lib/permissoes/resolver";
import { podeVerModulo, subPaginasVisiveis } from "@/lib/permissoes/modulos";
import type { ActivePage, ActiveTab } from "@/types";

/**
 * "Esta pessoa enxerga o módulo X?" — a MESMA regra do menu (podeVerModulo).
 * Link cruzado entre fichas só aparece pra quem consegue abrir o destino:
 * oferecer a ficha do contato pra quem não tem Contatos levava a um redirect
 * mudo. Vínculos que falharam ao carregar = falha ABERTO (igual ao menu; o
 * servidor continua barrando).
 */
export function useModulosVisiveis(): (tab: ActiveTab) => boolean {
  return useVisibilidade().modulo;
}

/** Páginas de um módulo que a pessoa vê (a Agenda tem regra própria pra Anotações). */
export function usePaginasVisiveis(): (tab: ActiveTab, paginas: ActivePage[]) => ActivePage[] {
  return useVisibilidade().paginas;
}

function useVisibilidade() {
  const { sessao, isSuperAdmin } = useAuth();
  const ctx = useMemo(
    () =>
      sessao
        ? ctxDaSessao({
            isSuperAdmin,
            papel: sessao.usuario.papel,
            artistaId: (sessao.usuario.artistaId as unknown as string | undefined) ?? null,
            privacidade: sessao.privacidade,
            vinculos: sessao.vinculos,
            podeCriarAnotacoes: sessao.podeCriarAnotacoes,
            temPastaCompartilhada: sessao.temPastaCompartilhada,
          })
        : null,
    [sessao, isSuperAdmin]
  );
  const admin = isSuperAdmin || sessao?.usuario?.papel === "admin";
  const falhaAberta = !!sessao?.vinculosErro;
  const modulo = useCallback(
    (tab: ActiveTab) => {
      if (!ctx) return false;
      if (falhaAberta) return admin || tab !== "agencia";
      return podeVerModulo(ctx, tab);
    },
    [ctx, falhaAberta, admin]
  );
  const paginas = useCallback(
    (tab: ActiveTab, lista: ActivePage[]): ActivePage[] => {
      if (!ctx || !modulo(tab)) return [];
      if (falhaAberta) return lista;
      return subPaginasVisiveis(ctx, tab, lista.map((page) => ({ page }))).map((x) => x.page);
    },
    [ctx, falhaAberta, modulo]
  );
  return { modulo, paginas };
}
