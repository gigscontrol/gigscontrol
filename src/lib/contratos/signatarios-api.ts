/**
 * Helpers de fetch (client) pros signatários de um contrato — usados pela
 * tela da agência (definir signatários / pegar os links). A página pública
 * de assinatura tem o seu próprio fetch (em /assinar/[token]).
 */
import type {
  Signatario,
  ExigenciasSignatario,
} from "@/lib/mappers/contratoSignatario";
import type { AssinaturaInfo } from "@/components/contratos/folhaA4";

export type EntradaSignatarioUI = {
  nome: string;
  email: string;
  papel: string;
  exige: ExigenciasSignatario;
};

/**
 * Signatário → AssinaturaInfo (dados do relatório da folha A4). Inclui as URLs
 * assinadas de foto/selfie (KYC) — só chegam quando é a agência que lista
 * (a rota pública não as devolve), então a folha interna mostra o KYC e a
 * pública não. Usado pelos dois botões de "PDF assinado" (Painel e Histórico)
 * para que produzam o MESMO PDF.
 */
export function paraAssinaturaInfo(s: Signatario): AssinaturaInfo {
  return {
    nome: s.nome,
    papel: s.papel,
    documento: s.documento,
    email: s.email,
    ip: s.ip,
    geolocalizacao: s.geolocalizacao,
    dispositivo: s.dispositivo,
    assinadoEm: s.assinadoEm,
    assinatura: s.assinatura,
    fotoCpfUrl: s.arquivosUrls?.fotoCpf,
    fotoDocumentoUrl: s.arquivosUrls?.fotoDocumento,
    fotoDocumentoVersoUrl: s.arquivosUrls?.fotoDocumentoVerso,
    selfieUrl: s.arquivosUrls?.selfie,
    facialSimilaridade: s.arquivos.facialSimilaridade,
    facialMatch: s.arquivos.facialMatch,
  };
}

/** URL da rota que carimba + anexa o relatório num contrato POR UPLOAD (PDF). */
export function urlPdfAssinado(contratoId: string): string {
  return `/api/contratos/${contratoId}/pdf-assinado`;
}

async function jsonOuErro(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((body.erro as string) ?? `HTTP ${res.status}`);
  return body;
}

export async function buscarSignatarios(
  contratoId: string
): Promise<Signatario[]> {
  const res = await fetch(`/api/contratos/${contratoId}/signatarios`, {
    credentials: "include",
  });
  const body = await jsonOuErro(res);
  return (body.signatarios as Signatario[]) ?? [];
}

export async function definirSignatarios(
  contratoId: string,
  signatarios: EntradaSignatarioUI[]
): Promise<Signatario[]> {
  const res = await fetch(`/api/contratos/${contratoId}/signatarios`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signatarios }),
  });
  const body = await jsonOuErro(res);
  return (body.signatarios as Signatario[]) ?? [];
}

/** URL pública de assinatura a partir do token (origin atual). */
export function linkAssinatura(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/assinar/${token}`;
}
