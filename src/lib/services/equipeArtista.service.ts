import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listarVinculosDoArtista,
  upsertVinculo,
  removerVinculo,
  type VinculoRow,
} from "@/lib/repositories/membrosArtista.repo";
import { CHAVES_ARTISTA_VALIDAS } from "@/lib/permissoes/catalogo";
import { PERFIL_POR_ID } from "@/lib/permissoes/perfis";

/**
 * Camada de serviço da EQUIPE de um artista (vínculos usuário × artista).
 */

export type MembroDoArtista = {
  userId: string;
  nome: string;
  papel: string;
  perfis: string[];
  permissoes: string[];
};

/** Lista os membros vinculados a um artista, com nome/papel do usuário. */
export async function listarEquipeDoArtista(
  supabase: SupabaseClient,
  artistId: string
): Promise<MembroDoArtista[]> {
  const vinculos = await listarVinculosDoArtista(supabase, artistId);
  if (vinculos.length === 0) return [];

  const ids = [...new Set(vinculos.map((v) => v.user_id))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, nome, papel")
    .in("id", ids);
  const mapa = new Map(
    (profs ?? []).map((p) => [
      (p as { id: string }).id,
      p as { nome: string | null; papel: string },
    ])
  );

  return vinculos.map((v) => ({
    userId: v.user_id,
    nome: mapa.get(v.user_id)?.nome ?? "—",
    papel: mapa.get(v.user_id)?.papel ?? "",
    perfis: v.perfis,
    permissoes: v.permissoes,
  }));
}

/**
 * Salva (cria/atualiza) o vínculo — valida perfis e permissões contra o
 * catálogo (ignora chaves inválidas, evita lixo no banco). SÓ chaves de nível
 * "artista" entram: chaves administrativas de workspace (agencia.*) são
 * REJEITADAS aqui, pois um vínculo por-artista não pode conceder poder global.
 */
export async function salvarVinculoDoArtista(
  admin: SupabaseClient,
  workspaceId: string,
  userId: string,
  artistId: string,
  perfis: string[],
  permissoes: string[]
): Promise<VinculoRow> {
  const perfisLimpos = perfis.filter((p) => p in PERFIL_POR_ID);
  const permsLimpas = [...new Set(permissoes.filter((c) => CHAVES_ARTISTA_VALIDAS.has(c)))];
  return upsertVinculo(admin, {
    workspaceId,
    userId,
    artistId,
    perfis: perfisLimpos,
    permissoes: permsLimpas,
  });
}

/** Remove o vínculo (soft delete). */
export async function removerVinculoDoArtista(
  admin: SupabaseClient,
  userId: string,
  artistId: string,
  deletadoPor?: string
): Promise<void> {
  await removerVinculo(admin, userId, artistId, deletadoPor);
}
