import { z } from "zod";
import {
  LIMITE_RIDER_CAMARIM,
  LIMITE_RIDER_EFEITOS,
  LIMITE_RIDER_TECNICO,
} from "@/types";

/**
 * Item do rider salvo no artista: só o NOME do item.
 * A quantidade é definida em cada orçamento (varia por evento).
 */
const itemRiderSchema = z
  .string()
  .min(1, "Nome do item obrigatório.")
  .max(80, "Nome do item muito longo.");

/** Um preset de rider (mig 97): nome + itens com quantidade. */
const presetRiderSchema = z.object({
  nome: z.string().min(1, "Nome do preset obrigatório.").max(40),
  itens: z
    .array(
      z.object({
        nome: z.string().min(1).max(120),
        qtd: z.number().int().min(0).max(9999),
      })
    )
    .max(40, "Máximo 40 itens por preset."),
});

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
export const usernameRaizSchema = z
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
  // Dados do CONTRATADO (para contratos). nome_legal + documento são
  // obrigatórios; razao_social só faz sentido quando documento_tipo='cnpj'
  // (regra condicional aplicada no formulário). endereco/telefone opcionais.
  /** País de origem (ISO2) — dirige documento/DDI/endereço. Default 'BR'. */
  pais: z.string().length(2).optional(),
  nome_legal: z.string().min(1, "Nome completo obrigatório.").max(120),
  documento: z.string().min(1, "CPF/CNPJ obrigatório.").max(20),
  documento_tipo: z.enum(["cpf", "cnpj"]).optional(),
  razao_social: z.string().max(140).optional(),
  endereco: z.string().max(200).optional(),
  telefone: z.string().max(30).optional(),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  email: z.string().max(120).optional(),
  // Chave PIX (só faz sentido pro artista brasileiro) — texto livre.
  pix: z.string().max(140).optional(),
  // Acesso ao sistema (criado junto)
  username_raiz: usernameRaizSchema,
  // Cidade onde reside (referência IBGE)
  cidade_ibge_id: z.string().min(1).max(20).optional(),
  cidade_nome: z.string().min(1).max(120).optional(),
  cidade_uf: z.string().length(2).optional(),
  // Cidade global (catálogo `cidades`) — canônico; o client resolve pro UUID.
  cidade_id: z.string().uuid().nullable().optional(),
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
  rider_tecnico: z
    .array(itemRiderSchema)
    .max(
      LIMITE_RIDER_TECNICO,
      `Máximo ${LIMITE_RIDER_TECNICO} itens no rider técnico.`
    )
    .optional(),
  // Presets de rider (mig 97): até 3 conjuntos nomeados por categoria, cada
  // item COM quantidade. O service ainda roda normalizarPresets antes de
  // gravar (defesa em profundidade — descarta slot vazio/qtd 0).
  rider_presets: z
    .object({
      camarim: z.array(presetRiderSchema).max(3).optional(),
      efeitos: z.array(presetRiderSchema).max(3).optional(),
      tecnico: z.array(presetRiderSchema).max(3).optional(),
    })
    .optional(),
  // Privacidade do DJ — cada campo é opcional; o merge com o padrão é
  // feito no mapper (privacidadeValida). Persistido em artists.privacidade.
  privacidade: z
    .object({
      orcamentosVer: z.boolean().optional(),
      orcamentosCriar: z.boolean().optional(),
      vendasVer: z.boolean().optional(),
      vendasCriar: z.boolean().optional(),
      financeiroVer: z.boolean().optional(),
      financeiroInformar: z.boolean().optional(),
      contratosVer: z.boolean().optional(),
      contratosCriar: z.boolean().optional(),
      agendaTotal: z.boolean().optional(),
      agendaVerDetalhado: z.boolean().optional(),
      contatos: z.enum(["nenhum", "proprios", "todos"]).optional(),
    })
    .optional(),
});
export type ArtistaCreateInput = z.infer<typeof artistaCreateSchema>;

/**
 * Update: tudo opcional. O admin pode editar:
 *  - `username_raiz` → o backend cuida de sincronizar profiles.username
 *    e o email fake interno do auth (se ainda for interno)
 *  - `email_conta` → atualiza o email do auth.users (admin marca como
 *    verificado direto)
 */
export const artistaUpdateSchema = artistaCreateSchema
  .extend({
    email_conta: z
      .string()
      .email("E-mail inválido.")
      .max(120)
      .optional(),
  })
  .partial();
export type ArtistaUpdateInput = z.infer<typeof artistaUpdateSchema>;
