-- 51 — Geolocalização própria de contratantes e casas (Mapa de Dobras).
--
-- Modelo (tokens.md §7): todo contato localizável ganha coordenadas próprias:
--   lat/lng          → ponto no mapa
--   geo_precision    → 'address' (endereço geocodificado) | 'city' (centroide)
--   geocoded_at      → cache; só re-geocodifica se endereço/cidade mudarem
--
-- BACKFILL: linhas existentes herdam o centroide da cidade (cidade_id →
-- cidades.latitude/longitude) com geo_precision='city' — o mapa já nasce
-- populado; o refinamento pra 'address' acontece no próximo save de cada
-- contato. Idempotente (IF NOT EXISTS + UPDATE só onde lat IS NULL).

alter table contratantes
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_precision text,
  add column if not exists geocoded_at timestamptz;

alter table casas
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_precision text,
  add column if not exists geocoded_at timestamptz;

-- Backfill: centroide da cidade vinculada.
update contratantes ct
set lat = c.latitude::double precision,
    lng = c.longitude::double precision,
    geo_precision = 'city',
    geocoded_at = now()
from cidades c
where c.id = ct.cidade_id
  and ct.lat is null
  and c.latitude is not null
  and c.longitude is not null;

update casas ca
set lat = c.latitude::double precision,
    lng = c.longitude::double precision,
    geo_precision = 'city',
    geocoded_at = now()
from cidades c
where c.id = ca.cidade_id
  and ca.lat is null
  and c.latitude is not null
  and c.longitude is not null;
