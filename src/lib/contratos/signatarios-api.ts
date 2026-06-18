/**
 * Helpers de fetch (client) pros signatários de um contrato — usados pela
 * tela da agência (definir signatários / pegar os links). A página pública
 * de assinatura tem o seu próprio fetch (em /assinar/[token]).
 */
import type {
  Signatario,
  ExigenciasSignatario,
} from "@/lib/mappers/contratoSignatario";

export type EntradaSignatarioUI = {
  nome: string;
  email: string;
  papel: string;
  exige: ExigenciasSignatario;
};

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
