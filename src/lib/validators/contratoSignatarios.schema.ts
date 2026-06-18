import { z } from "zod";

const exigeSchema = z
  .object({
    assinaturaTela: z.boolean().optional(),
    cpfCnpj: z.boolean().optional(),
    fotoCpf: z.boolean().optional(),
    fotoDocumento: z.boolean().optional(),
    selfie: z.boolean().optional(),
    facial: z.boolean().optional(),
  })
  .optional();

/** Define a lista de signatários de um contrato (agência). */
export const definirSignatariosSchema = z.object({
  signatarios: z
    .array(
      z.object({
        nome: z.string().min(1, "Nome obrigatório.").max(120),
        // E-mail é opcional (não enviamos e-mail nesta fase — o link é
        // compartilhado manualmente). Se vier, precisa ser válido.
        email: z
          .string()
          .email("E-mail inválido.")
          .max(120)
          .optional()
          .or(z.literal("")),
        papel: z.string().max(40).nullable().optional(),
        exige: exigeSchema,
      })
    )
    .min(1, "Adicione ao menos um signatário.")
    .max(10, "Máximo de 10 signatários."),
});

/** Submissão da assinatura (página pública). */
export const assinarSchema = z.object({
  assinatura: z.string().min(1, "Assinatura obrigatória."),
  documento: z.string().max(40).optional().or(z.literal("")),
  geolocalizacao: z.string().max(160).optional().or(z.literal("")),
  // Fotos (data URLs base64, já reduzidas no cliente) — só quando exigidas.
  fotoCpf: z.string().optional().or(z.literal("")),
  fotoDocumento: z.string().optional().or(z.literal("")),
  selfie: z.string().optional().or(z.literal("")),
});

export type DefinirSignatariosInput = z.infer<typeof definirSignatariosSchema>;
export type AssinarInput = z.infer<typeof assinarSchema>;
