import { z } from "zod";
import { uuidLike } from "./uuid";

const statusSchema = z.enum(["pendente", "negociacao", "aceito", "recusado"]);
const tipoEventoSchema = z.enum(["social", "casa-noturna", "festival"]);

const itemQtdSchema = z.object({
  nome: z.string().min(1),
  qtd: z.number().int().nonnegative(),
});

const logisticaSchema = z.object({
  aereaQtd: z.number().int().nonnegative(),
  transladoTerrestre: z.boolean(),
});

const detalhesEventoSchema = z
  .object({
    nomeEvento: z.string(),
    instagram: z.string(),
    nomeLocal: z.string(),
    capacidade: z.number().nonnegative(),
    enderecoLocal: z.string(),
    dataShow: z.string(),
    horarioInicio: z.string(),
    horarioFim: z.string(),
    terminoDiaSeguinte: z.boolean(),
  })
  .partial();

export const orcamentoCreateSchema = z.object({
  status: statusSchema.optional(),
  tipo_evento: tipoEventoSchema.optional(),
  contratante_id: uuidLike.nullable().optional(),
  casa_id: uuidLike.nullable().optional(),
  cidade_id: uuidLike.nullable().optional(),
  artist_id: uuidLike.nullable().optional(),
  valor_cache: z.number().nonnegative().nullable().optional(),
  duracao_horas: z.number().int().nonnegative().nullable().optional(),
  duracao_minutos: z.number().int().nonnegative().nullable().optional(),
  camarim: z.array(itemQtdSchema).optional(),
  efeitos: z.array(itemQtdSchema).optional(),
  hotel: z.array(itemQtdSchema).optional(),
  logistica: logisticaSchema.optional(),
  observacoes: z.string().nullable().optional(),
  info_extra: z.string().nullable().optional(),
  detalhes_evento: detalhesEventoSchema.nullable().optional(),
  data_show: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data_show deve ser YYYY-MM-DD")
    .nullable()
    .optional(),
  horario: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "horario deve ser HH:mm")
    .nullable()
    .optional(),
  // Fuso do horário (IANA) — só rótulo, não converte.
  fuso_horario: z.string().max(64).nullable().optional(),
  validade: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "validade deve ser YYYY-MM-DD")
    .nullable()
    .optional(),
  show_id: uuidLike.nullable().optional(),
  // Taxa da agência digitada no form (modos VARIÁVEIS: % ou R$ conforme o modo
  // do artista). Nos modos fixos o servidor calcula do config e ignora isto.
  taxa_digitada: z.number().nonnegative().nullable().optional(),
});

export type OrcamentoCreateInput = z.infer<typeof orcamentoCreateSchema>;
export const orcamentoUpdateSchema = orcamentoCreateSchema.partial();
export type OrcamentoUpdateInput = z.infer<typeof orcamentoUpdateSchema>;
