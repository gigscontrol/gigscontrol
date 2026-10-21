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
  pasta_id: z.string().nullable().optional(),
});

export type ContratoCreateInput = z.infer<typeof contratoCreateSchema>;

export const contratoUpdateSchema = contratoCreateSchema.partial().extend({
  /** Por que o status foi mudado à mão (ex.: "assinado em papel"). Vai só
   *  para a trilha do contrato — não é coluna. */
  motivo_status: z.string().trim().max(500).optional(),
});
export type ContratoUpdateInput = z.infer<typeof contratoUpdateSchema>;
