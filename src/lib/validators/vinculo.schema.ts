import { z } from "zod";

/** Body de PUT /api/artistas/[id]/equipe/[userId] — perfis + permissões do vínculo. */
export const vinculoSchema = z.object({
  perfis: z.array(z.string()).default([]),
  permissoes: z.array(z.string()).default([]),
});

export type VinculoInput = z.infer<typeof vinculoSchema>;
