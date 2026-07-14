"use client";

/**
 * Landing redesenhada (tela 13 do guia) — arco: o painel → a organização →
 * o resultado. Montagem das seções na ordem do guia + o observer único de
 * reveals on-scroll (adiciona .gcin em .gcrv/.gcrv-l/.gcrv-r/.gcrv-s/.gcsolc
 * quando entram no viewport; com prefers-reduced-motion tudo já nasce
 * visível via CSS).
 *
 * `agoraISO` e `pais` vêm do SERVIDOR (src/app/page.tsx): relógio do
 * servidor pro calendário vivo e país por IP pro radar.
 */

import { useEffect } from "react";
import "./redesign.css";

import FundoParticulas from "./FundoParticulas";
import LandingNav from "./LandingNav";
import HeroSidebarViva from "./HeroSidebarViva";
import CalendarioVivo from "./CalendarioVivo";
import RadarMapa from "./RadarMapa";
import SolucoesGrid from "./SolucoesGrid";
import ParaQuemTimeline from "./ParaQuemTimeline";
import PlanosCarrossel from "./PlanosCarrossel";
import FaqLanding from "./FaqLanding";
import FooterLanding from "./FooterLanding";

export default function LandingRedesign({
  agoraISO,
  pais,
}: {
  agoraISO: string;
  pais: string;
}) {
  const agora = new Date(agoraISO);

  // Reveals on-scroll — um observer só pra página inteira
  useEffect(() => {
    const els = document.querySelectorAll(
      ".gcrv, .gcrv-l, .gcrv-r, .gcrv-s, .gcsolc"
    );
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add("gcin");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen bg-main text-primary">
      {/* fundo de partículas — canvas fixed z-0; o wrapper z-[1] põe todo o
          conteúdo por cima (glows semitransparentes deixam as bolinhas
          aparecerem atrás; o footer opaco as cobre). */}
      <FundoParticulas />
      <div className="relative z-[1]">
        <LandingNav />
        <HeroSidebarViva />
        <CalendarioVivo ano={agora.getFullYear()} mes={agora.getMonth()} />
        <RadarMapa pais={pais} />
        <SolucoesGrid />
        <ParaQuemTimeline />
        <PlanosCarrossel />
        <FaqLanding />
        <FooterLanding />
      </div>
    </div>
  );
}
