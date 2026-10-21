"use client";

import { useMemo } from "react";
import { FilePlus, FileSignature, ShoppingCart, UserPlus, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useArtistas } from "@/lib/workspace-context";
import { useModulosVisiveis } from "@/lib/navegacao/useModulos";
import { urls } from "@/lib/navegacao/rotas";

export type AcaoNovo = {
  id: "orcamento" | "venda" | "contrato" | "contato";
  rotulo: string;
  descricao: string;
  href: string;
  icone: LucideIcon;
};

/**
 * O que a pessoa PODE criar — alimenta o botão "+ Novo", a barra do celular e
 * a busca. Só aparece o que ela consegue concluir (módulo visível + permissão
 * em algum artista); se nada, o botão some.
 */
export function useAcoesNovo(): AcaoNovo[] {
  const { podeUI } = useAuth();
  const artistas = useArtistas();
  const podeVer = useModulosVisiveis();

  return useMemo(() => {
    const emAlgum = (chave: string) => artistas.some((a) => podeUI(a.id, chave));
    const out: AcaoNovo[] = [];
    if (podeVer("vendas") && emAlgum("vendas.criar")) {
      out.push({
        id: "venda",
        rotulo: "Nova venda",
        descricao: "Fechar um show (cria a venda e o show na agenda)",
        href: urls.novaVenda(),
        icone: ShoppingCart,
      });
      out.push({
        id: "orcamento",
        rotulo: "Novo orçamento",
        descricao: "Proposta pro contratante aprovar",
        href: urls.novoOrcamento(),
        icone: FilePlus,
      });
    }
    if (podeVer("contratos") && emAlgum("contratos.criar")) {
      out.push({
        id: "contrato",
        rotulo: "Novo contrato",
        descricao: "A partir de um modelo e de uma venda",
        href: urls.novoContrato(),
        icone: FileSignature,
      });
    }
    if (podeVer("contatos") && emAlgum("contatos.criar")) {
      out.push({
        id: "contato",
        rotulo: "Novo contratante",
        descricao: "Cadastrar um cliente",
        href: urls.contatos("contratantes", { novo: true }),
        icone: UserPlus,
      });
    }
    return out;
  }, [artistas, podeUI, podeVer]);
}
