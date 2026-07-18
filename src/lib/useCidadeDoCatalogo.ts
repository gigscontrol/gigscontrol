"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Cidade } from "@/types";
import type { CidadeEscolhida } from "@/components/CidadeGlobalAutocomplete";
import { cidadeParaEscolhida } from "./cidade-helpers";

/**
 * Pré-popula o `CidadeGlobalAutocomplete` na EDIÇÃO a partir de um `cidadeId`
 * que precisa ser resolvido contra a lista `cidades` do contexto.
 *
 * RACE DA EDIÇÃO (o bug que este hook existe pra matar): o `useState` roda UMA
 * vez no mount. Se a lista `cidades` do contexto ainda não carregou, o `find`
 * volta vazio e o form abre com a cidade EM BRANCO mesmo com ela salva no
 * banco — o usuário é obrigado a re-escolher. O efeito re-resolve quando a
 * lista chega, e SÓ enquanto o campo segue vazio, pra nunca atropelar uma
 * escolha manual que o usuário já fez.
 *
 * Mesmo padrão já aplicado à mão no ConcretizarVenda.tsx:417.
 *
 * RESOLUÇÃO É ONE-SHOT (`jaResolveu`): "campo vazio" não distingue "ainda não
 * carregou" de "o usuário LIMPOU pra trocar de cidade". Como `cidades` vem do
 * contexto e troca de identidade a cada refetch/`registrarCidade`, sem o ref o
 * efeito repunha a cidade ANTIGA por baixo do usuário no meio da edição — e
 * ele salvava a cidade errada sem ver. Depois da primeira resolução (ou de
 * qualquer interação), o campo passa a ser só do usuário.
 *
 * Quem recebe a cidade pronta (join do backend, ex.: AbaEquipe/AbaArtistas)
 * NÃO precisa disto — lá o `cidadeParaEscolhida` direto já basta.
 */
export function useCidadeDoCatalogo(
  cidadeId: string | null | undefined,
  cidades: Cidade[]
): [CidadeEscolhida | null, Dispatch<SetStateAction<CidadeEscolhida | null>>] {
  const [cidade, setCidade] = useState<CidadeEscolhida | null>(() =>
    cidadeParaEscolhida(
      cidadeId ? cidades.find((c) => String(c.id) === String(cidadeId)) : null
    )
  );

  // Já resolvemos (no mount ou no efeito)? Então o campo é do USUÁRIO daqui em
  // diante — nunca mais repor por conta própria.
  const jaResolveu = useRef(cidade !== null);

  // O setter exposto marca a resolução como encerrada: a partir da primeira
  // interação (escolher OU limpar), o efeito abaixo não toca mais no campo.
  const definirCidade: Dispatch<SetStateAction<CidadeEscolhida | null>> = (v) => {
    jaResolveu.current = true;
    setCidade(v);
  };

  useEffect(() => {
    if (jaResolveu.current || cidade || !cidadeId || cidades.length === 0) return;
    const achada = cidadeParaEscolhida(
      cidades.find((c) => String(c.id) === String(cidadeId))
    );
    if (achada) {
      jaResolveu.current = true;
      setCidade(achada);
    }
    // `cidade` fora das deps DE PROPÓSITO: o guard acima já lê o valor atual do
    // render, e incluí-la faria o efeito rodar a cada digitação do usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidades, cidadeId]);

  return [cidade, definirCidade];
}
