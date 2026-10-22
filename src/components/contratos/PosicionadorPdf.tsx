"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import { Trash2, MousePointerClick, Plus } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { CampoAssinatura } from "@/lib/mappers/contrato";
import { corComoTexto } from "@/lib/contraste";

// pdfjs referencia DOMMatrix (API de browser) já no import → NÃO pode carregar
// no SSR (Node). Importado DINAMICAMENTE dentro do effect (client-only), abaixo.

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
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setErro(null);
    (async () => {
      // Build "legacy" do pdfjs (o v6 padrão usa `import.meta`, que o minify do
      // Next quebra no build de produção). Com transpilePackages no next.config
      // o import.meta do módulo principal é resolvido.
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // Worker servido de /public (path estático, mesma origem → não bate na CSP
      // e NÃO passa pelo webpack/Terser, que quebrava no import/export do .mjs).
      // O arquivo é copiado de node_modules pelo script `copy-pdf-worker`.
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      if (cancelado) return;
      loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
      try {
        const d = await loadingTask.promise;
        if (!cancelado) setDoc(d);
      } catch {
        if (!cancelado) setErro(t("Falha ao renderizar o PDF."));
      }
    })();
    return () => {
      cancelado = true;
      loadingTask?.destroy();
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
          {t("Toque ou clique no documento (ou use “Adicionar” em cada página) pra colocar a assinatura de:")}
        </span>
        {signatarios.map((s) => {
          const ativo = s.ordem === sigAtiva;
          const n = campos.filter((c) => c.signatarioOrdem === s.ordem).length;
          return (
            <button
              key={s.ordem}
              type="button"
              aria-pressed={ativo}
              onClick={() => setSigAtiva(s.ordem)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors"
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
              nomeAtivo={nomeDe(sigAtiva)}
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
  /** Signatário escolhido na barra (o botão "Adicionar" usa ele). */
  nomeAtivo: string;
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
  nomeAtivo,
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

  // Teclado no campo focado: setas movem, Shift+setas mudam o tamanho
  // (passo de 1%; Alt = 0,2% pro ajuste fino), Delete/Backspace remove.
  function onTecla(e: React.KeyboardEvent, c: CampoAssinatura) {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemover(c.id);
      return;
    }
    const passo = e.altKey ? 0.002 : 0.01;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    if (e.shiftKey) {
      onRedimensionar(
        c.id,
        clamp(c.wRel + d[0] * passo, 0.05, 1 - c.xRel),
        clamp(c.hRel + d[1] * passo, 0.02, 1 - c.yRel)
      );
    } else {
      onMover(
        c.id,
        clamp(c.xRel + d[0] * passo, 0, 1 - c.wRel),
        clamp(c.yRel + d[1] * passo, 0, 1 - c.hRel)
      );
    }
  }

  return (
    <div className="w-full max-w-[720px] flex flex-col gap-1.5">
    {/* Alternativa ao clique no papel: teclado, leitor de tela e toque sem
        precisar acertar o ponto. O campo nasce no centro e se ajusta depois. */}
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted">{t("Página {n}", { n: pagina + 1 })}</span>
      <button
        type="button"
        onClick={() => onAdicionar(0.5, 0.5)}
        disabled={!pronto}
        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1.5 rounded"
      >
        <Plus size={13} />
        {t("Adicionar assinatura de {nome} nesta página", { nome: nomeAtivo })}
      </button>
    </div>
    <div
      ref={wrapRef}
      className="relative w-full border border-border rounded shadow-sm bg-white select-none"
      onPointerMove={onPointerMove}
      onPointerUp={encerrar}
      onPointerCancel={encerrar}
      onLostPointerCapture={() => {
        arraste.current = null;
      }}
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
              role="group"
              tabIndex={0}
              aria-label={t("Assinatura de {nome}. Setas movem, Shift+setas mudam o tamanho, Delete remove.", {
                nome: nomeDe(c.signatarioOrdem),
              })}
              onKeyDown={(e) => onTecla(e, c)}
              className="absolute rounded-sm flex items-center justify-center text-micro font-medium cursor-move group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                left: `${c.xRel * 100}%`,
                top: `${c.yRel * 100}%`,
                width: `${c.wRel * 100}%`,
                height: `${c.hRel * 100}%`,
                border: `1.5px dashed ${cor}`,
                backgroundColor: `color-mix(in srgb, ${cor} 14%, transparent)`,
                color: corComoTexto(cor, "claro"), // folha do PDF é sempre branca
                // No toque, arrastar o campo move o campo (não rola a página).
                touchAction: "none",
                outlineColor: cor,
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
                // Visível no hover, no foco do campo e sempre no toque (sem hover).
                className="alvo-toque absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:-top-3.5 [@media(pointer:coarse)]:-right-3.5 [@media(pointer:coarse)]:h-7 [@media(pointer:coarse)]:w-7"
                aria-label={t("Remover campo")}
              >
                <Trash2 size={11} />
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
                className="absolute -bottom-1 -right-1 h-3 w-3 rounded-sm cursor-se-resize [@media(pointer:coarse)]:-bottom-2.5 [@media(pointer:coarse)]:-right-2.5 [@media(pointer:coarse)]:h-6 [@media(pointer:coarse)]:w-6"
                style={{ backgroundColor: cor, touchAction: "none" }}
              />
            </div>
          );
        })}
    </div>
    </div>
  );
}
