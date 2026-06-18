import { z } from "zod";

const tipoSchema = z.enum(["editavel", "pdf"]);

const secaoSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  corpo: z.string(),
});

export const contratoModeloCreateSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório"),
  tipo: tipoSchema.default("editavel"),
  corpo: z.string().nullable().optional(),
  secoes: z.array(secaoSchema).optional(),
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
