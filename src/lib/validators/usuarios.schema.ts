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

/**
 * MODELO NOVO — acesso por artista: cada item semeia um vínculo
 * (membros_artista) com o perfil escolhido. O usuário pode ter perfis
 * diferentes por artista (ex.: Financeiro do Jorge, Vendedor da Ana).
 */
const perfilVinculoEnum = z.enum([
  "manager",
  "financeiro",
  "juridico",
  "vendedor",
  "equipe",
]);
const acessoSchema = z.object({
  artistId: uuidLike,
  perfil: perfilVinculoEnum,
});

export const usuarioCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório").max(120),
  // Parte do username digitada pelo admin — o backend concatena o slug
  // da agência ("raiz-slug"), exatamente como na criação de artistas.
  // Sem campo de e-mail: a conta nasce com um e-mail fake interno.
  username_raiz: usernameRaizSchema,
  // Acesso inicial por artista (semeia vínculos). Pode vir vazio no
  // onboarding (cria só a conta; o acesso é configurado depois na Equipe).
  // O modal de criar usuário exige ao menos 1 no cliente.
  acessos: z.array(acessoSchema).default([]),
});
export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;
export type AcessoInput = z.infer<typeof acessoSchema>;

export const usuarioUpdateSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  papel: papelEquipeEnum.optional(),
  escopo: escopoSchema.optional(),
  funcoes: funcoesSchema.optional(),
  ativo: z.boolean().optional(),
});
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
