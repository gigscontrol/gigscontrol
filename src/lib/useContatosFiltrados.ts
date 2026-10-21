"use client";

import { useMemo } from "react";
import { useContatos } from "@/lib/contatos-context";
import { useShows } from "@/lib/shows-context";
import { useVendas } from "@/lib/vendas-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { useFiltroArtistas } from "@/components/FiltroArtistas";
import { artistasDosContatos, contatoPassa } from "@/lib/filtroArtistas";

/**
 * Contratantes, casas e cidades JÁ filtrados pelo filtro "Artistas" da barra
 * lateral — a mesma regra em Todos os contatos, no Dashboard e no Mapa.
 * Contato herda os artistas do histórico (shows, vendas, orçamentos); sem
 * histórico aparece sempre (o recém-criado nunca some).
 */
export function useContatosFiltrados() {
  const { contratantes, casas, cidades } = useContatos();
  const { shows } = useShows();
  const { vendas } = useVendas();
  const { orcamentos } = useOrcamentos();
  const filtro = useFiltroArtistas();
  const { ativo, selecionados } = filtro;

  return useMemo(() => {
    if (!ativo) return { contratantes, casas, cidades };
    const mapa = artistasDosContatos(shows, vendas, orcamentos);
    return {
      contratantes: contratantes.filter((c) => contatoPassa(mapa.contratantes, c.id, selecionados)),
      casas: casas.filter((c) => contatoPassa(mapa.casas, c.id, selecionados)),
      cidades: cidades.filter((c) => contatoPassa(mapa.cidades, c.id, selecionados)),
    };
  }, [ativo, selecionados, contratantes, casas, cidades, shows, vendas, orcamentos]);
}
