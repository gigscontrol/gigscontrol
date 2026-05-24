"use client";

import { useMemo, useState } from "react";
import { MapPin, Building2, Users, Search } from "lucide-react";
import { useContatos } from "@/lib/contatos-context";
import { distanciaKm, formatarKm } from "@/lib/geo";

/**
 * Mapa de Dobras — busca de contatos por raio (km) a partir de uma
 * cidade de referência.
 *
 * Versão funcional (sem mapa visual). Lista cidades, casas e contratantes
 * dentro do raio, ordenados por distância. Itens cuja cidade não tem
 * coordenadas no banco são marcados como "sem coordenadas".
 */
export default function MapaDobras() {
  const { cidades, casas, contratantes } = useContatos();

  // Padrão: primeira cidade com coordenadas
  const cidadesComCoord = useMemo(
    () => cidades.filter((c) => c.latitude !== undefined && c.longitude !== undefined),
    [cidades]
  );

  const [cidadeBaseId, setCidadeBaseId] = useState<string>(
    cidadesComCoord[0]?.id ?? ""
  );
  const [raioKm, setRaioKm] = useState<number>(500);

  const cidadeBase = useMemo(
    () => cidades.find((c) => c.id === cidadeBaseId),
    [cidades, cidadeBaseId]
  );

  const cidadesNoRaio = useMemo(() => {
    if (!cidadeBase) return [];
    return cidades
      .map((c) => ({ cidade: c, distancia: distanciaKm(cidadeBase, c) }))
      .filter((x) => x.distancia !== undefined && x.distancia! <= raioKm)
      .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }, [cidadeBase, cidades, raioKm]);

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
          distancia: cidade && cidadeBase ? distanciaKm(cidadeBase, cidade) : undefined,
        };
      })
      .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }, [casas, cidades, cidadeBase, idsCidadesNoRaio]);

  const contratantesNoRaio = useMemo(() => {
    return contratantes
      .filter((c) => idsCidadesNoRaio.has(c.cidadeId))
      .map((contratante) => {
        const cidade = cidades.find((c) => c.id === contratante.cidadeId);
        return {
          contratante,
          cidade,
          distancia: cidade && cidadeBase ? distanciaKm(cidadeBase, cidade) : undefined,
        };
      })
      .sort((a, b) => (a.distancia ?? 0) - (b.distancia ?? 0));
  }, [contratantes, cidades, cidadeBase, idsCidadesNoRaio]);

  const cidadesSemCoord = cidades.length - cidadesComCoord.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <div className="card">
        <div className="section-title mb-4 flex items-center gap-2">
          <Search size={14} />
          Busca por raio
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted block mb-1">Cidade de referência</label>
            <select
              value={cidadeBaseId}
              onChange={(e) => setCidadeBaseId(e.target.value)}
              className="w-full bg-elevated border border-border rounded-md px-3 py-2 text-sm"
            >
              {cidadesComCoord.length === 0 && (
                <option value="">Nenhuma cidade com coordenadas</option>
              )}
              {cidadesComCoord.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}/{c.estado}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">
              Raio: <span className="font-semibold text-primary">{raioKm} km</span>
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
            {cidadesSemCoord} cidade(s) sem coordenadas — fique de fora da busca.
          </div>
        )}
      </div>

      {/* Resultados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cidades */}
        <section className="card">
          <div className="section-title mb-3 flex items-center gap-2">
            <MapPin size={14} />
            Cidades no raio ({cidadesNoRaio.length})
          </div>
          {cidadesNoRaio.length === 0 ? (
            <div className="text-sm text-muted py-3">Nenhuma cidade no raio.</div>
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
            Casas ({casasNoRaio.length})
          </div>
          {casasNoRaio.length === 0 ? (
            <div className="text-sm text-muted py-3">Nenhuma casa no raio.</div>
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
            Contratantes ({contratantesNoRaio.length})
          </div>
          {contratantesNoRaio.length === 0 ? (
            <div className="text-sm text-muted py-3">Nenhum contratante no raio.</div>
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
