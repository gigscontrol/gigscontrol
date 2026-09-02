import { z } from "zod";

const tipoSchema = z.enum(["editavel", "pdf"]);

const itemClausulaSchema = z.object({
  id: z.string(),
  tipo: z.enum(["subclausula", "paragrafo"]),
  texto: z.string(),
});

const secaoSchema = z.discriminatedUnion("tipo", [
  z.object({
    id: z.string(),
    tipo: z.literal("titulo"),
    titulo: z.string(),
    subtitulo: z.string(),
  }),
  z.object({
    id: z.string(),
    tipo: z.literal("partes"),
    // Default preserva o cabeçalho de modelos salvos ANTES do campo existir
    // (mesma regra de compat do mapper secoesValidas).
    titulo: z.string().default("Das partes"),
    contratante: z.string(),
    contratado: z.string(),
    paragrafo: z.string(),
  }),
  z.object({
    id: z.string(),
    tipo: z.literal("clausula"),
    titulo: z.string(),
    itens: z.array(itemClausulaSchema),
  }),
  z.object({
    id: z.string(),
    tipo: z.literal("assinaturas"),
    testemunhas: z
      .array(
        z.object({ id: z.string(), nome: z.string(), documento: z.string() })
      )
      .max(2),
  }),
  z.object({
    id: z.string(),
    tipo: z.literal("anexo"),
    titulo: z.string(),
    conteudo: z.string(),
  }),
]);

export const contratoModeloCreateSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório"),
  tipo: tipoSchema.default("editavel"),
  corpo: z.string().nullable().optional(),
  secoes: z.array(secaoSchema).optional(),
  arquivo_url: z.string().nullable().optional(),
  arquivo_nome: z.string().nullable().optional(),
});

export type ContratoModeloCreateInput = z.infer<
  typeof contratoModeloCreateSchema
>;

export const contratoModeloUpdateSchema = contratoModeloCreateSchema.partial();
export type ContratoModeloUpdateInput = z.infer<
  typeof contratoModeloUpdateSchema
>;
