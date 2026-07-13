import { z } from "zod";
import { PERFIS } from "@/lib/permissoes/perfis";
import { CHAVES_ARTISTA_VALIDAS } from "@/lib/permissoes/catalogo";

/** IDs de perfil (preset) válidos — fonte única em permissoes/perfis.ts. */
const PERFIL_IDS: ReadonlySet<string> = new Set(PERFIS.map((p) => p.id));

/**
 * Body de PUT /api/artistas/[id]/equipe/[userId] — perfis + permissões do vínculo.
 *
 * Defesa em profundidade: além do serviço (`salvarVinculoDoArtista`) filtrar
 * lixo, o zod já REJEITA perfis desconhecidos e permissões que não sejam de
 * nível "artista" (chaves administrativas de workspace agencia.* não podem
 * entrar num vínculo por-artista).
 */
export const vinculoSchema = z.object({
  perfis: z
    .array(
      z.string().refine((p) => PERFIL_IDS.has(p), {
        message: "Perfil desconhecido.",
      })
    )
    .default([]),
  permissoes: z
    .array(
      z.string().refine((c) => CHAVES_ARTISTA_VALIDAS.has(c), {
        message: "Permissão desconhecida ou não aplicável por artista.",
      })
    )
    .default([]),
});

export type VinculoInput = z.infer<typeof vinculoSchema>;
