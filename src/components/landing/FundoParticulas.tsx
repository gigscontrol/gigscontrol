"use client";

/**
 * Fundo de partículas interativas — SÓ na landing (montado no LandingRedesign).
 * Canvas `fixed` atrás de todo o conteúdo: o wrapper z-[1] do LandingRedesign
 * põe as seções por cima, então as bolinhas aparecem "atrás" dos glows
 * semitransparentes e o footer opaco as cobre. Bolinhas azuis bem sutis que
 * driftam sozinhas e recuam do mouse (repulsão suave).
 *
 * Desligado (o canvas nem entra no DOM) com prefers-reduced-motion, ponteiro
 * grosso (touch) ou viewport < 768px. Tema lido por frame (segue o toggle sem
 * observer). Sem dependências novas.
 */

import { useEffect, useRef, useState } from "react";

type Ponto = {
  x: number; // posição de drift (px CSS)
  y: number;
  vx: number; // velocidade de drift
  vy: number;
  r: number; // raio
  a: number; // fator de alpha normalizado [0,1]
  ox: number; // offset de repulsão (eased)
  oy: number;
};

export default function FundoParticulas() {
  const [ativo, setAtivo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Gate: desliga em reduced-motion, touch (pointer grosso) ou tela estreita.
  // Reavalia quando qualquer media query muda (ex.: girar o device / toggle do SO).
  useEffect(() => {
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    const mqNarrow = window.matchMedia("(max-width: 767px)");
    const avaliar = () =>
      setAtivo(!mqReduce.matches && !mqCoarse.matches && !mqNarrow.matches);
    avaliar();
    mqReduce.addEventListener("change", avaliar);
    mqCoarse.addEventListener("change", avaliar);
    mqNarrow.addEventListener("change", avaliar);
    return () => {
      mqReduce.removeEventListener("change", avaliar);
      mqCoarse.removeEventListener("change", avaliar);
      mqNarrow.removeEventListener("change", avaliar);
    };
  }, []);

  // Animação — só monta quando ativo (aí o canvas existe no DOM).
  useEffect(() => {
    if (!ativo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let pontos: Ponto[] = [];
    const mouse = { x: -9999, y: -9999 }; // fora da tela até o 1º mousemove
    const R = 140; // raio de influência do mouse
    let raf = 0;
    let tResize: ReturnType<typeof setTimeout> | undefined;

    // (re)dimensiona o canvas p/ o viewport × DPR e re-semeia os pontos.
    // (arrow const, não function declaration: o hoisting quebraria o narrowing
    // de canvas/ctx feito pelos guards acima — TS18047.)
    const semear = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // desenha em coords CSS
      const N = Math.max(16, Math.min(40, Math.round((W * H) / 45000)));
      pontos = [];
      for (let i = 0; i < N; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 0.05 + Math.random() * 0.11; // 0.05..0.16 px/frame
        pontos.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          r: 1 + Math.random() * 1.2, // 1.0..2.2 px
          a: Math.random(),
          ox: 0,
          oy: 0,
        });
      }
    };

    const quadro = () => {
      const claro = document.documentElement.dataset.theme === "light";
      const cor = claro ? "61,123,255" : "91,140,255";
      const aMin = claro ? 0.12 : 0.18;
      const aRange = claro ? 0.12 : 0.14; // light 0.12..0.24 · dark 0.18..0.32
      ctx.clearRect(0, 0, W, H);
      for (const p of pontos) {
        // drift + wrap toroidal (margem de 8px nas bordas)
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -8) p.x = W + 8;
        else if (p.x > W + 8) p.x = -8;
        if (p.y < -8) p.y = H + 8;
        else if (p.y > H + 8) p.y = -8;
        // repulsão suave do mouse
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < R && dist > 0.001) {
          const f = (1 - dist / R) * 22;
          p.ox += ((dx / dist) * f - p.ox) * 0.08;
          p.oy += ((dy / dist) * f - p.oy) * 0.08;
        } else {
          p.ox *= 0.92; // volta suave quando fora do raio
          p.oy *= 0.92;
        }
        ctx.beginPath();
        ctx.arc(p.x + p.ox, p.y + p.oy, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cor},${aMin + p.a * aRange})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(quadro);
    };

    const aoMover = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const aoRedimensionar = () => {
      clearTimeout(tResize);
      tResize = setTimeout(semear, 200); // debounce
    };

    semear();
    raf = requestAnimationFrame(quadro);
    window.addEventListener("mousemove", aoMover, { passive: true });
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tResize);
      window.removeEventListener("mousemove", aoMover);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [ativo]);

  if (!ativo) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
