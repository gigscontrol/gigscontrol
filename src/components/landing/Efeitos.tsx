"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Efeitos da landing page (Signal Blue).
 *
 * - <Reveal>    — entrada animada quando a seção entra na viewport (scroll).
 * - <FundoHero> — canvas de pontos que "acorda" perto do cursor + onda sutil.
 * - <CenaHero>  — tilt 3D do mockup + chips flutuantes com parallax do mouse.
 *
 * Tudo respeita `prefers-reduced-motion` (vira estático) e pausa fora da
 * viewport (IntersectionObserver) pra não gastar bateria à toa.
 */

function movimentoReduzido(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ============================================================
   Reveal — fade + subida suave ao entrar na viewport
   ============================================================ */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (movimentoReduzido()) {
      setVisivel(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visivel ? 1 : 0,
        transform: visivel ? "none" : `translateY(${y}px)`,
        transition: `opacity 0.75s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.75s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: visivel ? undefined : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   FundoHero — malha de pontos viva (onda + brilho perto do cursor)
   ============================================================ */
export function FundoHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduzido = movimentoReduzido();
    const ESPACO = 34;
    const RAIO_MOUSE = 180;
    const mouse = { x: -99999, y: -99999 };
    let pontos: { x: number; y: number }[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let ativo = true;
    let visivel = true;

    function medir() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.max(1, Math.round(w * dpr));
      canvas!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      pontos = [];
      for (let y = ESPACO / 2; y < h; y += ESPACO) {
        for (let x = ESPACO / 2; x < w; x += ESPACO) {
          pontos.push({ x, y });
        }
      }
    }

    function desenhar(t: number) {
      ctx!.clearRect(0, 0, w, h);
      for (const p of pontos) {
        // Onda diagonal sutil — a malha "respira" mesmo sem mouse.
        const onda =
          0.5 + 0.5 * Math.sin(t / 1500 + (p.x + p.y) / 210);
        let alpha = 0.045 + onda * 0.05;
        let raio = 1;
        let brand = false;

        // Brilho + leve afastamento perto do cursor.
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        let ox = 0;
        let oy = 0;
        if (dist < RAIO_MOUSE) {
          const g = (1 - dist / RAIO_MOUSE) ** 2;
          alpha = Math.min(0.85, alpha + g * 0.6);
          raio = 1 + g * 1.7;
          brand = g > 0.03;
          const desloc = g * 9;
          if (dist > 0.001) {
            ox = (dx / dist) * desloc;
            oy = (dy / dist) * desloc;
          }
        }

        ctx!.beginPath();
        ctx!.arc(p.x + ox, p.y + oy, raio, 0, Math.PI * 2);
        ctx!.fillStyle = brand
          ? `rgba(61,123,255,${alpha})`
          : `rgba(154,162,180,${alpha})`;
        ctx!.fill();
      }
    }

    function loop(t: number) {
      if (!ativo) return;
      if (visivel) desenhar(t);
      raf = requestAnimationFrame(loop);
    }

    medir();

    if (reduzido) {
      // Estático: desenha uma vez, sem loop nem listeners de mouse.
      desenhar(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const aoMover = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const aoSair = () => {
      mouse.x = -99999;
      mouse.y = -99999;
    };
    const aoRedimensionar = () => {
      medir();
      if (reduzido) desenhar(0);
    };

    if (!reduzido) {
      window.addEventListener("mousemove", aoMover, { passive: true });
      window.addEventListener("mouseout", aoSair, { passive: true });
    }
    window.addEventListener("resize", aoRedimensionar);

    const obs = new IntersectionObserver((entries) => {
      visivel = entries[0]?.isIntersecting ?? true;
    });
    obs.observe(canvas);

    return () => {
      ativo = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", aoMover);
      window.removeEventListener("mouseout", aoSair);
      window.removeEventListener("resize", aoRedimensionar);
      obs.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full pointer-events-none"
    />
  );
}

/* ============================================================
   CenaHero — tilt 3D do frame + chips flutuantes com parallax
   ============================================================ */
const POSICOES_CHIP = [
  { className: "hidden lg:block absolute -left-14 top-10 z-10", fator: 26, dur: 5.4, delay: 0 },
  { className: "hidden lg:block absolute -right-12 top-24 z-10", fator: -20, dur: 6.2, delay: 1.1 },
  { className: "hidden lg:block absolute -left-8 bottom-20 z-10", fator: -16, dur: 5.8, delay: 0.5 },
  { className: "hidden lg:block absolute -right-16 bottom-10 z-10", fator: 32, dur: 6.6, delay: 1.7 },
];

export function CenaHero({
  children,
  chips = [],
}: {
  children: ReactNode;
  chips?: ReactNode[];
}) {
  const cenaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const alvo = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (movimentoReduzido()) return;
    const cena = cenaRef.current;
    if (!cena) return;

    let raf = 0;
    let ativo = true;
    let visivel = true;
    const cur = { x: 0, y: 0 };

    const loop = () => {
      if (!ativo) return;
      if (visivel) {
        cur.x += (alvo.current.x - cur.x) * 0.08;
        cur.y += (alvo.current.y - cur.y) * 0.08;
        if (frameRef.current) {
          frameRef.current.style.transform = `perspective(1200px) rotateY(${(cur.x * 5).toFixed(3)}deg) rotateX(${(-cur.y * 3.5).toFixed(3)}deg)`;
        }
        chipRefs.current.forEach((el, i) => {
          if (!el) return;
          const f = POSICOES_CHIP[i % POSICOES_CHIP.length].fator;
          el.style.transform = `translate3d(${(cur.x * f).toFixed(2)}px, ${(cur.y * f * 0.7).toFixed(2)}px, 0)`;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const aoMover = (e: MouseEvent) => {
      const r = cena.getBoundingClientRect();
      alvo.current.x = (e.clientX - r.left) / r.width - 0.5;
      alvo.current.y = (e.clientY - r.top) / r.height - 0.5;
    };
    const aoSair = () => {
      alvo.current.x = 0;
      alvo.current.y = 0;
    };
    cena.addEventListener("mousemove", aoMover, { passive: true });
    cena.addEventListener("mouseleave", aoSair, { passive: true });

    const obs = new IntersectionObserver((entries) => {
      visivel = entries[0]?.isIntersecting ?? true;
    });
    obs.observe(cena);

    return () => {
      ativo = false;
      cancelAnimationFrame(raf);
      cena.removeEventListener("mousemove", aoMover);
      cena.removeEventListener("mouseleave", aoSair);
      obs.disconnect();
    };
  }, []);

  return (
    <div ref={cenaRef} className="relative">
      <style>{`@keyframes gc-flutuar { from { translate: 0 -7px; } to { translate: 0 9px; } }`}</style>
      <div ref={frameRef} style={{ transformStyle: "preserve-3d" }}>
        {children}
      </div>
      {chips.map((chip, i) => {
        const pos = POSICOES_CHIP[i % POSICOES_CHIP.length];
        return (
          <div
            key={i}
            className={pos.className}
            style={{
              animation: movimentoReduzido()
                ? undefined
                : `gc-flutuar ${pos.dur}s ease-in-out ${pos.delay}s infinite alternate`,
            }}
          >
            <div
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
            >
              {chip}
            </div>
          </div>
        );
      })}
    </div>
  );
}
