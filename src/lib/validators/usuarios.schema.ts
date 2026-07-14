import { z } from "zod";
import { uuidLike } from "@/lib/validators/uuid";
import { usernameRaizSchema } from "@/lib/validators/artistas.schema";
// Fonte única da verdade das chaves aceitas num vínculo por-artista (as
// workspace-level agencia.* são administrativas e ficam de fora).
import { CHAVES_ARTISTA_VALIDAS } from "@/lib/permissoes/catalogo";
// Ids de preset (perfil) válidos — pro modal de criação persistir "quais
// presets foram aplicados" no vínculo (fix do bug do preset descartado).
import { PERFIS } from "@/lib/permissoes/perfis";

const PERFIL_IDS_VALIDOS: ReadonlySet<string> = new Set(PERFIS.map((p) => p.id));

const papelEquipeEnum = z.enum(["produtor", "vendedor", "financeiro"]);

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
  // Permissões por artista já definidas no modal de criação (opcional). Mapa
  // artistId → lista de chaves de permissão (nível "artista"). Toda chave é
  // validada contra o catálogo; o artistId precisa estar em `artistIds`. Se
  // ausente pra um artista, o vínculo nasce vazio (como antes).
  permissoes_por_artista: z
    .record(
      uuidLike,
      z
        .array(
          z.string().refine((c) => CHAVES_ARTISTA_VALIDAS.has(c), {
            message: "Permissão desconhecida ou não aplicável por artista.",
          })
        )
    )
    .optional(),
  // Perfis (presets) escolhidos por artista no modal de criação (opcional).
  // Mapa artistId → lista de ids de preset. Persistido no vínculo (fonte da
  // verdade de "quais presets foram aplicados", pro editor refletir depois);
  // quando não vier permissão explícita, semeia as permissões do vínculo.
  // FIX do bug: antes o preset da criação era descartado (perfis: [] fixo).
  perfis_por_artista: z
    .record(
      uuidLike,
      z.array(
        z.string().refine((id) => PERFIL_IDS_VALIDOS.has(id), {
          message: "Perfil (preset) desconhecido.",
        })
      )
    )
    .optional(),
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
}).superRefine((val, ctx) => {
  // Todo artistId com permissões/perfis precisa estar entre os artistas
  // selecionados — senão dá pra semear num vínculo que nem vai existir.
  const selecionados = new Set(val.artistIds);
  for (const artistId of Object.keys(val.permissoes_por_artista ?? {})) {
    if (!selecionados.has(artistId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["permissoes_por_artista", artistId],
        message: "Permissões para um artista que não está na lista de vínculos.",
      });
    }
  }
  for (const artistId of Object.keys(val.perfis_por_artista ?? {})) {
    if (!selecionados.has(artistId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["perfis_por_artista", artistId],
        message: "Perfis para um artista que não está na lista de vínculos.",
      });
    }
  }
});
export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  papel: papelEquipeEnum.optional(),
  // escopo/funcoes REMOVIDOS: o sistema legado morreu. Acesso operacional =
  // 100% vínculos por artista (membros_artista), editados na aba Equipe.
  ativo: z.boolean().optional(),
  /** Permissão dedicada (workspace-level): criar pastas de anotações. */
  pode_criar_anotacoes: z.boolean().optional(),
  // Dados pessoais (opcionais) — servem para contrato. País dirige documento.
  // Sem email_contato aqui: e-mail de contato do admin é bloqueado no update.
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
  cidade_id: uuidLike.optional(),
});
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
