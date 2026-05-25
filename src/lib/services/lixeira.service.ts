import type { SupabaseClient } from "@supabase/supabase-js";
import type { DJ } from "@/types";
import { rowParaDj } from "@/lib/mappers/artista";
import { rowParaUsuario, type UsuarioEquipe } from "@/lib/mappers/usuario";
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
import { LimitePlanoAtingidoError } from "@/lib/services/artistas.service";
import { LimitePlanoEquipeError } from "@/lib/services/usuarios.service";
import { getPlano, type PlanoId } from "@/lib/planos";

/** Cada item da lixeira inclui quantos dias faltam pra expirar. */
export type ItemLixeiraArtista = {
  tipo: "artista";
  artista: DJ;
  deletadoEm: string;
  diasRestantes: number;
};

export type ItemLixeiraUsuario = {
  tipo: "usuario";
  usuario: UsuarioEquipe;
  deletadoEm: string;
  diasRestantes: number;
};

export type ItemLixeira = ItemLixeiraArtista | ItemLixeiraUsuario;

function diasRestantes(deletadoEm: string | null): number {
  if (!deletadoEm) return 30;
  const ms = new Date(deletadoEm).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export async function listarLixeira(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ artistas: ItemLixeiraArtista[]; usuarios: ItemLixeiraUsuario[] }> {
  const [artistasRows, usuariosRows] = await Promise.all([
    listarArtistasDeletados(supabase),
    listarUsuariosDeletados(supabase, workspaceId),
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

  return { artistas, usuarios };
}

export async function restaurarArtistaDaLixeira(
  supabase: SupabaseClient,
  id: string,
  planoId: PlanoId
): Promise<void> {
  // Re-conta artistas ativos antes de restaurar. Se já está no limite do
  // plano, não permite — força o admin a remover outro ativo ou fazer
  // upgrade primeiro.
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
  // Mesma regra do criar: respeita o limite do plano antes de restaurar.
  const plano = getPlano(planoId);
  const total = await contarUsuariosEquipe(supabase, workspaceId);
  if (total >= plano.maxUsuariosAdicionais) {
    throw new LimitePlanoEquipeError(plano.maxUsuariosAdicionais, plano.nome);
  }
  await restaurarProfile(supabase, id);
}

// Apagar definitivamente NÃO é exposto: a única forma de remoção
// permanente é o job pg_cron `limpar_lixeira_expirada()` que roda 1x/dia
// e apaga itens com mais de 30 dias na lixeira.
