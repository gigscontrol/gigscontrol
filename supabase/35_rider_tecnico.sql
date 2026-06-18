-- ============================================================
-- 35: ARTISTAS — rider técnico (DJ)
-- ============================================================
-- Adiciona ao cadastro de artista um terceiro rider, espelhando
-- rider_camarim e rider_efeitos (migração 21):
--   • Rider técnico — equipamentos do DJ (ex: CDJ-3000, DJM-900NXS2,
--     monitor de palco, sistema de PA). jsonb por artista, só os NOMES;
--     a quantidade é definida em cada orçamento.
-- ============================================================

-- Rider salvo no artista (sugestões pro vendedor escolher por orçamento).
-- Shape: ["CDJ-3000", "DJM-900NXS2", ...]
alter table artists add column if not exists rider_tecnico jsonb default '[]'::jsonb;
