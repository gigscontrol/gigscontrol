import { z } from "zod";
import { uuidLike } from "@/lib/validators/uuid";
import { usernameRaizSchema } from "@/lib/validators/artistas.schema";

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
  // Parte do username digitada pelo admin — o backend concatena o slug
  // da agência ("raiz-slug"), exatamente como na criação de artistas.
  // Sem campo de e-mail: a conta nasce com um e-mail fake interno.
  username_raiz: usernameRaizSchema,
  // Artistas com quem o usuário trabalha. Cria um VÍNCULO vazio por artista
  // (aparece na aba Equipe do artista, onde o admin define a função e as
  // permissões). Pode vir vazio no onboarding (cria só a conta).
  artistIds: z.array(uuidLike).default([]),
  // Dados pessoais (opcionais) — servem para contrato. País dirige documento.
  cor: z.string().max(20).optional(),
  pais: z.string().length(2).optional(),
  nome_legal: z.string().max(120).optional(),
  documento_tipo: z.enum(["cpf", "cnpj"]).optional(),
  documento: z.string().max(40).optional(),
  razao_social: z.string().max(140).optional(),
  endereco: z.string().max(300).optional(),
  telefone: z.string().max(40).optional(),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  email_contato: z.string().max(120).optional(),
  cidade_id: uuidLike.optional(),
});
export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  papel: papelEquipeEnum.optional(),
  escopo: escopoSchema.optional(),
  funcoes: funcoesSchema.optional(),
  ativo: z.boolean().optional(),
  /** Permissão dedicada (workspace-level): criar pastas de anotações. */
  pode_criar_anotacoes: z.boolean().optional(),
});
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
