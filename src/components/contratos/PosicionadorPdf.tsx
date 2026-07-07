"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Trash2, MousePointerClick } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { CampoAssinatura } from "@/lib/mappers/contrato";

// Worker do pdf.js como asset local (mesma origem → não bate na CSP).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export type SignatarioLite = { ordem: number; nome: string; cor: string };

type Props = {
  /** URL assinada do PDF-fonte. */
  pdfUrl: string;
  paginas: number;
  signatarios: SignatarioLite[];
  campos: CampoAssinatura[];
  onChange: (campos: CampoAssinatura[]) => void;
};

const W_PADRAO = 0.24;
const H_PADRAO = 0.06;
let seq = 0;
const novoId = () => `c${Date.now()}-${seq++}`;
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

export default function PosicionadorPdf({
  pdfUrl,
  paginas,
  signatarios,
  campos,
  onChange,
}: Props) {
  const t = useT();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sigAtiva, setSigAtiva] = useState<number>(signatarios[0]?.ordem ?? 0);

  useEffect(() => {
    let cancelado = false;
    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
    setErro(null);
    loadingTask.promise
      .then((d) => {
        if (!cancelado) setDoc(d);
      })
      .catch(() => !cancelado && setErro(t("Falha ao renderizar o PDF.")));
    return () => {
      cancelado = true;
      loadingTask.destroy();
    };
  }, [pdfUrl, t]);

  const corDe = useCallback(
    (ordem: number) => signatarios.find((s) => s.ordem === ordem)?.cor ?? "#3D7BFF",
    [signatarios]
  );
  const nomeDe = useCallback(
    (ordem: number) => signatarios.find((s) => s.ordem === ordem)?.nome ?? "—",
    [signatarios]
  );

  function adicionar(pagina: number, xRel: number, yRel: number) {
    onChange([
      ...campos,
      {
        id: novoId(),
        signatarioOrdem: sigAtiva,
        tipo: "assinatura",
        pagina,
        xRel: clamp(xRel - W_PADRAO / 2, 0, 1 - W_PADRAO),
        yRel: clamp(yRel - H_PADRAO / 2, 0, 1 - H_PADRAO),
        wRel: W_PADRAO,
        hRel: H_PADRAO,
      },
    ]);
  }
  const atualizar = (id: string, patch: Partial<CampoAssinatura>) =>
    onChange(campos.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remover = (id: string) => onChange(campos.filter((c) => c.id !== id));

  return (
    <div className="flex flex-col gap-3">
      {/* Barra: escolher de quem é a assinatura */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted inline-flex items-center gap-1.5">
          <MousePointerClick size={13} />
          {t("Clique no documento pra colocar a assinatura de:")}
        </span>
        {signatarios.map((s) => {
          const ativo = s.ordem === sigAtiva;
          const n = campos.filter((c) => c.signatarioOrdem === s.ordem).length;
          return (
            <button
              key={s.ordem}
              type="button"
              onClick={() => setSigAtiva(s.ordem)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
              style={{
                borderColor: s.cor,
                backgroundColor: ativo ? s.cor : "transparent",
                color: ativo ? "#fff" : "var(--text-primary)",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: ativo ? "#fff" : s.cor }}
              />
              {s.nome} · {n}
            </button>
          );
        })}
      </div>

      {erro && <div className="text-xs text-danger">{erro}</div>}
      {!doc && !erro && (
        <div className="text-xs text-muted">{t("Carregando o PDF…")}</div>
      )}

      {/* Páginas */}
      <div className="flex flex-col items-center gap-4">
        {doc &&
          Array.from({ length: paginas }, (_, i) => (
            <PaginaPdf
              key={i}
              doc={doc}
              pagina={i}
              campos={campos.filter((c) => c.pagina === i)}
              corDe={corDe}
              nomeDe={nomeDe}
              onAdicionar={(x, y) => adicionar(i, x, y)}
              onMover={(id, x, y) => atualizar(id, { xRel: x, yRel: y })}
              onRedimensionar={(id, w, h) => atualizar(id, { wRel: w, hRel: h })}
              onRemover={remover}
            />
          ))}
      </div>
    </div>
  );
}

type PaginaProps = {
  doc: PDFDocumentProxy;
  pagina: number;
  campos: CampoAssinatura[];
  corDe: (ordem: number) => string;
  nomeDe: (ordem: number) => string;
  onAdicionar: (xRel: number, yRel: number) => void;
  onMover: (id: string, xRel: number, yRel: number) => void;
  onRedimensionar: (id: string, wRel: number, hRel: number) => void;
  onRemover: (id: string) => void;
};

function PaginaPdf({
  doc,
  pagina,
  campos,
  corDe,
  nomeDe,
  onAdicionar,
  onMover,
  onRedimensionar,
  onRemover,
}: PaginaProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pronto, setPronto] = useState(false);
  const arraste = useRef<{
    id: string;
    modo: "mover" | "resize";
    px: number;
    py: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const page = await doc.getPage(pagina + 1); // pdfjs é 1-based
      if (cancelado) return;
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const larguraAlvo = wrap.clientWidth || 600;
      const base = page.getViewport({ scale: 1 });
      const scale = larguraAlvo / base.width;
      const viewport = page.getViewport({ scale });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.height = `${viewport.height}px`;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      if (!cancelado) setPronto(true);
    })();
    return () => {
      cancelado = true;
    };
  }, [doc, pagina]);

  // Move/resize via pointer no wrap (coordenadas relativas ao tamanho renderizado).
  function onPointerMove(e: React.PointerEvent) {
    const a = arraste.current;
    const wrap = wrapRef.current;
    if (!a || !wrap) return;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const dx = (e.clientX - a.px) / W;
    const dy = (e.clientY - a.py) / H;
    if (a.modo === "mover") {
      onMover(a.id, clamp(a.x + dx, 0, 1 - a.w), clamp(a.y + dy, 0, 1 - a.h));
    } else {
      onRedimensionar(
        a.id,
        clamp(a.w + dx, 0.05, 1 - a.x),
        clamp(a.h + dy, 0.02, 1 - a.y)
      );
    }
  }
  function encerrar(e: React.PointerEvent) {
    if (arraste.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      arraste.current = null;
    }
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full max-w-[720px] border border-border rounded shadow-sm bg-white select-none"
      onPointerMove={onPointerMove}
      onPointerUp={encerrar}
      onPointerLeave={encerrar}
      onClick={(e) => {
        // Clicar numa área vazia adiciona um campo. Ignora clique que veio de arraste.
        if (arraste.current || e.defaultPrevented) return;
        const wrap = wrapRef.current;
        if (!wrap || (e.target as HTMLElement).dataset.campo) return;
        const rect = wrap.getBoundingClientRect();
        onAdicionar((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
      }}
    >
      <canvas ref={canvasRef} className="w-full block rounded" />
      {pronto &&
        campos.map((c) => {
          const cor = corDe(c.signatarioOrdem);
          return (
            <div
              key={c.id}
              data-campo="1"
              className="absolute rounded-sm flex items-center justify-center text-[10px] font-medium cursor-move group"
              style={{
                left: `${c.xRel * 100}%`,
                top: `${c.yRel * 100}%`,
                width: `${c.wRel * 100}%`,
                height: `${c.hRel * 100}%`,
                border: `1.5px dashed ${cor}`,
                backgroundColor: `color-mix(in srgb, ${cor} 14%, transparent)`,
                color: cor,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                arraste.current = {
                  id: c.id,
                  modo: "mover",
                  px: e.clientX,
                  py: e.clientY,
                  x: c.xRel,
                  y: c.yRel,
                  w: c.wRel,
                  h: c.hRel,
                };
              }}
            >
              <span className="truncate px-1 pointer-events-none">
                ✍ {nomeDe(c.signatarioOrdem)}
              </span>
              {/* Remover */}
              <button
                type="button"
                data-campo="1"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemover(c.id);
                }}
                className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                aria-label={t("Remover campo")}
              >
                <Trash2 size={9} />
              </button>
              {/* Handle de resize (canto inferior-direito) */}
              <span
                data-campo="1"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  arraste.current = {
                    id: c.id,
                    modo: "resize",
                    px: e.clientX,
                    py: e.clientY,
                    x: c.xRel,
                    y: c.yRel,
                    w: c.wRel,
                    h: c.hRel,
                  };
                }}
                className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm cursor-se-resize"
                style={{ backgroundColor: cor }}
              />
            </div>
          );
        })}
    </div>
  );
}
