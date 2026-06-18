import { z } from "zod";

const tipoSchema = z.enum(["editavel", "pdf"]);

export const contratoModeloCreateSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório"),
  tipo: tipoSchema.default("editavel"),
  corpo: z.string().nullable().optional(),
  arquivo_url: z.string().nullable().optional(),
  arquivo_nome: z.string().nullable().optional(),
});

export type ContratoModeloCreateInput = z.infer<
  typeof contratoModeloCreateSchema
>;

export const contratoModeloUpdateSchema = contratoModeloCreateSchema.partial();
export type ContratoModeloUpdateInput = z.infer<
  typeof contratoModeloUpdateSchema
>;
