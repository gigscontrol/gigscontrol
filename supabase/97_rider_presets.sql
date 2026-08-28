-- 97 — PRESETS DE RIDER por artista (feature 28/08/2026)
--
-- Cada artista ganha até 3 presets NOMEADOS por categoria (camarim, efeitos,
-- técnico): conjuntos de itens COM quantidade, prontos pra aplicar no Novo
-- Orçamento / Concretizar Venda com um clique. O rider legado
-- (rider_camarim/efeitos/tecnico, string[] de nomes) continua sendo o
-- "cardápio" — o preset é a combinação pronta por cima dele.
--
-- Shape do jsonb (validado no app por normalizarPresets — lib/presetsRider.ts):
--   {
--     "camarim": [ { "nome": "Padrão", "itens": [ {"nome":"...","qtd":1}, ... ] }, ... ],
--     "efeitos": [ ... ],
--     "tecnico": [ ... ]
--   }
--
-- Default '{}' → toda linha existente lê como "sem presets" sem coalesce.
-- Nullable não: o app sempre normaliza objeto.

alter table public.artists
  add column if not exists rider_presets jsonb not null default '{}'::jsonb;

comment on column public.artists.rider_presets is
  'Presets de rider por categoria (camarim/efeitos/tecnico): até 3 por categoria, cada um {nome, itens:[{nome,qtd}]}. Ver lib/presetsRider.ts.';
