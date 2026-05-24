import { z } from "zod";

const papelEquipeEnum = z.enum(["produtor", "vendedor", "financeiro"]);

const escopoSchema = z.object({
  verTodosContatos: z.boolean(),
  verTodasVendas: z.boolean(),
  editarTodosEventos: z.boolean(),
});

export const usuarioCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório").max(120),
  email: z.string().email("e-mail inválido"),
  papel: papelEquipeEnum,
  escopo: escopoSchema.optional(),
});
export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  papel: papelEquipeEnum.optional(),
  escopo: escopoSchema.optional(),
  ativo: z.boolean().optional(),
});
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
