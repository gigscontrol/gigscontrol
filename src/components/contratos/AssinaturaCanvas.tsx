"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

type AssinaturaCanvasProps = {
  /** dataUrl PNG quando há traço; null quando limpo/vazio */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
};

const CANVAS_HEIGHT = 170;
const INK = "#111";
const LINE_WIDTH = 2.2;

export default function AssinaturaCanvas({
  onChange,
  disabled = false,
}: AssinaturaCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [temTraco, setTemTraco] = useState(false);

  // Keep a stable ref to onChange so the resize effect doesn't re-run on every render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /** Paint the light "paper" background + baseline. Coordinates are in CSS pixels. */
  const paintBackground = useCallback((ctx: CanvasRenderingContext2D, cssWidth: number) => {
    ctx.save();
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, cssWidth, CANVAS_HEIGHT);
    // thin baseline near the bottom
    ctx.strokeStyle = "#d4d4d8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(16, CANVAS_HEIGHT - 34);
    ctx.lineTo(cssWidth - 16, CANVAS_HEIGHT - 34);
    ctx.stroke();
    ctx.restore();
  }, []);

  /** (Re)size the backing store to the displayed size × dpr and scale the context. */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const cssWidth = wrapper.clientWidth;
    if (cssWidth <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(CANVAS_HEIGHT * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paintBackground(ctx, cssWidth);
    // Resizing clears any prior stroke; reset state and notify parent.
    setTemTraco(false);
    onChangeRef.current(null);
  }, [paintBackground]);

  useEffect(() => {
    setupCanvas();
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [setupCanvas]);

  const getPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture can throw on some browsers; ignore */
      }
      drawingRef.current = true;
      const p = getPoint(e);
      lastPointRef.current = p;
      // Draw an initial dot so a tap leaves a mark.
      ctx.strokeStyle = INK;
      ctx.lineWidth = LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
      if (!temTraco) setTemTraco(true);
    },
    [disabled, getPoint, temTraco],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled || !drawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      const last = lastPointRef.current;
      if (!ctx || !last) return;
      e.preventDefault();
      const p = getPoint(e);
      ctx.strokeStyle = INK;
      ctx.lineWidth = LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPointRef.current = p;
    },
    [disabled, getPoint],
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (temTraco) {
      onChange(canvas.toDataURL("image/png"));
    } else {
      onChange(null);
    }
  }, [onChange, temTraco]);

  const handleLimpar = useCallback(() => {
    if (disabled) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && wrapper && ctx) {
      paintBackground(ctx, wrapper.clientWidth);
    }
    setTemTraco(false);
    onChange(null);
  }, [disabled, onChange, paintBackground]);

  return (
    <div className="w-full">
      <div
        ref={wrapperRef}
        className={`relative w-full overflow-hidden rounded-md border border-border bg-[#fafafa] ${
          disabled ? "opacity-50" : ""
        }`}
        style={{ height: CANVAS_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          className={`block ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
        />
        {!temTraco && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm italic text-zinc-400 select-none">
            assine aqui
          </span>
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={handleLimpar}
          disabled={disabled || !temTraco}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Eraser className="h-4 w-4" />
          Limpar
        </button>
      </div>
    </div>
  );
}
