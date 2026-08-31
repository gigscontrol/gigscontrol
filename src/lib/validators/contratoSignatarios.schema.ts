import { z } from "zod";
import { MAX_SIGNATARIOS } from "@/lib/mappers/contratoSignatario";

const exigeSchema = z
  .object({
    assinaturaTela: z.boolean().optional(),
    cpfCnpj: z.boolean().optional(),
    fotoCpf: z.boolean().optional(),
    fotoDocumento: z.boolean().optional(),
    selfie: z.boolean().optional(),
    facial: z.boolean().optional(),
    otpEmail: z.boolean().optional(),
  })
  .optional();

/** Define a lista de signatários de um contrato (agência). */
export const definirSignatariosSchema = z.object({
  signatarios: z
    .array(
      z
        .object({
          nome: z.string().min(1, "Nome obrigatório.").max(120),
          // E-mail é opcional (não enviamos e-mail nesta fase — o link é
          // compartilhado manualmente). Se vier, precisa ser válido.
          email: z
            .string()
            .email("E-mail inválido.")
            .max(120)
            .optional()
            .or(z.literal("")),
          telefone: z.string().max(30).optional().or(z.literal("")),
          papel: z.string().max(40).nullable().optional(),
          exige: exigeSchema,
        })
        // OTP por e-mail só faz sentido COM e-mail — barra na origem.
        .refine((s) => !s.exige?.otpEmail || !!s.email, {
          message: "Verificação por e-mail (OTP) exige o e-mail do signatário.",
          path: ["email"],
        })
    )
    .min(1, "Adicione ao menos um signatário.")
    .max(MAX_SIGNATARIOS, `Máximo de ${MAX_SIGNATARIOS} signatários.`),
});

// Teto dos blobs base64 da rota PÚBLICA (sem login — o token é a credencial).
// A assinatura é um PNG de traço (pequeno); as fotos já vêm reduzidas no
// cliente. Sem teto, um signatário grava um blob enorme (assinatura vai pro
// TEXT do banco, fotos pro bucket sem file_size_limit) e toda abertura pública
// do link passa a carregá-lo. ~1,5 MB de base64 cobre com folga um PNG legítimo.
const MAX_ASSINATURA = 1_500_000; // ~1,1 MB de bytes decodificados
const MAX_FOTO = 4_000_000; // ~3 MB — foto de documento reduzida

/** Submissão da assinatura (página pública). */
export const assinarSchema = z.object({
  assinatura: z.string().min(1, "Assinatura obrigatória.").max(MAX_ASSINATURA),
  documento: z.string().max(40).optional().or(z.literal("")),
  geolocalizacao: z.string().max(160).optional().or(z.literal("")),
  /** Fuso IANA do navegador (evidência — mig 98), ex.: America/Sao_Paulo. */
  fusoHorario: z.string().max(64).optional().or(z.literal("")),
  // Fotos (data URLs base64, já reduzidas no cliente) — só quando exigidas.
  fotoCpf: z.string().max(MAX_FOTO).optional().or(z.literal("")),
  fotoDocumento: z.string().max(MAX_FOTO).optional().or(z.literal("")),
  fotoDocumentoVerso: z.string().max(MAX_FOTO).optional().or(z.literal("")),
  selfie: z.string().max(MAX_FOTO).optional().or(z.literal("")),
});

/** Verificação do código OTP (página pública). */
export const otpVerificarSchema = z.object({
  codigo: z
    .string()
    .regex(/^\d{6}$/, "Código de 6 dígitos."),
});

export type DefinirSignatariosInput = z.infer<typeof definirSignatariosSchema>;
export type AssinarInput = z.infer<typeof assinarSchema>;
