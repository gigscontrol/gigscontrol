import { z } from "zod";

export const workspaceUpdateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório").max(80).optional(),
});
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;
