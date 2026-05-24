import { z } from "zod";
import { uuidLike } from "./uuid";

// ---------- Cidades ----------

export const cidadeCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório"),
  estado: z.string().length(2, "estado deve ter 2 letras").nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});
export type CidadeCreateInput = z.infer<typeof cidadeCreateSchema>;
export const cidadeUpdateSchema = cidadeCreateSchema.partial();
export type CidadeUpdateInput = z.infer<typeof cidadeUpdateSchema>;

// ---------- Casas ----------

const tipoCasaEnum = z.enum([
  "club",
  "festival",
  "festa-privada",
  "bar",
  "arena",
  "outro",
]);

export const casaCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório"),
  tipo: tipoCasaEnum,
  cidade_id: uuidLike.nullable().optional(),
  capacidade: z.number().int().nonnegative().nullable().optional(),
  endereco: z.string().nullable().optional(),
  contato_responsavel: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
});
export type CasaCreateInput = z.infer<typeof casaCreateSchema>;
export const casaUpdateSchema = casaCreateSchema.partial();
export type CasaUpdateInput = z.infer<typeof casaUpdateSchema>;

// ---------- Contratantes ----------

export const contratanteCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório"),
  documento: z.string().nullable().optional(),
  email: z.string().email("e-mail inválido").nullable().optional().or(z.literal("")),
  telefone: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  cidade_id: uuidLike.nullable().optional(),
  observacoes: z.string().nullable().optional(),
});
export type ContratanteCreateInput = z.infer<typeof contratanteCreateSchema>;
export const contratanteUpdateSchema = contratanteCreateSchema.partial();
export type ContratanteUpdateInput = z.infer<typeof contratanteUpdateSchema>;
