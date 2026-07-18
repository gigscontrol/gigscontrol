"use client";

import { useEffect, useRef, useState } from "react";
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
 * ZOOM POR SCROLL (J4) — decisão de UX documentada:
 *   O mapa vive DENTRO de uma página que rola. `scrollWheelZoom:true` do Leaflet
 *   dá `preventDefault()` INCONDICIONAL (leaflet 1.9.4) e sequestraria a rolagem
 *   da página: o usuário passa o mouse por cima do mapa e a página trava. Por
 *   isso o padrão da indústria (Google Maps embutido, Mapbox gesture-handling):
 *   **scroll puro rola a página; Ctrl/⌘ + scroll dá zoom**. Sem modificador NÃO
 *   damos preventDefault e mostramos a dica flutuante "Segure Ctrl (⌘)…".
 *   Implementado à mão (listener `wheel` + `setZoomAround`) porque o Leaflet não
 *   expõe modificador e não há plugin instalado — zero dependência nova.
 *   MOBILE: `dragging` continua DESLIGADO de propósito — é o que faz o toque de
 *   1 dedo cair pra rolagem da página (touch-pan preservado). Só o `touchZoom`
 *   (pinça de 2 dedos) foi ligado, que não conflita com a rolagem.
 *   Quem dá zoom manual (scroll, pinça ou botões +/−) passa a mandar no
 *   enquadramento: o `fitBounds` do raio para de re-enquadrar até trocar a
 *   cidade de referência (senão mexer no slider apagaria o zoom do usuário).
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

/** Tile CARTO sem rótulos — escuro ou claro conforme o tema ativo no mount
 *  (`data-theme` no <html>). Mesmo contrato de URL nos dois; troca só a string.
 *  Limitação aceita: o tile não retematiza ao vivo se o usuário alternar o
 *  tema com o mapa já montado (mínimo aceitável do spec de tema). */
function tilesDoTema(): string {
  const tema =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme")
      : null;
  return tema === "light"
    ? "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png";
}
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
  /** O usuário já deu zoom manual? Então o fitBounds do raio para de mandar. */
  const zoomManualRef = useRef(false);
  /** Último raio enquadrado — distingue "mexeu no slider" de "só re-renderizou". */
  const raioAnteriorRef = useRef(raioKm);
  /** Dica "segure Ctrl" — aparece quando rolam sem modificador sobre o mapa. */
  const [dicaZoom, setDicaZoom] = useState(false);
  const dicaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inicializa o mapa uma vez. Navegação MÍNIMA de propósito: sem arrastar
  // (preserva o touch-pan da página no mobile); zoom por Ctrl/⌘ + scroll,
  // pinça e botões +/− — ver o bloco de decisão no topo do arquivo.
  useEffect(() => {
    const el = contRef.current;
    if (!el || mapaRef.current) return;
    const mapa = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      center: [-15.6, -52],
      zoom: 4,
      minZoom: 2,
      // dragging OFF = toque de 1 dedo continua rolando a PÁGINA no mobile.
      dragging: false,
      // scrollWheelZoom OFF: o handler nativo daria preventDefault sempre e
      // sequestraria a rolagem. O zoom por scroll é feito à mão (Ctrl/⌘).
      scrollWheelZoom: false,
      doubleClickZoom: false,
      // Pinça de 2 dedos: não conflita com a rolagem de 1 dedo.
      touchZoom: true,
      boxZoom: false,
      keyboard: false,
      // Trava o mundo numa cópia só (sem repetir ao dar zoom out).
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1.0,
    });
    L.tileLayer(tilesDoTema(), {
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

    // --- Zoom por scroll COM modificador (J4) -------------------------------
    // Acumulador: um "notch" de roda pode vir em vários eventos (trackpad),
    // então só damos um passo de zoom a cada ~60px de delta.
    let acumulado = 0;
    const PASSO = 60;

    const piscarDica = () => {
      setDicaZoom(true);
      if (dicaTimerRef.current) clearTimeout(dicaTimerRef.current);
      dicaTimerRef.current = setTimeout(() => setDicaZoom(false), 1600);
    };

    // "Sessão de rolagem": eventos de wheel encadeados (< 400 ms entre si) são
    // o MESMO gesto. Se o gesto COMEÇOU fora do mapa, o cursor só está passando
    // por cima enquanto a página rola — não é intenção de dar zoom, então a
    // dica não pisca. Só o gesto que NASCE sobre o mapa merece a dica.
    let ultimoWheel = Number.NEGATIVE_INFINITY;
    let sessaoNasceuNoMapa = false;
    let dicaNestaSessao = false;
    const SESSAO_MS = 400;

    const aoRolarJanela = (e: WheelEvent) => {
      // UM relógio só: `performance.now()` (mesma base do e.timeStamp, sem o
      // risco de misturar tempo-desde-o-load com epoch e zerar a comparação).
      const agora = performance.now();
      if (agora - ultimoWheel > SESSAO_MS) {
        // Gesto novo: registra ONDE começou e libera uma dica pra esta sessão.
        const alvo = e.target as Node | null;
        sessaoNasceuNoMapa = !!alvo && el.contains(alvo);
        dicaNestaSessao = false;
      }
      ultimoWheel = agora;
    };
    // Capture: roda ANTES do handler do container, então quando `aoRolar`
    // consultar as flags elas já refletem este evento.
    window.addEventListener("wheel", aoRolarJanela, { passive: true, capture: true });

    const aoRolar = (e: WheelEvent) => {
      const m = mapaRef.current;
      if (!m) return;
      // SEM modificador: NÃO damos preventDefault — a página rola normalmente.
      if (!e.ctrlKey && !e.metaKey) {
        // Uma dica por gesto, e só se o gesto nasceu aqui dentro.
        if (sessaoNasceuNoMapa && !dicaNestaSessao) {
          dicaNestaSessao = true;
          piscarDica();
        }
        return;
      }
      // COM Ctrl/⌘ (inclui a pinça de trackpad, que o browser manda como
      // wheel + ctrlKey): o zoom é nosso e a página não rola.
      e.preventDefault();
      if (dicaTimerRef.current) clearTimeout(dicaTimerRef.current);
      setDicaZoom(false);
      // deltaMode 1 = linhas, 2 = páginas — normaliza pra pixels.
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      acumulado += delta;
      if (Math.abs(acumulado) < PASSO) return;
      const passos = acumulado > 0 ? -1 : 1;
      acumulado = 0;
      const alvo = Math.max(
        m.getMinZoom(),
        Math.min(m.getMaxZoom(), m.getZoom() + passos)
      );
      if (alvo === m.getZoom()) return;
      zoomManualRef.current = true;
      m.setZoomAround(m.mouseEventToContainerPoint(e), alvo, { animate: true });
    };

    // Pinça (2 dedos) também conta como zoom manual.
    const aoTocar = (e: TouchEvent) => {
      if (e.touches.length > 1) zoomManualRef.current = true;
    };

    el.addEventListener("wheel", aoRolar, { passive: false });
    el.addEventListener("touchstart", aoTocar, { passive: true });

    return () => {
      el.removeEventListener("wheel", aoRolar);
      el.removeEventListener("touchstart", aoTocar);
      window.removeEventListener("wheel", aoRolarJanela, { capture: true });
      if (dicaTimerRef.current) clearTimeout(dicaTimerRef.current);
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

  // Trocou a cidade de referência → o mapa volta a mandar no enquadramento.
  // (Declarado ANTES do efeito do círculo: efeitos rodam na ordem de declaração,
  // então o reset já valeu quando o fitBounds abaixo consulta a flag.)
  useEffect(() => {
    zoomManualRef.current = false;
  }, [refCoords]);

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

    // Enquadramento — DOIS casos distintos (não podem usar a mesma regra):
    //  - o RAIO mudou: o usuário acabou de mexer no controle principal da tela
    //    e espera ver o novo círculo. Re-enquadra SEMPRE, mesmo depois de zoom
    //    manual. Sem isso, um Ctrl+scroll qualquer deixava o slider "morto":
    //    o círculo crescia fora da viewport e, como `dragging` é false, não
    //    havia como alcançá-lo de volta a não ser clicando no "−" várias vezes.
    //  - só o rótulo/coords re-renderizaram: aí sim respeita o zoom manual,
    //    senão o mapa saltaria sozinho embaixo do usuário.
    const raioMudou = raioAnteriorRef.current !== raioKm;
    raioAnteriorRef.current = raioKm;
    if (raioMudou) zoomManualRef.current = false;

    if (raioMudou || !zoomManualRef.current) {
      mapa.fitBounds(circuloRef.current.getBounds(), {
        padding: [28, 28],
        animate: false,
      });
    }
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
        borderRadius: "var(--r-card)",
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
        .gc-mapa .leaflet-container { background:var(--bg-main); font-family:inherit; cursor:default; }
        /* Água/vias em tons de azul discretos sobre o CARTO dark (tela 10). Calibrado
           pro tile escuro — no claro o tile já vem claro, então some. */
        .gc-mapa .leaflet-tile-pane { filter: sepia(0.4) hue-rotate(175deg) saturate(1.7) brightness(0.82) contrast(1.05); }
        html[data-theme="light"] .gc-mapa .leaflet-tile-pane { filter: none; }
        .gc-mk-wrap { background:transparent; border:none; }
        .gc-mk-contratante { display:block; width:14px; height:14px; border-radius:50%; background:${BRAND}; border:2px solid color-mix(in srgb, var(--text-primary) 85%, transparent); box-shadow:0 0 10px color-mix(in srgb, var(--brand) 90%, transparent), 0 0 22px color-mix(in srgb, var(--brand) 45%, transparent); }
        .gc-mk-casa { display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:6px; background:var(--bg-surface); border:1.5px solid ${BRAND}; color:var(--brand-2); box-shadow:0 2px 10px var(--shadow-color); }
        .gc-mk-cidade { display:block; width:12px; height:12px; border-radius:50%; background:color-mix(in srgb, var(--bg-main) 40%, transparent); border:2px solid var(--text-muted); }
        .gc-mk-contratante.gc-fora { background:#4A5265; border-color:color-mix(in srgb, var(--text-primary) 35%, transparent); box-shadow:none; opacity:.55; }
        .gc-mk-casa.gc-fora { border-color:#4A5265; color:var(--text-muted); opacity:.55; box-shadow:none; }
        .gc-mk-cidade.gc-fora { border-color:#4A5265; opacity:.5; }
        .gc-mk-ref { position:relative; display:block; width:16px; height:16px; }
        .gc-mk-ref-nucleo { position:absolute; inset:0; border-radius:50%; background:${BRAND}; border:2px solid #fff; box-shadow:0 0 16px color-mix(in srgb, var(--brand) 95%, transparent); }
        .gc-mk-ref-pulso { position:absolute; inset:-9px; border-radius:50%; border:2px solid color-mix(in srgb, var(--brand) 55%, transparent); animation:gc-pulso 2.2s ease-out infinite; }
        @keyframes gc-pulso { from { transform:scale(.45); opacity:.95; } to { transform:scale(1.7); opacity:0; } }
        .gc-mk-ref-rotulo { position:absolute; top:24px; left:50%; transform:translateX(-50%); background:color-mix(in srgb, var(--bg-main) 85%, transparent); backdrop-filter:blur(6px); border:1px solid color-mix(in srgb, var(--text-primary) 10%, transparent); color:var(--text-primary); font-size:11px; font-weight:600; padding:3px 9px; border-radius:8px; white-space:nowrap; }
        .gc-mapa .leaflet-popup-content-wrapper { background:var(--bg-surface); color:var(--text-primary); border:1px solid color-mix(in srgb, var(--text-primary) 10%, transparent); border-radius:10px; box-shadow:0 12px 32px var(--shadow-color); }
        .gc-mapa .leaflet-popup-tip { background:var(--bg-surface); }
        .gc-mapa .leaflet-popup-content { margin:10px 12px; }
        .gc-pop { display:flex; flex-direction:column; gap:2px; font-size:12px; }
        .gc-pop-titulo { font-weight:700; color:var(--text-primary); }
        .gc-pop-sub { color:var(--text-secondary); font-size:11px; }
        .gc-pop-km { color:var(--brand-2); font-family:var(--font-mono, monospace); font-size:11px; }
        .gc-pop-aprox { color:var(--text-muted); font-size:10px; }
        .gc-mapa .leaflet-control-attribution { background:color-mix(in srgb, var(--bg-main) 75%, transparent); color:var(--text-disabled); font-size:9px; }
        .gc-mapa .leaflet-control-attribution a { color:var(--text-muted); }
      `}</style>

      {/* Mapa */}
      <div ref={contRef} className="absolute inset-0" />

      {/* Chips flutuantes (tela 10) */}
      <div className="pointer-events-none absolute inset-0 z-[1000]">
        {/* Raio atual — mono CAIXA ALTA (tela 10) */}
        <div
          className="pointer-events-auto absolute left-3 top-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg-main) 80%, transparent)",
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
            backgroundColor: "color-mix(in srgb, var(--bg-main) 80%, transparent)",
            backdropFilter: "blur(8px)",
            borderColor: "var(--border-strong)",
          }}
        >
          <button
            type="button"
            aria-label={t("Aproximar")}
            onClick={() => {
              zoomManualRef.current = true;
              mapaRef.current?.zoomIn();
            }}
            className="flex h-8 w-8 items-center justify-center text-secondary hover:text-primary transition-colors"
          >
            <Plus size={14} />
          </button>
          <div style={{ height: 1, backgroundColor: "var(--border)" }} />
          <button
            type="button"
            aria-label={t("Afastar")}
            onClick={() => {
              zoomManualRef.current = true;
              mapaRef.current?.zoomOut();
            }}
            className="flex h-8 w-8 items-center justify-center text-secondary hover:text-primary transition-colors"
          >
            <Minus size={14} />
          </button>
        </div>

        {/* Legenda */}
        <div
          className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border px-2.5 py-1.5 text-[0.65rem] text-secondary"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg-main) 80%, transparent)",
            backdropFilter: "blur(8px)",
            borderColor: "var(--border-strong)",
          }}
        >
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BRAND, boxShadow: "0 0 6px color-mix(in srgb, var(--brand) 80%, transparent)" }}
            />
            {t("Contratante")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${BRAND}` }}
            />
            {t("Casa")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ border: "1.5px solid var(--text-muted)" }}
            />
            {t("Cidade")}
          </span>
        </div>

        {/* Dica de zoom (J4) — só aparece quando rolam sem o modificador. */}
        {dicaZoom && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center">
            <div
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-primary"
              style={{
                backgroundColor: "color-mix(in srgb, var(--bg-main) 88%, transparent)",
                backdropFilter: "blur(8px)",
                borderColor: "var(--border-strong)",
              }}
              role="status"
            >
              {t("Segure Ctrl (⌘ no Mac) e role para dar zoom")}
            </div>
          </div>
        )}

        {/* Sem referência — estado vazio */}
        {!refCoords && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-lg border px-4 py-2.5 text-sm text-secondary"
              style={{
                backgroundColor: "color-mix(in srgb, var(--bg-main) 85%, transparent)",
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
