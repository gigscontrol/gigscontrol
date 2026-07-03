"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Plus, Minus, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Mapa da busca por raio (telas 10/11 do redesign) — Leaflet + CARTO dark.
 *
 * - Tiles escuros SEM rótulos (visual limpo; os nomes vêm dos nossos pins).
 * - Círculo de raio Signal Blue (fill .16) que atualiza ao vivo com o slider.
 * - Pin central com rótulo da cidade de referência.
 * - Marcadores: contratante = ponto azul com glow · casa = quadrado escuro
 *   com ícone de prédio e borda azul · cidade = anel cinza.
 * - Chips flutuantes (raio, zoom, legenda) com fundo blur, como na tela 10.
 * - Popup escuro; pontos com precisão de cidade avisam "≈ aproximada".
 *
 * Carregar SEMPRE via next/dynamic com ssr:false (Leaflet usa window).
 */

export type PontoMapa = {
  id: string;
  tipo: "contratante" | "casa" | "cidade";
  nome: string;
  /** Linha secundária (ex.: "São Paulo/SP"). */
  sub?: string;
  lat: number;
  lng: number;
  km?: number;
  /** true quando geo_precision = 'city' (centroide, não endereço exato). */
  aproximado?: boolean;
  /** Fora do raio: renderiza esmaecido/cinza (contexto, tela 10). */
  foraDoRaio?: boolean;
};

const TILES =
  "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const BRAND = "#3D7BFF";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

const SVG_PREDIO =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>';

function iconeDoTipo(tipo: PontoMapa["tipo"], fora?: boolean): L.DivIcon {
  const mod = fora ? " gc-fora" : "";
  if (tipo === "casa") {
    return L.divIcon({
      className: "gc-mk-wrap",
      html: `<span class="gc-mk-casa${mod}">${SVG_PREDIO}</span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }
  if (tipo === "cidade") {
    return L.divIcon({
      className: "gc-mk-wrap",
      html: `<span class="gc-mk-cidade${mod}"></span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }
  return L.divIcon({
    className: "gc-mk-wrap",
    html: `<span class="gc-mk-contratante${mod}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function iconeReferencia(nome: string): L.DivIcon {
  return L.divIcon({
    className: "gc-mk-wrap",
    html: `<span class="gc-mk-ref"><span class="gc-mk-ref-pulso"></span><span class="gc-mk-ref-nucleo"></span><span class="gc-mk-ref-rotulo">${esc(nome)}</span></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/** Enquadramento do PAÍS selecionado (antes de escolher a cidade). */
export type FocoPais = {
  latitude: number;
  longitude: number;
  /** [sul, oeste, norte, leste] */
  bbox?: [number, number, number, number];
};

export default function MapaRaio({
  refCoords,
  refNome,
  raioKm,
  pontos,
  focoPais,
}: {
  refCoords: { latitude: number; longitude: number } | null;
  refNome?: string;
  raioKm: number;
  pontos: PontoMapa[];
  focoPais?: FocoPais | null;
}) {
  const t = useT();
  const contRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const circuloRef = useRef<L.Circle | null>(null);
  const marcadorRefRef = useRef<L.Marker | null>(null);
  const grupoRef = useRef<L.LayerGroup | null>(null);

  // Inicializa o mapa uma vez — VITRINE, não navegável: sem arrastar/scroll;
  // quem controla é a UI de cima (país, cidade, raio) + botões de zoom.
  useEffect(() => {
    const el = contRef.current;
    if (!el || mapaRef.current) return;
    const mapa = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      center: [-15.6, -52],
      zoom: 4,
      minZoom: 2,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      // Trava o mundo numa cópia só (sem repetir ao dar zoom out).
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1.0,
    });
    L.tileLayer(TILES, {
      attribution: ATTR,
      subdomains: "abcd",
      maxZoom: 19,
      noWrap: true,
      bounds: [
        [-85, -180],
        [85, 180],
      ],
    }).addTo(mapa);
    grupoRef.current = L.layerGroup().addTo(mapa);
    mapaRef.current = mapa;
    return () => {
      mapa.remove();
      mapaRef.current = null;
      circuloRef.current = null;
      marcadorRefRef.current = null;
      grupoRef.current = null;
    };
  }, []);

  // País selecionado (sem cidade ainda) → enquadra o país.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || refCoords || !focoPais) return;
    const centro: L.LatLngExpression = [focoPais.latitude, focoPais.longitude];

    if (focoPais.bbox) {
      const [s, w, n, e] = focoPais.bbox;
      // bbox "poluído" por territórios distantes / cruzando a linha de data
      // (ex.: EUA vêm -180..180 por causa de Alasca + Pacífico). Nesses casos
      // o fitBounds tentaria mostrar o mundo todo — usa o centro + zoom de país.
      const patologico = e <= w || e - w > 140 || n - s > 70;
      if (patologico) {
        mapa.setView(centro, 4, { animate: true });
      } else {
        mapa.fitBounds(
          [
            [s, w],
            [n, e],
          ],
          { padding: [24, 24], animate: true }
        );
      }
    } else {
      mapa.setView(centro, 4, { animate: true });
    }
  }, [focoPais, refCoords]);

  // Círculo + pin de referência — atualiza AO VIVO com o slider.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    if (!refCoords) {
      circuloRef.current?.remove();
      circuloRef.current = null;
      marcadorRefRef.current?.remove();
      marcadorRefRef.current = null;
      return;
    }

    const ll: L.LatLngExpression = [refCoords.latitude, refCoords.longitude];

    if (!circuloRef.current) {
      circuloRef.current = L.circle(ll, {
        radius: raioKm * 1000,
        color: BRAND,
        weight: 1.5,
        opacity: 0.9,
        fillColor: BRAND,
        fillOpacity: 0.16,
      }).addTo(mapa);
    } else {
      circuloRef.current.setLatLng(ll);
      circuloRef.current.setRadius(raioKm * 1000);
    }

    if (!marcadorRefRef.current) {
      marcadorRefRef.current = L.marker(ll, {
        icon: iconeReferencia(refNome ?? ""),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(mapa);
    } else {
      marcadorRefRef.current.setLatLng(ll);
      marcadorRefRef.current.setIcon(iconeReferencia(refNome ?? ""));
    }

    mapa.fitBounds(circuloRef.current.getBounds(), {
      padding: [28, 28],
      animate: false,
    });
  }, [refCoords, refNome, raioKm]);

  // Marcadores dos pontos no raio.
  useEffect(() => {
    const grupo = grupoRef.current;
    if (!grupo) return;
    grupo.clearLayers();

    for (const p of pontos) {
      const m = L.marker([p.lat, p.lng], {
        icon: iconeDoTipo(p.tipo, p.foraDoRaio),
        zIndexOffset: p.foraDoRaio
          ? 0
          : p.tipo === "contratante" ? 400 : p.tipo === "casa" ? 300 : 100,
      });
      const linhas = [
        `<strong class="gc-pop-titulo">${esc(p.nome)}</strong>`,
        p.sub ? `<span class="gc-pop-sub">${esc(p.sub)}</span>` : "",
        p.km !== undefined
          ? `<span class="gc-pop-km">${Math.round(p.km)} km</span>`
          : "",
        p.foraDoRaio ? `<span class="gc-pop-aprox">${esc(t("Fora do raio"))}</span>` : "",
        p.aproximado
          ? `<span class="gc-pop-aprox">≈ ${esc(t("localização aproximada (cidade)"))}</span>`
          : "",
      ].filter(Boolean);
      m.bindPopup(`<div class="gc-pop">${linhas.join("")}</div>`, {
        closeButton: false,
        offset: [0, -6],
      });
      grupo.addLayer(m);
    }
  }, [pontos, t]);

  return (
    <div
      className="gc-mapa relative overflow-hidden"
      style={{
        borderRadius: 14,
        border: "1px solid var(--border)",
        height: 440,
        backgroundColor: "var(--bg)",
        // Contém os z-index internos do Leaflet (z-400/z-1000) pra não
        // cobrirem dropdowns da página (ex.: autocomplete de cidade).
        isolation: "isolate",
        zIndex: 0,
      }}
    >
      <style>{`
        .gc-mapa .leaflet-container { background:#0B0D12; font-family:inherit; cursor:default; }
        /* Água/vias em tons de azul discretos sobre o CARTO dark (tela 10). */
        .gc-mapa .leaflet-tile-pane { filter: sepia(0.4) hue-rotate(175deg) saturate(1.7) brightness(0.82) contrast(1.05); }
        .gc-mk-wrap { background:transparent; border:none; }
        .gc-mk-contratante { display:block; width:14px; height:14px; border-radius:50%; background:${BRAND}; border:2px solid rgba(255,255,255,.85); box-shadow:0 0 10px rgba(61,123,255,.9), 0 0 22px rgba(61,123,255,.45); }
        .gc-mk-casa { display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:6px; background:#12151D; border:1.5px solid ${BRAND}; color:#5B93FF; box-shadow:0 2px 10px rgba(0,0,0,.55); }
        .gc-mk-cidade { display:block; width:12px; height:12px; border-radius:50%; background:rgba(11,13,18,.4); border:2px solid #6E7794; }
        .gc-mk-contratante.gc-fora { background:#4A5265; border-color:rgba(255,255,255,.35); box-shadow:none; opacity:.55; }
        .gc-mk-casa.gc-fora { border-color:#4A5265; color:#6E7794; opacity:.55; box-shadow:none; }
        .gc-mk-cidade.gc-fora { border-color:#4A5265; opacity:.5; }
        .gc-mk-ref { position:relative; display:block; width:16px; height:16px; }
        .gc-mk-ref-nucleo { position:absolute; inset:0; border-radius:50%; background:${BRAND}; border:2px solid #fff; box-shadow:0 0 16px rgba(61,123,255,.95); }
        .gc-mk-ref-pulso { position:absolute; inset:-9px; border-radius:50%; border:2px solid rgba(61,123,255,.55); animation:gc-pulso 2.2s ease-out infinite; }
        @keyframes gc-pulso { from { transform:scale(.45); opacity:.95; } to { transform:scale(1.7); opacity:0; } }
        .gc-mk-ref-rotulo { position:absolute; top:24px; left:50%; transform:translateX(-50%); background:rgba(11,13,18,.85); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,.1); color:#F1F3F7; font-size:11px; font-weight:600; padding:3px 9px; border-radius:8px; white-space:nowrap; }
        .gc-mapa .leaflet-popup-content-wrapper { background:#12151D; color:#F1F3F7; border:1px solid rgba(255,255,255,.1); border-radius:10px; box-shadow:0 12px 32px rgba(0,0,0,.55); }
        .gc-mapa .leaflet-popup-tip { background:#12151D; }
        .gc-mapa .leaflet-popup-content { margin:10px 12px; }
        .gc-pop { display:flex; flex-direction:column; gap:2px; font-size:12px; }
        .gc-pop-titulo { font-weight:700; color:#F1F3F7; }
        .gc-pop-sub { color:#9AA2B4; font-size:11px; }
        .gc-pop-km { color:#5B93FF; font-family:var(--font-mono, monospace); font-size:11px; }
        .gc-pop-aprox { color:#6E7794; font-size:10px; }
        .gc-mapa .leaflet-control-attribution { background:rgba(11,13,18,.75); color:#5E6470; font-size:9px; }
        .gc-mapa .leaflet-control-attribution a { color:#6E7794; }
      `}</style>

      {/* Mapa */}
      <div ref={contRef} className="absolute inset-0" />

      {/* Chips flutuantes (tela 10) */}
      <div className="pointer-events-none absolute inset-0 z-[1000]">
        {/* Raio atual — mono CAIXA ALTA (tela 10) */}
        <div
          className="pointer-events-auto absolute left-3 top-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary"
          style={{
            backgroundColor: "rgba(11,13,18,0.8)",
            backdropFilter: "blur(8px)",
            borderColor: "var(--border-strong)",
          }}
        >
          <MapPin size={11} style={{ color: BRAND }} />
          {t("Raio")} {raioKm} km
        </div>

        {/* Zoom */}
        <div
          className="pointer-events-auto absolute right-3 top-3 flex flex-col rounded-lg border overflow-hidden"
          style={{
            backgroundColor: "rgba(11,13,18,0.8)",
            backdropFilter: "blur(8px)",
            borderColor: "var(--border-strong)",
          }}
        >
          <button
            type="button"
            aria-label={t("Aproximar")}
            onClick={() => mapaRef.current?.zoomIn()}
            className="flex h-8 w-8 items-center justify-center text-secondary hover:text-primary transition-colors"
          >
            <Plus size={14} />
          </button>
          <div style={{ height: 1, backgroundColor: "var(--border)" }} />
          <button
            type="button"
            aria-label={t("Afastar")}
            onClick={() => mapaRef.current?.zoomOut()}
            className="flex h-8 w-8 items-center justify-center text-secondary hover:text-primary transition-colors"
          >
            <Minus size={14} />
          </button>
        </div>

        {/* Legenda */}
        <div
          className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border px-2.5 py-1.5 text-[0.65rem] text-secondary"
          style={{
            backgroundColor: "rgba(11,13,18,0.8)",
            backdropFilter: "blur(8px)",
            borderColor: "var(--border-strong)",
          }}
        >
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BRAND, boxShadow: "0 0 6px rgba(61,123,255,.8)" }}
            />
            {t("Contratante")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: "#12151D", border: `1px solid ${BRAND}` }}
            />
            {t("Casa")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ border: "1.5px solid #6E7794" }}
            />
            {t("Cidade")}
          </span>
        </div>

        {/* Sem referência — estado vazio */}
        {!refCoords && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-lg border px-4 py-2.5 text-sm text-secondary"
              style={{
                backgroundColor: "rgba(11,13,18,0.85)",
                backdropFilter: "blur(8px)",
                borderColor: "var(--border-strong)",
              }}
            >
              {t("Escolha uma cidade de referência pra desenhar o raio.")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
