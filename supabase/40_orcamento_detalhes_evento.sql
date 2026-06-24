-- Migration 40 — Orçamento detalhado
-- Guarda as informações do evento (nome, @instagram, local, capacidade,
-- endereço, data, horários) num jsonb no orçamento, pra pré-preencher a venda
-- quando o orçamento for transformado. Não aparece no copia-e-cola do WhatsApp.

alter table public.orcamentos
  add column if not exists detalhes_evento jsonb;
