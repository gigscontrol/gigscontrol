-- 48_signatario_aberturas.sql
-- Conta quantas vezes o assinante ABRIU o link de assinatura sem assinar,
-- pra mostrar o status por contrato: cinza (nunca abriu) · laranja (abriu mas
-- não assinou, com a contagem no hover) · verde (assinou).
-- Aditivo/seguro: signatários existentes ficam com aberturas = 0.

alter table contrato_signatarios add column if not exists aberturas int default 0;
