import { z } from "zod";
import { uuidLike } from "@/lib/validators/uuid";

const papelEquipeEnum = z.enum(["produtor", "vendedor", "financeiro"]);

const escopoSchema = z.object({
  verTodosContatos: z.boolean(),
  verTodasVendas: z.boolean(),
  editarTodosEventos: z.boolean(),
});

/**
 * Mapa de funções operacionais → lista de DJs atendidos.
 * Cada função é opcional; quando presente, é uma lista (possivelmente
 * vazia) de UUIDs de artists.
 */
const funcoesSchema = z
  .object({
    vendedor: z.array(uuidLike).optional(),
    financeiro: z.array(uuidLike).optional(),
    produtor: z.array(uuidLike).optional(),
  })
  .refine(
    (f) =>
      (f.vendedor?.length ?? 0) +
        (f.financeiro?.length ?? 0) +
        (f.produtor?.length ?? 0) >
      0,
    {
      message:
        "Selecione pelo menos 1 função com 1 DJ para o usuário operacional.",
    }
  );

export const usuarioCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório").max(120),
  email: z.string().email("e-mail inválido"),
  papel: papelEquipeEnum,
  escopo: escopoSchema.optional(),
  funcoes: funcoesSchema,
});
export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  papel: papelEquipeEnum.optional(),
  escopo: escopoSchema.optional(),
  funcoes: funcoesSchema.optional(),
  ativo: z.boolean().optional(),
});
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
