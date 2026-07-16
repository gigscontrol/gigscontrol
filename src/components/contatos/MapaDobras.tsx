"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Search, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useContatos } from "@/lib/contatos-context";
import { distanciaKm, formatarKm } from "@/lib/geo";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "@/components/CidadeGlobalAutocomplete";
import type { Country } from "@/lib/data/countries";
import type { Cidade, Casa, Contratante } from "@/types";
import type { PontoMapa, FocoPais } from "@/components/contatos/MapaRaio";

// Leaflet usa `window` — só carrega no cliente, quando a aba do mapa abre.
const MapaRaio = dynamic(() => import("@/components/contatos/MapaRaio"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center text-sm text-muted"
      style={{
        height: 440,
        borderRadius: "var(--r-card)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--bg)",
      }}
    >
      <Loader2 size={16} className="animate-spin mr-2" />
      Carregando o mapa…
    </div>
  ),
});

/** Fator do "contexto": pontos até N× o raio aparecem esmaecidos (tela 10). */
const FATOR_FORA_DO_RAIO = 2.5;

/**
 * Busca por raio (tela 10 do redesign) — cidade de referência + raio; o mapa
 * mostra o círculo e os pontos, e a lista "No raio" (ao lado) agrupa
 * contratantes/casas/cidades ordenados por distância.
 *
 * Contratantes/casas usam coordenada PRÓPRIA (lat/lng geocodificados no
 * cadastro — migração 51) e caem pro centroide da cidade quando não têm.
 */
export default function MapaDobras({
  cidades: cidadesProp,
  casas: casasProp,
  contratantes: contratantesProp,
}: {
  cidades?: Cidade[];
  casas?: Casa[];
  contratantes?: Contratante[];
} = {}) {
  const t = useT();
  const ctx = useContatos();
  const cidades = cidadesProp ?? ctx.cidades;
  const casas = casasProp ?? ctx.casas;
  const contratantes = contratantesProp ?? ctx.contratantes;

  // Padrão: primeira cidade com coordenadas
  const cidadesComCoord = useMemo(
    () => cidades.filter((c) => c.latitude !== undefined && c.longitude !== undefined),
    [cidades]
  );

  // Cidade de referência: digitável, país→cidade (BR=IBGE, mundo=GeoNames).
  const [refCidade, setRefCidade] = useState<CidadeEscolhida | null>(null);
  const [refCoords, setRefCoords] = useState<
    { latitude: number; longitude: number } | null
  >(null);
  const [geocodando, setGeocodando] = useState(false);
  const [geoErro, setGeoErro] = useState<string | null>(null);
  const [raioKm, setRaioKm] = useState<number>(500);
  const [focoPais, setFocoPais] = useState<FocoPais | null>(null);

  // Trocou o PAÍS → enquadra o mapa nele (a cidade foi limpa junto).
  async function aoTrocarPais(p: Country) {
    setGeoErro(null);
    try {
      const res = await fetch(
        `/api/geocode?pais=${encodeURIComponent(p.name)}&iso=${encodeURIComponent(p.code)}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const body = await res.json();
      if (typeof body.latitude === "number" && typeof body.longitude === "number") {
        setFocoPais({
          latitude: body.latitude,
          longitude: body.longitude,
          bbox: Array.isArray(body.bbox) && body.bbox.length === 4 ? body.bbox : undefined,
        });
      }
    } catch {
      // silencioso — o mapa só não se move
    }
  }

  // Default: pré-seleciona a primeira cidade com coords (uma vez, ao carregar).
  const jaInicializou = useRef(false);
  useEffect(() => {
    if (jaInicializou.current) return;
    const p = cidadesComCoord[0];
    if (p && p.latitude !== undefined && p.longitude !== undefined) {
      jaInicializou.current = true;
      setRefCidade({
        ibgeId: p.ibgeId,
        geonameId: p.geonameId,
        nome: p.nome,
        uf: p.estado,
        pais: p.pais ?? "BR",
        latitude: p.latitude,
        longitude: p.longitude,
      });
      setRefCoords({ latitude: p.latitude, longitude: p.longitude });
    }
  }, [cidadesComCoord]);

  async function escolherCidade(c: CidadeEscolhida | null) {
    setRefCidade(c);
    setGeoErro(null);
    if (!c) {
      setRefCoords(null);
      return;
    }
    // GeoNames (fora do BR) já traz as coordenadas — usa direto.
    if (c.latitude !== undefined && c.longitude !== undefined) {
      setRefCoords({ latitude: c.latitude, longitude: c.longitude });
      return;
    }
    // Se já temos essa cidade no banco com coords, usa direto (sem bater no OSM).
    const local = cidadesComCoord.find(
      (x) =>
        x.nome.trim().toLowerCase() === c.nome.trim().toLowerCase() &&
        x.estado.toUpperCase() === c.uf.toUpperCase()
    );
    if (local && local.latitude !== undefined && local.longitude !== undefined) {
      setRefCoords({ latitude: local.latitude, longitude: local.longitude });
      return;
    }
    setGeocodando(true);
    try {
      const res = await fetch(
        `/api/geocode?nome=${encodeURIComponent(c.nome)}&uf=${encodeURIComponent(c.uf)}`,
        { credentials: "include" }
      );
      const body = await res.json();
      if (typeof body.latitude === "number" && typeof body.longitude === "number") {
        setRefCoords({ latitude: body.latitude, longitude: body.longitude });
      } else {
        setRefCoords(null);
        setGeoErro(t("Não achei essa cidade no mapa. Tente outra."));
      }
    } catch {
      setRefCoords(null);
      setGeoErro(t("Não achei essa cidade no mapa. Tente outra."));
    } finally {
      setGeocodando(false);
    }
  }

  const cidadesSemCoord = cidades.length - cidadesComCoord.length;

  // Todos os pontos do mapa: dentro do raio + contexto esmaecido (até 2.5×).
  const pontosMapa = useMemo<PontoMapa[]>(() => {
    if (!refCoords) return [];
    const out: PontoMapa[] = [];
    const cidadePorId = new Map(cidades.map((c) => [c.id, c]));

    const empurrar = (
      id: string,
      tipo: PontoMapa["tipo"],
      nome: string,
      sub: string | undefined,
      lat: number,
      lng: number,
      aproximado?: boolean
    ) => {
      const km = distanciaKm(refCoords, { latitude: lat, longitude: lng });
      if (km === undefined || km > raioKm * FATOR_FORA_DO_RAIO) return;
      out.push({ id, tipo, nome, sub, lat, lng, km, aproximado, foraDoRaio: km > raioKm });
    };

    for (const c of cidades) {
      if (c.latitude === undefined || c.longitude === undefined) continue;
      empurrar(`cidade-${c.id}`, "cidade", c.nome, c.estado || undefined, c.latitude, c.longitude);
    }
    for (const casa of casas) {
      const cid = cidadePorId.get(casa.cidadeId);
      const lat = casa.lat ?? cid?.latitude;
      const lng = casa.lng ?? cid?.longitude;
      if (lat === undefined || lng === undefined) continue;
      empurrar(
        `casa-${casa.id}`,
        "casa",
        casa.nome,
        cid ? `${cid.nome}/${cid.estado}` : undefined,
        lat,
        lng,
        casa.geoPrecisao !== "address"
      );
    }
    for (const ct of contratantes) {
      const cid = cidadePorId.get(ct.cidadeId);
      const lat = ct.lat ?? cid?.latitude;
      const lng = ct.lng ?? cid?.longitude;
      if (lat === undefined || lng === undefined) continue;
      empurrar(
        `contratante-${ct.id}`,
        "contratante",
        ct.nome,
        cid ? `${cid.nome}/${cid.estado}` : undefined,
        lat,
        lng,
        ct.geoPrecisao !== "address"
      );
    }
    return out;
  }, [refCoords, raioKm, cidades, casas, contratantes]);

  // Lista lateral "No raio" — só os de dentro, agrupados e por distância.
  const dentroDoRaio = useMemo(
    () =>
      pontosMapa
        .filter((p) => !p.foraDoRaio)
        .sort((a, b) => (a.km ?? 0) - (b.km ?? 0)),
    [pontosMapa]
  );
  const grupos = useMemo(
    () => ({
      contratante: dentroDoRaio.filter((p) => p.tipo === "contratante"),
      casa: dentroDoRaio.filter((p) => p.tipo === "casa"),
      cidade: dentroDoRaio.filter((p) => p.tipo === "cidade"),
    }),
    [dentroDoRaio]
  );

  return (
    <div className="card">
      <div className="section-title mb-4 flex items-center gap-2">
        <Search size={14} />
        {t("Busca por raio")}
      </div>

      {/* Filtros numa linha (tela 10) — acima do mapa, dropdown sempre por cima */}
      <div className="relative z-20 mb-4 flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex-1">
          <label className="text-xs text-muted block mb-1">{t("Cidade de referência")}</label>
          <CidadeGlobalAutocomplete
            value={refCidade}
            onChange={escolherCidade}
            orientacao="horizontal"
            onPaisChange={aoTrocarPais}
          />
          {geocodando && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <Loader2 size={12} className="animate-spin" />
              {t("Localizando a cidade…")}
            </div>
          )}
          {geoErro && <div className="mt-1.5 text-xs text-danger">{geoErro}</div>}
        </div>
        <div className="lg:w-[280px]">
          <div className="flex items-baseline justify-between mb-1">
            <label className="text-xs text-muted">{t("Raio")}</label>
            <span className="font-mono text-xs font-semibold text-primary tabular-nums">
              {raioKm} km
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={1000}
            step={50}
            value={raioKm}
            onChange={(e) => setRaioKm(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between font-mono text-[0.6rem] text-muted mt-0.5">
            <span>50</span>
            <span>1000</span>
          </div>
        </div>
      </div>

      {/* Mapa (⅔) + lista "No raio" (⅓) — tela 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <MapaRaio
          refCoords={refCoords}
          refNome={refCidade?.nome}
          raioKm={raioKm}
          pontos={pontosMapa}
          focoPais={focoPais}
        />

        <aside
          className="flex flex-col overflow-hidden"
          style={{
            height: 440,
            borderRadius: "var(--r-card)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="text-sm font-bold text-primary">{t("No raio")}</span>
            <span
              className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: "var(--brand-weak)", color: "var(--brand-2)" }}
            >
              {dentroDoRaio.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
            {dentroDoRaio.length === 0 ? (
              <div className="text-sm text-muted px-1 py-2">
                {refCoords
                  ? t("Nenhum contato no raio.")
                  : t("Escolha uma cidade de referência.")}
              </div>
            ) : (
              <>
                <GrupoNoRaio
                  titulo={t("Contratantes")}
                  pontos={grupos.contratante}
                  swatch={<SwatchTipo tipo="contratante" />}
                />
                <GrupoNoRaio
                  titulo={t("Casas")}
                  pontos={grupos.casa}
                  swatch={<SwatchTipo tipo="casa" />}
                />
                <GrupoNoRaio
                  titulo={t("Cidades")}
                  pontos={grupos.cidade}
                  swatch={<SwatchTipo tipo="cidade" />}
                />
              </>
            )}
          </div>
        </aside>
      </div>

      {cidadesSemCoord > 0 && (
        <div className="mt-3 text-xs text-muted">
          {t("{n} cidade(s) sem coordenadas — fique de fora da busca.", { n: cidadesSemCoord })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Grupo da lista "No raio" — label mono CAIXA ALTA + linhas
   ============================================================ */
function GrupoNoRaio({
  titulo,
  pontos,
  swatch,
}: {
  titulo: string;
  pontos: PontoMapa[];
  swatch: React.ReactNode;
}) {
  if (pontos.length === 0) return null;
  return (
    <section>
      <div className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted px-1 mb-1.5">
        {titulo} · {pontos.length}
      </div>
      <ul className="flex flex-col gap-1.5">
        {pontos.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2.5 bg-surface-2 border border-border rounded px-3 py-2"
          >
            <span className="flex-shrink-0">{swatch}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-primary truncate">{p.nome}</div>
              {p.sub && (
                <div className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted truncate">
                  {p.sub}
                </div>
              )}
            </div>
            <span className="font-mono text-xs text-secondary tabular-nums flex-shrink-0">
              {formatarKm(p.km)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Mini-marcador da legenda/lista — mesmo desenho dos pins do mapa. */
function SwatchTipo({ tipo }: { tipo: PontoMapa["tipo"] }) {
  if (tipo === "casa") {
    return (
      <span
        className="block h-3 w-3 rounded-[3px]"
        style={{ backgroundColor: "var(--bg-surface)", border: "1.5px solid var(--brand)" }}
      />
    );
  }
  if (tipo === "cidade") {
    return (
      <span
        className="block h-3 w-3 rounded-full"
        style={{ border: "2px solid var(--text-muted)" }}
      />
    );
  }
  return (
    <span
      className="block h-3 w-3 rounded-full"
      style={{
        backgroundColor: "var(--brand)",
        boxShadow: "0 0 8px color-mix(in srgb, var(--brand) 80%, transparent)",
      }}
    />
  );
}
