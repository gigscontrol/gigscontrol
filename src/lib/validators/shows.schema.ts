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

/** Booking/hospedagem (Fases 4-5) — o cliente pode preencher; o servidor
 *  carimba quem/quando e mescla em shows.meta.booking. */
const bookingSchema = z.object({
  status: z.enum(["solicitado", "informado"]),
  hotelNome: z.string().max(200).optional(),
  endereco: z.string().max(300).optional(),
  quarto: z.string().max(100).optional(),
  telefone: z.string().max(50).optional(),
  localizacao: z
    .string()
    .max(500)
    .refine((v) => !v || /^https?:\/\//i.test(v), "link deve começar com http(s)://")
    .optional(),
  checkin: z.string().max(30).optional(),
  checkout: z.string().max(30).optional(),
  quartos: z.number().int().nonnegative().max(999).optional(),
  ocupacao: z.string().max(500).optional(),
  pago: z.boolean().optional(),
  voucherPath: z.string().max(300).optional(),
  observacoes: z.string().max(2000).optional(),
});

/**
 * Schema de atualização — todos os campos opcionais, mais `cancelamentoMotivo`
 * (transiente: o servidor carimba quem/quando do cancelamento), `booking`
 * (mesclado em shows.meta.booking pelo servidor) e `contratoDispensado`
 * (booleano transiente: true = dispensar a venda deste show do alerta "sem
 * contrato", false = desfazer. O servidor carimba {em, por} em
 * shows.meta.contratoDispensado — o cliente NÃO forja a autoria).
 */
export const showUpdateSchema = showCreateSchema.partial().extend({
  cancelamentoMotivo: z.string().trim().min(1).max(300).optional(),
  booking: bookingSchema.optional(),
  contratoDispensado: z.boolean().optional(),
});

export type ShowUpdateInput = z.infer<typeof showUpdateSchema>;
