import type { SupabaseClient } from "@supabase/supabase-js";
import type { DJ, Orcamento, Venda, Contratante, Casa, Cidade, Show } from "@/types";
import { rowParaDj } from "@/lib/mappers/artista";
import { rowParaUsuario, type UsuarioEquipe } from "@/lib/mappers/usuario";
import { rowParaOrcamento } from "@/lib/mappers/orcamento";
import { rowParaVenda } from "@/lib/mappers/venda";
import {
  rowParaContratante,
  rowParaCasa,
  rowParaCidade,
} from "@/lib/mappers/contatos";
import { rowParaShow } from "@/lib/mappers/show";
import {
  listarArtistasDeletados,
  contarArtistas,
  restaurarArtista as repoRestaurarArtista,
} from "@/lib/repositories/artistas.repo";
import {
  listarUsuariosDeletados,
  contarUsuariosEquipe,
  restaurarProfile,
} from "@/lib/repositories/usuarios.repo";
import {
  listarOrcamentosDeletados,
  restaurarOrcamento as repoRestaurarOrcamento,
} from "@/lib/repositories/orcamentos.repo";
import {
  listarVendasDeletadas,
  restaurarVenda as repoRestaurarVenda,
} from "@/lib/repositories/vendas.repo";
import {
  listarContratantesDeletados,
  restaurarContratante as repoRestaurarContratante,
} from "@/lib/repositories/contratantes.repo";
import {
  listarCasasDeletadas,
  restaurarCasa as repoRestaurarCasa,
} from "@/lib/repositories/casas.repo";
import {
  listarCidadesDeletadas,
  restaurarCidade as repoRestaurarCidade,
} from "@/lib/repositories/cidades.repo";
import {
  listarShowsDeletados,
  restaurarShow as repoRestaurarShow,
} from "@/lib/repositories/shows.repo";
import { LimitePlanoAtingidoError } from "@/lib/services/artistas.service";
import { LimitePlanoEquipeError } from "@/lib/services/usuarios.service";
import { getPlano, type PlanoId } from "@/lib/planos";

// ====================== Tipos ======================

export type TipoLixeira =
  | "artista"
  | "usuario"
  | "orcamento"
  | "venda"
  | "contratante"
  | "casa"
  | "cidade"
  | "show";

type ItemBase = {
  tipo: TipoLixeira;
  deletadoEm: string;
  diasRestantes: number;
};

export type ItemLixeiraArtista = ItemBase & { tipo: "artista"; artista: DJ };
export type ItemLixeiraUsuario = ItemBase & { tipo: "usuario"; usuario: UsuarioEquipe };
export type ItemLixeiraOrcamento = ItemBase & { tipo: "orcamento"; orcamento: Orcamento };
export type ItemLixeiraVenda = ItemBase & { tipo: "venda"; venda: Venda };
export type ItemLixeiraContratante = ItemBase & { tipo: "contratante"; contratante: Contratante };
export type ItemLixeiraCasa = ItemBase & { tipo: "casa"; casa: Casa };
export type ItemLixeiraCidade = ItemBase & { tipo: "cidade"; cidade: Cidade };
export type ItemLixeiraShow = ItemBase & { tipo: "show"; show: Show };

export type ItemLixeira =
  | ItemLixeiraArtista
  | ItemLixeiraUsuario
  | ItemLixeiraOrcamento
  | ItemLixeiraVenda
  | ItemLixeiraContratante
  | ItemLixeiraCasa
  | ItemLixeiraCidade
  | ItemLixeiraShow;

// ====================== Helpers ======================

function diasRestantes(deletadoEm: string | null): number {
  if (!deletadoEm) return 30;
  const ms = new Date(deletadoEm).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

// ====================== Listagem ======================

export async function listarLixeira(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{
  artistas: ItemLixeiraArtista[];
  usuarios: ItemLixeiraUsuario[];
  orcamentos: ItemLixeiraOrcamento[];
  vendas: ItemLixeiraVenda[];
  contratantes: ItemLixeiraContratante[];
  casas: ItemLixeiraCasa[];
  cidades: ItemLixeiraCidade[];
  shows: ItemLixeiraShow[];
}> {
  const [
    artistasRows,
    usuariosRows,
    orcamentosRows,
    vendasRows,
    contratantesRows,
    casasRows,
    cidadesRows,
    showsRows,
  ] = await Promise.all([
    listarArtistasDeletados(supabase),
    listarUsuariosDeletados(supabase, workspaceId),
    listarOrcamentosDeletados(supabase, workspaceId),
    listarVendasDeletadas(supabase, workspaceId),
    listarContratantesDeletados(supabase, workspaceId),
    listarCasasDeletadas(supabase, workspaceId),
    listarCidadesDeletadas(supabase, workspaceId),
    listarShowsDeletados(supabase, workspaceId),
  ]);

  const artistas: ItemLixeiraArtista[] = artistasRows.map((row) => ({
    tipo: "artista",
    artista: rowParaDj(row),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  const usuarios: ItemLixeiraUsuario[] = usuariosRows.map((row) => ({
    tipo: "usuario",
    usuario: rowParaUsuario(row),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  const orcamentos: ItemLixeiraOrcamento[] = orcamentosRows.map((row) => ({
    tipo: "orcamento",
    orcamento: rowParaOrcamento(row),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  const vendas: ItemLixeiraVenda[] = vendasRows.map((row) => ({
    tipo: "venda",
    // Vendas na lixeira são mostradas SEM parcelas pra economizar
    // chamadas — basta mostrar nome/número na UI.
    venda: rowParaVenda(row, []),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  const contratantes: ItemLixeiraContratante[] = contratantesRows.map((row) => ({
    tipo: "contratante",
    contratante: rowParaContratante(row),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  const casas: ItemLixeiraCasa[] = casasRows.map((row) => ({
    tipo: "casa",
    casa: rowParaCasa(row),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  const cidades: ItemLixeiraCidade[] = cidadesRows.map((row) => ({
    tipo: "cidade",
    cidade: rowParaCidade(row),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  const shows: ItemLixeiraShow[] = showsRows.map((row) => ({
    tipo: "show",
    show: rowParaShow(row),
    deletadoEm: row.deletado_em ?? "",
    diasRestantes: diasRestantes(row.deletado_em),
  }));

  return { artistas, usuarios, orcamentos, vendas, contratantes, casas, cidades, shows };
}

// ====================== Restauração ======================

export async function restaurarArtistaDaLixeira(
  supabase: SupabaseClient,
  id: string,
  planoId: PlanoId
): Promise<void> {
  const plano = getPlano(planoId);
  const total = await contarArtistas(supabase);
  if (total >= plano.maxArtistas) {
    throw new LimitePlanoAtingidoError(plano.maxArtistas, plano.nome);
  }
  await repoRestaurarArtista(supabase, id);
}

export async function restaurarUsuarioDaLixeira(
  supabase: SupabaseClient,
  id: string,
  workspaceId: string,
  planoId: PlanoId
): Promise<void> {
  const plano = getPlano(planoId);
  const total = await contarUsuariosEquipe(supabase, workspaceId);
  if (total >= plano.maxUsuariosAdicionais) {
    throw new LimitePlanoEquipeError(plano.maxUsuariosAdicionais, plano.nome);
  }
  await restaurarProfile(supabase, id);
}

export async function restaurarOrcamentoDaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRestaurarOrcamento(supabase, id);
}

export async function restaurarVendaDaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRestaurarVenda(supabase, id);
}

export async function restaurarContratanteDaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRestaurarContratante(supabase, id);
}

export async function restaurarCasaDaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRestaurarCasa(supabase, id);
}

export async function restaurarCidadeDaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRestaurarCidade(supabase, id);
}

export async function restaurarShowDaLixeira(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  await repoRestaurarShow(supabase, id);
}

// Apagar definitivamente NÃO é exposto: a única forma de remoção
// permanente é o job pg_cron `limpar_lixeira_expirada()` que roda 1x/dia
// e apaga itens com mais de 30 dias na lixeira.
