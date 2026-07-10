import { z } from "zod";
import { uuidLike } from "./uuid";

const visibilidade = z.enum(["todos", "proprio", "selecionados"]);

/** Criar pasta. `membros` = userIds que podem ver (só faz efeito em "selecionados"). */
export const pastaCreateSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome à pasta").max(120),
  cor: z.string().max(30).nullable().optional(),
  icone: z.string().max(40).nullable().optional(),
  visibilidade: visibilidade.default("todos"),
  membros: z.array(uuidLike).max(200).optional(),
});

export const pastaUpdateSchema = pastaCreateSchema.partial();

/** Criar nota — na thread de uma PASTA ou anexada a um SHOW (exatamente um). */
export const notaCreateSchema = z
  .object({
    pasta_id: uuidLike.optional(),
    show_id: uuidLike.optional(),
    titulo: z.string().trim().max(200).nullable().optional(),
    conteudo: z.string().max(20000).default(""),
    cor: z.string().max(30).nullable().optional(),
    fixada: z.boolean().optional(),
  })
  .refine((v) => !!v.pasta_id !== !!v.show_id, {
    message: "Informe pasta_id OU show_id (exatamente um).",
  });

export const notaUpdateSchema = z.object({
  titulo: z.string().trim().max(200).nullable().optional(),
  conteudo: z.string().max(20000).optional(),
  cor: z.string().max(30).nullable().optional(),
  fixada: z.boolean().optional(),
});

export type PastaCreateInput = z.infer<typeof pastaCreateSchema>;
export type PastaUpdateInput = z.infer<typeof pastaUpdateSchema>;
export type NotaCreateInput = z.infer<typeof notaCreateSchema>;
export type NotaUpdateInput = z.infer<typeof notaUpdateSchema>;
