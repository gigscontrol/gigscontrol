"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Filter } from "lucide-react";
import { useT } from "@/lib/i18n";
import { filtroAtivo, passaNoFiltro } from "@/lib/filtroArtistas";

/**
 * Filtro "Artistas" da barra lateral, disponível pra QUALQUER tela via
 * contexto (antes só as telas que recebiam `selectedArtistas` por prop
 * obedeciam — metade do app ignorava o filtro).
 */
export type FiltroArtistasValor = {
  selecionados: string[];
  /** ids de TODOS os artistas visíveis no workspace. */
  todos: string[];
  definir: (ids: string[]) => void;
};

const Ctx = createContext<FiltroArtistasValor | null>(null);

export function FiltroArtistasProvider({
  valor,
  children,
}: {
  valor: FiltroArtistasValor;
  children: ReactNode;
}) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/**
 * Fora do painel (onboarding, telas públicas) não há filtro: tudo passa.
 * `passa(artistaId)` aplica a regra única (lib/filtroArtistas).
 */
export function useFiltroArtistas() {
  const v = useContext(Ctx);
  const selecionados = v?.selecionados ?? [];
  const todos = v?.todos ?? [];
  const ativo = !!v && filtroAtivo(selecionados, todos);
  return {
    selecionados,
    todos,
    ativo,
    passa: (artistaId: string | null | undefined) =>
      !ativo || passaNoFiltro(artistaId, selecionados),
    mostrarTodos: () => v?.definir(todos),
  };
}

/**
 * Faixa avisando que o filtro está escondendo coisas — com o atalho pra
 * mostrar tudo. Sem ela, item de artista desmarcado "sumia" e parecia que o
 * sistema tinha perdido o dado.
 */
export function AvisoFiltroArtistas() {
  const t = useT();
  const { ativo, selecionados, todos, mostrarTodos } = useFiltroArtistas();
  if (!ativo) return null;
  const n = todos.filter((id) => selecionados.includes(id)).length;
  return (
    <div
      role="status"
      className="mx-auto mb-0 flex w-full max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-6 pt-4 text-xs lg:px-8"
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium"
        style={{
          backgroundColor: "color-mix(in srgb, var(--brand) 12%, transparent)",
          color: "var(--brand)",
        }}
      >
        <Filter size={12} />
        {n === 0
          ? t("Nenhum artista marcado no filtro")
          : t("Mostrando {n} de {m} artistas", { n, m: todos.length })}
      </span>
      <button
        type="button"
        onClick={mostrarTodos}
        className="font-semibold text-muted underline-offset-2 hover:text-primary hover:underline"
      >
        {t("Mostrar todos")}
      </button>
    </div>
  );
}
