import { z } from "zod";
import { uuidLike } from "./uuid";

// ---------- Cidades ----------

export const cidadeCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório").max(120),
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
  nome: z.string().min(1, "nome obrigatório").max(160),
  tipo: tipoCasaEnum,
  cidade_id: uuidLike.nullable().optional(),
  // Aceita number, string ou null — coage pra inteiro >= 0. Mesmo padrão
  // de vendas.capacidade_publico: cliente manda number, integrações
  // externas tendem a mandar string. Vazio/NaN viram null.
  capacidade: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n =
        typeof v === "number" ? v : Number(String(v).replace(/\D/g, ""));
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    }),
  endereco: z.string().max(200).nullable().optional(),
  contato_responsavel: z.string().max(120).nullable().optional(),
  telefone: z.string().max(40).nullable().optional(),
});
export type CasaCreateInput = z.infer<typeof casaCreateSchema>;
// Bloqueio só é aceito no PATCH (bloqueado_por/bloqueado_em são carimbados no
// servidor com o usuário da sessão — não vêm do cliente).
export const casaUpdateSchema = casaCreateSchema.partial().extend({
  bloqueado: z.boolean().optional(),
  bloqueado_motivo: z.string().max(500).nullable().optional(),
});
export type CasaUpdateInput = z.infer<typeof casaUpdateSchema>;

// ---------- Contratantes ----------

export const contratanteCreateSchema = z.object({
  nome: z.string().min(1, "nome obrigatório").max(160),
  documento: z.string().max(60).nullable().optional(),
  // Razão social do documento (migração 91). O servidor só a mantém quando o
  // documento é de empresa (`ehDocumentoEmpresa`) — ver contratantes.service.
  razao_social: z.string().max(140).nullable().optional(),
  // PF/Empresa escolhido manualmente (só países ambíguos — migração-zero, vai
  // pro jsonb `documentos[].tipo`). Países com regra ignoram (a regra ganha).
  documento_tipo: z.enum(["pf", "pj"]).nullable().optional(),
  pais: z.string().length(2).nullable().optional(),
  email: z.string().email("e-mail inválido").nullable().optional().or(z.literal("")),
  telefone: z.string().max(40).nullable().optional(),
  endereco: z.string().max(200).nullable().optional(),
  cidade_id: uuidLike.nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});
export type ContratanteCreateInput = z.infer<typeof contratanteCreateSchema>;
// Bloqueio só é aceito no PATCH (bloqueado_por/bloqueado_em são carimbados no
// servidor com o usuário da sessão — não vêm do cliente).
export const contratanteUpdateSchema = contratanteCreateSchema.partial().extend({
  bloqueado: z.boolean().optional(),
  bloqueado_motivo: z.string().max(500).nullable().optional(),
});
export type ContratanteUpdateInput = z.infer<typeof contratanteUpdateSchema>;
