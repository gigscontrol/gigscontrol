"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Check, X } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Color picker custom no tema do GIGS CONTROL.
 *
 * Renderiza um popover dark com:
 *  - Quadrado HSV (saturação × brilho) com indicador arrastável
 *  - Slider de matiz (hue) horizontal estilo arco-íris
 *  - Input hex pra digitação manual
 *  - Preview da cor selecionada
 *  - Botão "Aplicar" no tom da plataforma
 *
 * Por que custom em vez do <input type="color"> nativo? O nativo abre
 * uma janela do sistema operacional que destoa do design do app — fica
 * branca, cantos quadrados, tipografia diferente. Esse picker mantém a
 * mesma estética dark do resto do produto.
 */

type Props = {
  /** Cor atual em hex (#rrggbb). */
  cor: string;
  /** Disparado ao clicar em "Aplicar". */
  onApply: (cor: string) => void;
  /** Fechar o popover sem aplicar. */
  onClose: () => void;
  /** Elemento que abriu o picker — usado pra calcular a altura vertical
   *  do popover (horizontalmente fica centralizado na viewport). */
  anchorRef: RefObject<HTMLElement | null>;
};

// ---------- Helpers HSV ↔ Hex ----------

type HSV = { h: number; s: number; v: number };

/** Limita um número entre min e max. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function hexParaHsv(hex: string): HSV {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return { h: 0, s: 0, v: 1 };
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvParaHex({ h, s, v }: HSV): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to255 = (n: number) => Math.round((n + m) * 255);
  const toHex = (n: number) => to255(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Cor "pura" da matiz atual (sem saturação reduzida) — usada como base
 * do gradient do quadrado SV. */
function hsvPuro(h: number): string {
  return hsvParaHex({ h, s: 1, v: 1 });
}

// ---------- Componente ----------

export default function ColorPicker({ cor, onApply, onClose, anchorRef }: Props) {
  const t = useT();
  const [hsv, setHsv] = useState<HSV>(() => hexParaHsv(cor));
  const [hexInput, setHexInput] = useState(cor.toUpperCase());
  const popRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Posição fixa na viewport: top alinhado ao anchor, horizontalmente
  // centralizado em 50%. Calculado quando abre — não acompanha scroll.
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setTop(r.bottom + 8);
  }, [anchorRef]);

  const hexAtual = hsvParaHex(hsv).toUpperCase();

  // Mantém o input hex sincronizado quando o usuário mexe nos sliders
  useEffect(() => {
    setHexInput(hexAtual);
  }, [hexAtual]);

  // ESC fecha e click fora fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  // ---- Drag handlers ----

  function handleSvPointer(e: React.PointerEvent<HTMLDivElement>) {
    const el = svRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    atualizarSv(e);
  }
  function atualizarSv(e: React.PointerEvent<HTMLDivElement>) {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    const y = clamp((e.clientY - r.top) / r.height, 0, 1);
    setHsv((prev) => ({ ...prev, s: x, v: 1 - y }));
  }

  function handleHuePointer(e: React.PointerEvent<HTMLDivElement>) {
    const el = hueRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    atualizarHue(e);
  }
  function atualizarHue(e: React.PointerEvent<HTMLDivElement>) {
    const el = hueRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1);
    setHsv((prev) => ({ ...prev, h: x * 360 }));
  }

  function aplicarHexDigitado() {
    const limpo = hexInput.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{6}$/.test(limpo)) {
      setHsv(hexParaHsv(limpo));
    } else {
      // Reverte pro hex atual válido
      setHexInput(hexAtual);
    }
  }

  return (
    <div
      ref={popRef}
      className="rounded-lg p-3 flex flex-col gap-3"
      style={{
        position: "fixed",
        top,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60, // acima do modal pai (50)
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-color)",
        boxShadow:
          "0 16px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)",
        width: 280,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header com X */}
      <div className="flex items-center justify-between -mb-1">
        <span className="text-[0.65rem] uppercase tracking-wider text-muted font-semibold">
          {t("Cor personalizada")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-primary transition-colors"
          aria-label={t("Fechar")}
        >
          <X size={14} />
        </button>
      </div>

      {/* Quadrado saturação × brilho */}
      <div
        ref={svRef}
        onPointerDown={handleSvPointer}
        onPointerMove={(e) => {
          if (e.buttons === 1) atualizarSv(e);
        }}
        className="relative rounded-md cursor-crosshair select-none"
        style={{
          width: "100%",
          height: 140,
          // Gradient layered: branco→matiz horizontal, depois preto→transparente vertical
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, ${hsvPuro(hsv.h)})
          `,
        }}
      >
        {/* Indicador da posição SV */}
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            border: "2px solid #fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)",
            backgroundColor: hexAtual,
          }}
        />
      </div>

      {/* Slider de matiz */}
      <div
        ref={hueRef}
        onPointerDown={handleHuePointer}
        onPointerMove={(e) => {
          if (e.buttons === 1) atualizarHue(e);
        }}
        className="relative rounded-full cursor-pointer select-none"
        style={{
          width: "100%",
          height: 12,
          background:
            "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
        }}
      >
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 16,
            height: 16,
            border: "2px solid #fff",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)",
            backgroundColor: hsvPuro(hsv.h),
          }}
        />
      </div>

      {/* Input hex + preview */}
      <div className="flex items-center gap-2">
        <div
          className="rounded-md flex-shrink-0"
          style={{
            width: 34,
            height: 34,
            backgroundColor: hexAtual,
            border: "1px solid var(--border-color)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        />
        <div className="flex items-center bg-elevated border border-border rounded-md px-2 py-1.5 flex-1 focus-within:border-border-strong transition-colors">
          <span className="text-xs text-muted mr-1.5">#</span>
          <input
            type="text"
            value={hexInput.replace(/^#/, "")}
            onChange={(e) => setHexInput("#" + e.target.value.toUpperCase())}
            onBlur={aplicarHexDigitado}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicarHexDigitado();
              }
            }}
            maxLength={6}
            className="bg-transparent outline-none text-sm text-primary uppercase font-mono w-full tracking-wider"
            placeholder="A855F7"
          />
        </div>
      </div>

      {/* Botão aplicar */}
      <button
        type="button"
        onClick={() => onApply(hexAtual)}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--module-vendas)" }}
      >
        <Check size={14} />
        {t("Aplicar")}
      </button>
    </div>
  );
}
