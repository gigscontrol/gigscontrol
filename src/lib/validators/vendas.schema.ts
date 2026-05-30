import { z } from "zod";
import { uuidLike } from "./uuid";

const itemQtdSchema = z.object({
  nome: z.string().min(1),
  qtd: z.number().int().nonnegative(),
});

const logisticaSchema = z.object({
  aereaQtd: z.number().int().nonnegative(),
  transladoTerrestre: z.boolean(),
});

const dataYmd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "deve estar no formato YYYY-MM-DD");
const horaHm = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "deve estar no formato HH:mm");

// ---------- Parcela (sub-objeto do POST /api/vendas) ----------

const parcelaSchema = z.object({
  /** id local (uuid gerado no cliente) — ignorado pelo servidor, que gera o seu */
  id: z.string().optional(),
  percentual: z.number().nonnegative(),
  valor: z.number().nonnegative(),
  data_vencimento: dataYmd.nullable().optional(),
  status_base: z.enum(["pendente", "pago"]).optional(),
  data_pagamento: dataYmd.nullable().optional(),
  observacao: z.string().nullable().optional(),
});
export type ParcelaInput = z.infer<typeof parcelaSchema>;

// ---------- Vendas ----------

export const vendaCreateSchema = z.object({
  orcamento_id: uuidLike.nullable().optional(),
  contratante_id: uuidLike.nullable().optional(),
  contratante_nome: z.string().nullable().optional(),
  contratante_email: z.string().nullable().optional(),
  contratante_telefone: z.string().nullable().optional(),
  contratante_documento: z.string().nullable().optional(),
  contratante_endereco: z.string().nullable().optional(),
  nome_evento: z.string().nullable().optional(),
  evento_instagram: z.string().nullable().optional(),
  nome_local: z.string().nullable().optional(),
  // Aceita number direto OU string (que vira number via coerção). O
  // cliente envia number, mas integrações externas (n8n, zapier etc)
  // tendem a mandar string. Trunca pra inteiro >= 0; vazio/NaN viram null.
  capacidade_publico: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n =
        typeof v === "number" ? v : Number(String(v).replace(/\D/g, ""));
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    }),
  endereco_local: z.string().nullable().optional(),
  data_show: dataYmd.nullable().optional(),
  horario: horaHm.nullable().optional(),
  horario_fim: horaHm.nullable().optional(),
  cidade_id: uuidLike.nullable().optional(),
  casa_id: uuidLike.nullable().optional(),
  artist_id: uuidLike.nullable().optional(),
  line_up: z.array(z.string()).optional(),
  cache: z.number().nonnegative(),
  duracao_horas: z.number().int().nonnegative().nullable().optional(),
  duracao_minutos: z.number().int().nonnegative().nullable().optional(),
  camarim: z.array(itemQtdSchema).optional(),
  efeitos: z.array(itemQtdSchema).optional(),
  hotel: z.array(itemQtdSchema).optional(),
  logistica: logisticaSchema.optional(),
  observacoes: z.string().nullable().optional(),
  parcelas: z.array(parcelaSchema).optional(),
});
export type VendaCreateInput = z.infer<typeof vendaCreateSchema>;

export const vendaUpdateSchema = vendaCreateSchema.partial();
export type VendaUpdateInput = z.infer<typeof vendaUpdateSchema>;

// ---------- Parcela PATCH ----------

export const parcelaUpdateSchema = z.object({
  percentual: z.number().nonnegative().optional(),
  valor: z.number().nonnegative().optional(),
  data_vencimento: dataYmd.nullable().optional(),
  status_base: z.enum(["pendente", "pago"]).optional(),
  data_pagamento: dataYmd.nullable().optional(),
  observacao: z.string().nullable().optional(),
});
export type ParcelaUpdateInput = z.infer<typeof parcelaUpdateSchema>;
