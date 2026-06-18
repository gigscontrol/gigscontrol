import { z } from "zod";

const statusSchema = z.enum([
  "rascunho",
  "enviado",
  "assinado",
  "cancelado",
]);

export const contratoCreateSchema = z.object({
  modelo_id: z.string().nullable().optional(),
  venda_id: z.string().nullable().optional(),
  status: statusSchema.optional(),
  corpo_preenchido: z.string().nullable().optional(),
  local_assinatura: z.string().nullable().optional(),
  data_emissao: z.string().nullable().optional(),
  data_assinatura: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export type ContratoCreateInput = z.infer<typeof contratoCreateSchema>;

export const contratoUpdateSchema = contratoCreateSchema.partial();
export type ContratoUpdateInput = z.infer<typeof contratoUpdateSchema>;
