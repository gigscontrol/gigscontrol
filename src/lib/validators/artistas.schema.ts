import { z } from "zod";
import { LIMITE_RIDER_CAMARIM, LIMITE_RIDER_EFEITOS } from "@/types";

/**
 * Item do rider salvo no artista: só o NOME do item.
 * A quantidade é definida em cada orçamento (varia por evento).
 */
const itemRiderSchema = z
  .string()
  .min(1, "Nome do item obrigatório.")
  .max(80, "Nome do item muito longo.");

const taxaModoSchema = z.enum([
  "sem-taxa",
  "perc-fixa",
  "perc-variavel",
  "valor-fixo",
  "valor-variavel",
]);

/**
 * Username "raiz" — só a parte digitada pelo admin (ex: "brunosocek").
 * O sufixo "-slugDaAgencia" é montado pelo service antes de salvar.
 * Regex: começa com letra/número, pode ter hífen no meio.
 */
const usernameRaizSchema = z
  .string()
  .min(3, "Username muito curto (mínimo 3 chars).")
  .max(40, "Username muito longo (máximo 40 chars).")
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    "Use apenas letras minúsculas, números e hífen."
  );

export const artistaCreateSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório.").max(100),
  cor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser um hex no formato #rrggbb")
    .optional(),
  acesso_suspenso: z.boolean().optional(),
  // Acesso ao sistema (criado junto)
  username_raiz: usernameRaizSchema,
  // Cidade onde reside (referência IBGE)
  cidade_ibge_id: z.string().min(1).max(20).optional(),
  cidade_nome: z.string().min(1).max(120).optional(),
  cidade_uf: z.string().length(2).optional(),
  // Taxa de agência
  taxa_modo: taxaModoSchema.optional(),
  taxa_valor: z.number().min(0).max(999999).optional(),
  // Rider (só nomes — a quantidade vai pro orçamento)
  rider_camarim: z
    .array(itemRiderSchema)
    .max(
      LIMITE_RIDER_CAMARIM,
      `Máximo ${LIMITE_RIDER_CAMARIM} itens no rider de camarim.`
    )
    .optional(),
  rider_efeitos: z
    .array(itemRiderSchema)
    .max(
      LIMITE_RIDER_EFEITOS,
      `Máximo ${LIMITE_RIDER_EFEITOS} itens no rider de efeitos.`
    )
    .optional(),
});
export type ArtistaCreateInput = z.infer<typeof artistaCreateSchema>;

/**
 * Update: tudo opcional, exceto `username_raiz` que NÃO pode ser alterado
 * (porque o artista já usa pra login).
 */
export const artistaUpdateSchema = artistaCreateSchema
  .omit({ username_raiz: true })
  .partial();
export type ArtistaUpdateInput = z.infer<typeof artistaUpdateSchema>;
