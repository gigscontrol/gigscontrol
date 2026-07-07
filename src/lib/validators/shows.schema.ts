import { z } from "zod";
import { uuidLike } from "./uuid";

/** Status aceitos para um show. */
const statusSchema = z.enum(["confirmado", "pendente", "logistica", "cancelado"]);

/**
 * Schema de criação de show. Todos os FKs vêm como uuid; a data é YYYY-MM-DD.
 * O `workspace_id` NUNCA vem do cliente — sai da sessão.
 */
export const showCreateSchema = z.object({
  artist_id: uuidLike.nullable().optional(),
  contratante_id: uuidLike.nullable().optional(),
  casa_id: uuidLike.nullable().optional(),
  cidade_id: uuidLike.nullable().optional(),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve estar no formato YYYY-MM-DD")
    .nullable()
    .optional(),
  horario: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "horario deve estar no formato HH:mm")
    .nullable()
    .optional(),
  status: statusSchema.optional(),
  valor: z.number().nonnegative().nullable().optional(),
  orcamento_id: uuidLike.nullable().optional(),
  venda_id: uuidLike.nullable().optional(),
});

export type ShowCreateInput = z.infer<typeof showCreateSchema>;

/**
 * Schema de atualização — todos os campos opcionais, mais o `cancelamentoMotivo`
 * (transiente: o cliente manda o motivo ao cancelar; o servidor carimba
 * quem/quando em shows.meta e este campo NÃO persiste como coluna).
 */
export const showUpdateSchema = showCreateSchema.partial().extend({
  cancelamentoMotivo: z.string().trim().min(1).max(300).optional(),
});

export type ShowUpdateInput = z.infer<typeof showUpdateSchema>;
