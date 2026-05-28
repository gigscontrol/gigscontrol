import { z } from "zod";

/**
 * Campos editáveis do workspace via PATCH /api/workspace.
 *
 * O `slug` NÃO entra aqui — tem rota e fluxo próprio porque a troca
 * dispara cascata em todos os usernames de profile (ver
 * workspace-slug.service.ts).
 */
export const workspaceUpdateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório.").max(80).optional(),
  whatsapp: z.string().max(20).optional().nullable(),
  cor_acento: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hex #rrggbb")
    .optional()
    .nullable(),
  cidade_ibge_id: z.string().max(20).optional().nullable(),
  cidade_nome: z.string().max(120).optional().nullable(),
  cidade_uf: z.string().length(2).optional().nullable(),
});
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
