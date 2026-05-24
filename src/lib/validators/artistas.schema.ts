import { z } from "zod";

export const artistaCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório").max(100),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "cor deve ser um hex no formato #rrggbb")
    .optional(),
  acesso_suspenso: z.boolean().optional(),
});
export type ArtistaCreateInput = z.infer<typeof artistaCreateSchema>;

export const artistaUpdateSchema = artistaCreateSchema.partial();
export type ArtistaUpdateInput = z.infer<typeof artistaUpdateSchema>;
