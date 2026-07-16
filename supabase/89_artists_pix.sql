-- ============================================================
-- 89 — Chave PIX do artista
-- ============================================================
-- Campo de texto livre (telefone, e-mail, CPF/CNPJ ou chave aleatória).
-- Só é preenchido/exibido pro artista BRASILEIRO (gating no formulário).
-- Dado sensível: redigido para não-admin em redigirArtista (mappers/artista.ts).
alter table artists add column if not exists pix text;
