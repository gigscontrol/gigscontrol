import type { Contrato } from "@/lib/mappers/contrato";

/**
 * Descrição "humana" de um contrato pra exibir nas listas: puxa o NOME DO
 * EVENTO + ARTISTA + DATA da venda vinculada (quando existe), deixando o número
 * (CTR-0000) como referência secundária — não como título principal.
 */
export type ContratoDescricao = {
  /** Título principal: nome do evento (da venda) ou o número como fallback. */
  titulo: string;
  /** true se o título veio do evento (não é só o número). */
  temEvento: boolean;
  /** Nome do artista da venda vinculada, se houver. */
  artista: string | null;
  /** Data relevante (data do show, ou emissão como fallback). ISO. */
  data: string | null;
  numero: string;
};

type VendaLike = { id: string; nomeEvento?: string; djId?: string; dataShow?: string };
type ArtistaLike = { id: string; name: string };

export function descreverContrato(
  contrato: Contrato,
  vendas: ReadonlyArray<VendaLike>,
  artistas: ReadonlyArray<ArtistaLike>
): ContratoDescricao {
  const venda = contrato.vendaId
    ? vendas.find((v) => v.id === contrato.vendaId)
    : undefined;
  const evento = venda?.nomeEvento?.trim() || "";
  const artista = venda?.djId
    ? artistas.find((a) => a.id === venda.djId)?.name ?? null
    : null;
  const data = (venda?.dataShow || contrato.dataEmissao) ?? null;
  return {
    titulo: evento || contrato.numero,
    temEvento: !!evento,
    artista,
    data,
    numero: contrato.numero,
  };
}

/** ISO/YYYY-MM-DD → DD/MM/AAAA; "—" se vazio/ inválido. */
export function formatarDataCurta(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
