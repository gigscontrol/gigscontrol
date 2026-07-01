import { z } from "zod";
import { uuidLike } from "./uuid";

/**
 * Schema de criação de item da agenda (evento personalizado · voo · transporte).
 * O `workspace_id` NUNCA vem do cliente — sai da sessão.
 */
export const agendaItemCreateSchema = z.object({
  tipo: z.enum(["evento", "voo", "transporte"]),
  titulo: z.string().trim().max(200).optional(),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve estar no formato YYYY-MM-DD"),
  data_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data_fim deve estar no formato YYYY-MM-DD")
    .nullable()
    .optional(),
  dia_inteiro: z.boolean().optional(),
  hora_inicio: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "hora deve estar no formato HH:mm")
    .nullable()
    .optional(),
  hora_fim: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "hora deve estar no formato HH:mm")
    .nullable()
    .optional(),
  artist_id: uuidLike.nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  dados: z.record(z.string(), z.unknown()).optional(),
});

export type AgendaItemCreateInput = z.infer<typeof agendaItemCreateSchema>;
