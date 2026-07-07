import { PDFDocument, type PDFImage } from "pdf-lib";
import type { ContratoPdfLayout } from "@/lib/mappers/contrato";

export type SignatarioCarimbo = {
  ordem: number;
  status: "pendente" | "assinado";
  /** Data URL da assinatura desenhada (image/png de preferência). */
  assinatura: string | null;
};

/** "data:image/png;base64,XXXX" → bytes + tipo. null se não casar. */
function imgDeDataUrl(
  dataUrl: string
): { bytes: Uint8Array; tipo: "png" | "jpg" } | null {
  const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return null;
  return {
    bytes: new Uint8Array(Buffer.from(m[2], "base64")),
    tipo: /^jp/i.test(m[1]) ? "jpg" : "png",
  };
}

/**
 * Carimba as assinaturas dos signatários que JÁ assinaram sobre o PDF-fonte,
 * nas coordenadas do layout. Preserva o PDF vetorial original (só desenha por
 * cima). Determinístico e idempotente — pode recarimbar a cada download.
 *
 * COORDENADAS: o layout guarda fração 0..1 com origem no TOPO-esquerda (DOM).
 * pdf-lib tem origem no FUNDO-esquerda e `drawImage` ancora no canto
 * inferior-esquerdo → converte com flip do Y: `y = pageH - (yRel*pageH) - drawH`.
 * (Esquecer o `- drawH` joga a assinatura uma altura inteira pra cima.)
 *
 * Campo cujo signatário ainda não assinou fica EM BRANCO (não quebra).
 */
export async function carimbarPdf(
  original: ArrayBuffer,
  layout: ContratoPdfLayout,
  signatarios: SignatarioCarimbo[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const pages = doc.getPages();
  const cache = new Map<number, PDFImage | null>();

  async function imgDoSignatario(ordem: number): Promise<PDFImage | null> {
    if (cache.has(ordem)) return cache.get(ordem) ?? null;
    const sig = signatarios.find((s) => s.ordem === ordem);
    let img: PDFImage | null = null;
    if (sig && sig.status === "assinado" && sig.assinatura) {
      const dec = imgDeDataUrl(sig.assinatura);
      if (dec) {
        try {
          img =
            dec.tipo === "png"
              ? await doc.embedPng(dec.bytes)
              : await doc.embedJpg(dec.bytes);
        } catch {
          img = null; // assinatura corrompida → deixa em branco, não quebra
        }
      }
    }
    cache.set(ordem, img);
    return img;
  }

  for (const campo of layout.campos) {
    if (campo.pagina < 0 || campo.pagina >= pages.length) continue;
    const img = await imgDoSignatario(campo.signatarioOrdem);
    if (!img) continue;
    const page = pages[campo.pagina];
    const { width: pageW, height: pageH } = page.getSize();
    const drawW = campo.wRel * pageW;
    const drawH = campo.hRel * pageH;
    const x = campo.xRel * pageW;
    const y = pageH - campo.yRel * pageH - drawH; // flip do Y
    page.drawImage(img, { x, y, width: drawW, height: drawH });
  }

  return doc.save();
}
