import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import type { ContratoPdfLayout } from "@/lib/mappers/contrato";
import { resumirDispositivo } from "./dispositivo";

export type SignatarioCarimbo = {
  ordem: number;
  status: "pendente" | "assinado";
  /** Data URL da assinatura desenhada (image/png de preferência). */
  assinatura: string | null;
  // Campos do relatório de assinaturas (anexado após o documento).
  nome?: string;
  papel?: string | null;
  documento?: string | null;
  email?: string | null;
  ip?: string | null;
  dispositivo?: string | null;
  geolocalizacao?: string | null;
  assinadoEm?: string | null;
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

async function embedAssinatura(
  doc: PDFDocument,
  dataUrl: string
): Promise<PDFImage | null> {
  const dec = imgDeDataUrl(dataUrl);
  if (!dec) return null;
  try {
    return dec.tipo === "png"
      ? await doc.embedPng(dec.bytes)
      : await doc.embedJpg(dec.bytes);
  } catch {
    return null; // assinatura corrompida → ignora, não quebra
  }
}

/**
 * Helvetica (padrão do pdf-lib) codifica em WinAnsi (Latin-1): acentos pt-BR
 * passam, mas nada fora disso — emoji, travessão/aspas tipográficas etc. fazem
 * o drawText estourar. Normaliza os tipográficos comuns e descarta o resto.
 */
function winAnsi(s: string): string {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E -ÿ]/g, "?");
}

/** ISO → DD/MM/AAAA HH:MM (só a parte que existir). */
function dataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.slice(0, 10).split("-");
  const h = iso.slice(11, 16);
  if (d.length !== 3) return iso;
  return `${d[2]}/${d[1]}/${d[0]}${h ? ` ${h}` : ""}`;
}

function dataHojeBr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Anexa a(s) página(s) de "Relatório de assinaturas" ao final do PDF, em texto
 * via pdf-lib (Helvetica/WinAnsi). Cabeçalho + um bloco por signatário
 * (nome/status, grade rótulo:valor e miniatura da assinatura). Pagina sozinho
 * quando não cabe. Nunca desenha foto/selfie (KYC) — só o relatório.
 */
async function anexarRelatorio(
  doc: PDFDocument,
  signatarios: SignatarioCarimbo[],
  numero: string | undefined
): Promise<void> {
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const MX = 48;
  const MTOP = 56;
  const MBOT = 48;
  const corTexto = rgb(0.1, 0.1, 0.12);
  const corMuted = rgb(0.45, 0.47, 0.52);
  const corLinha = rgb(0.85, 0.86, 0.9);

  let page = doc.addPage([W, H]);
  let y = H - MTOP;

  const novaPagina = () => {
    page = doc.addPage([W, H]);
    y = H - MTOP;
  };
  const espaco = (h: number) => {
    if (y - h < MBOT) novaPagina();
  };
  const texto = (
    txt: string,
    x: number,
    size: number,
    f: PDFFont,
    cor = corTexto
  ) => {
    page.drawText(winAnsi(txt), { x, y, size, font: f, color: cor });
  };
  const divisor = (thickness: number) => {
    page.drawLine({
      start: { x: MX, y },
      end: { x: W - MX, y },
      thickness,
      color: corLinha,
    });
  };

  // Cabeçalho
  texto("Relatório de assinaturas", MX, 17, bold);
  y -= 20;
  const sub = [numero ? `Contrato ${numero}` : "", `Emitido em ${dataHojeBr()}`]
    .filter(Boolean)
    .join("   ·   ");
  texto(sub, MX, 9.5, fonte, corMuted);
  y -= 14;
  divisor(1);
  y -= 24;

  for (const s of signatarios) {
    const assinou = s.status === "assinado";
    const campos: [string, string][] = [];
    if (s.papel) campos.push(["Papel", s.papel]);
    if (s.documento) campos.push(["Documento", s.documento]);
    if (s.email) campos.push(["E-mail", s.email]);
    if (s.assinadoEm) campos.push(["Assinado em", dataHoraBr(s.assinadoEm)]);
    if (s.ip) campos.push(["IP", s.ip]);
    const disp = resumirDispositivo(s.dispositivo);
    if (disp) campos.push(["Dispositivo", disp]);
    if (s.geolocalizacao) campos.push(["Geolocalização", s.geolocalizacao]);

    // Reserva o bloco inteiro numa página só (nome + grade + divisor).
    espaco(20 + campos.length * 14 + 26);

    // Nome + status (status à direita).
    texto(s.nome || "-", MX, 12, bold);
    const rotStatus = assinou ? "ASSINADO" : "PENDENTE";
    const wStatus = bold.widthOfTextAtSize(rotStatus, 8);
    page.drawText(winAnsi(rotStatus), {
      x: W - MX - wStatus,
      y,
      size: 8,
      font: bold,
      color: corMuted,
    });
    y -= 18;

    // Miniatura da assinatura, à direita, no topo da grade.
    let imgAltura = 0;
    if (s.assinatura) {
      const img = await embedAssinatura(doc, s.assinatura);
      if (img) {
        const escala = Math.min(150 / img.width, 48 / img.height, 1);
        const w = img.width * escala;
        const h = img.height * escala;
        page.drawImage(img, { x: W - MX - w, y: y - h + 8, width: w, height: h });
        imgAltura = h;
      }
    }

    // Grade rótulo:valor.
    for (const [rot, val] of campos) {
      texto(rot, MX, 9, fonte, corMuted);
      texto(val, MX + 92, 9, fonte, corTexto);
      y -= 14;
    }

    // Se a assinatura for mais alta que a grade, empurra o divisor pra baixo.
    const usadoGrade = campos.length * 14;
    if (imgAltura > usadoGrade) y -= imgAltura - usadoGrade;

    y -= 10;
    espaco(1);
    divisor(0.5);
    y -= 18;
  }
}

/**
 * Carimba as assinaturas dos signatários que JÁ assinaram sobre o PDF-fonte,
 * nas coordenadas do layout, e ANEXA o relatório de assinaturas ao final.
 * Preserva o PDF vetorial original (só desenha por cima). Determinístico e
 * idempotente — pode recarimbar a cada download.
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
  signatarios: SignatarioCarimbo[],
  opts?: { numero?: string }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const pages = doc.getPages();
  const cache = new Map<number, PDFImage | null>();

  async function imgDoSignatario(ordem: number): Promise<PDFImage | null> {
    if (cache.has(ordem)) return cache.get(ordem) ?? null;
    const sig = signatarios.find((s) => s.ordem === ordem);
    let img: PDFImage | null = null;
    if (sig && sig.status === "assinado" && sig.assinatura) {
      img = await embedAssinatura(doc, sig.assinatura);
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

  // Relatório de assinaturas ao final — só quando alguém já assinou.
  if (signatarios.some((s) => s.status === "assinado")) {
    await anexarRelatorio(doc, signatarios, opts?.numero);
  }

  return doc.save();
}
