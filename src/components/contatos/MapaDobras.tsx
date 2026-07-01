"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { MapPin, Building2, Users, Search, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useContatos } from "@/lib/contatos-context";
import { distanciaKm, formatarKm } from "@/lib/geo";
import CidadeGlobalAutocomplete, { type CidadeEscolhida } from "@/components/CidadeGlobalAutocomplete";
import type { Cidade, Casa, Contratante } from "@/types";

/**
 * Coverage Map — busca de contatos por raio (km) a partir de uma
 * cidade de referência.
 *
 * Versão funcional (sem mapa visual). Lista cidades, casas e contratantes
 * dentro do raio, ordenados por distância. Itens cuja cidade não tem
 * coordenadas no banco são marcados como "sem coordenadas".
 *
 * Aceita props opcionais pra trabalhar com listas já filtradas (ex.: pelo
 * filtro de DJ na sidebar de Contatos). Se omitidas, cai pra leitura
 * direta do `useContatos()`.
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

  const cidadesNoRaio = useMemo(() => {
    if (!refCoords) return [];
    return cidades
      .map((c) => ({ cidade: c, distancia: distanciaKm(refCoords, c) }))
      .filter((x) => x.distancia !== undefined && x.distancia! <= raioKm)
      .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }, [refCoords, cidades, raioKm]);

  const idsCidadesNoRaio = useMemo(
    () => new Set(cidadesNoRaio.map((x) => x.cidade.id)),
    [cidadesNoRaio]
  );

  const casasNoRaio = useMemo(() => {
    return casas
      .filter((c) => idsCidadesNoRaio.has(c.cidadeId))
      .map((casa) => {
        const cidade = cidades.find((c) => c.id === casa.cidadeId);
        return {
          casa,
          cidade,
          distancia: cidade && refCoords ? distanciaKm(refCoords, cidade) : undefined,
        };
      })
      .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }, [casas, cidades, refCoords, idsCidadesNoRaio]);

  const contratantesNoRaio = useMemo(() => {
    return contratantes
      .filter((c) => idsCidadesNoRaio.has(c.cidadeId))
      .map((contratante) => {
        const cidade = cidades.find((c) => c.id === contratante.cidadeId);
        return {
          contratante,
          cidade,
          distancia: cidade && refCoords ? distanciaKm(refCoords, cidade) : undefined,
        };
      })
      .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }, [contratantes, cidades, refCoords, idsCidadesNoRaio]);

  const cidadesSemCoord = cidades.length - cidadesComCoord.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <div className="card">
        <div className="section-title mb-4 flex items-center gap-2">
          <Search size={14} />
          {t("Busca por raio")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">{t("Cidade de referência")}</label>
            <CidadeGlobalAutocomplete
              value={refCidade}
              onChange={escolherCidade}
              orientacao="horizontal"
            />
            {geocodando && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <Loader2 size={12} className="animate-spin" />
                {t("Localizando a cidade…")}
              </div>
            )}
            {geoErro && <div className="mt-1.5 text-xs text-danger">{geoErro}</div>}
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">
              {t("Raio:")}{" "}<span className="font-semibold text-primary">{raioKm} km</span>
            </label>
            <input
              type="range"
              min={50}
              max={3000}
              step={50}
              value={raioKm}
              onChange={(e) => setRaioKm(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[0.65rem] text-muted mt-0.5">
              <span>50</span>
              <span>3000</span>
            </div>
          </div>
        </div>

        {cidadesSemCoord > 0 && (
          <div className="mt-3 text-xs text-muted">
            {t("{n} cidade(s) sem coordenadas — fique de fora da busca.", { n: cidadesSemCoord })}
          </div>
        )}
      </div>

      {/* Resultados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cidades */}
        <section className="card">
          <div className="section-title mb-3 flex items-center gap-2">
            <MapPin size={14} />
            {t("Cidades no raio ({n})", { n: cidadesNoRaio.length })}
          </div>
          {cidadesNoRaio.length === 0 ? (
            <div className="text-sm text-muted py-3">{t("Nenhuma cidade no raio.")}</div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {cidadesNoRaio.map(({ cidade, distancia }) => (
                <li
                  key={cidade.id}
                  className="flex items-center justify-between bg-elevated border border-border rounded-md px-3 py-2"
                >
                  <div className="text-sm font-medium text-primary truncate">
                    {cidade.nome}
                    <span className="text-muted">/{cidade.estado}</span>
                  </div>
                  <div className="text-xs text-secondary tabular-nums flex-shrink-0">
                    {formatarKm(distancia)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Casas */}
        <section className="card">
          <div className="section-title mb-3 flex items-center gap-2">
            <Building2 size={14} />
            {t("Casas ({n})", { n: casasNoRaio.length })}
          </div>
          {casasNoRaio.length === 0 ? (
            <div className="text-sm text-muted py-3">{t("Nenhuma casa no raio.")}</div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {casasNoRaio.map(({ casa, cidade, distancia }) => (
                <li
                  key={casa.id}
                  className="bg-elevated border border-border rounded-md px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-primary truncate">
                      {casa.nome}
                    </div>
                    <div className="text-xs text-secondary tabular-nums flex-shrink-0">
                      {formatarKm(distancia)}
                    </div>
                  </div>
                  {cidade && (
                    <div className="text-xs text-muted truncate">
                      {cidade.nome}/{cidade.estado}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Contratantes */}
        <section className="card">
          <div className="section-title mb-3 flex items-center gap-2">
            <Users size={14} />
            {t("Contratantes ({n})", { n: contratantesNoRaio.length })}
          </div>
          {contratantesNoRaio.length === 0 ? (
            <div className="text-sm text-muted py-3">{t("Nenhum contratante no raio.")}</div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {contratantesNoRaio.map(({ contratante, cidade, distancia }) => (
                <li
                  key={contratante.id}
                  className="bg-elevated border border-border rounded-md px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-primary truncate">
                      {contratante.nome}
                    </div>
                    <div className="text-xs text-secondary tabular-nums flex-shrink-0">
                      {formatarKm(distancia)}
                    </div>
                  </div>
                  {cidade && (
                    <div className="text-xs text-muted truncate">
                      {cidade.nome}/{cidade.estado}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
