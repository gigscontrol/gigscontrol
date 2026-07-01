-- 44_contratantes_pais.sql
-- País de origem do contratante (ISO 3166-1 alpha-2). Define qual
-- documento fiscal é pedido (BR=CPF/CNPJ, US=SSN/EIN, PT=NIF, ...).
-- Aditivo/seguro — contratantes existentes viram BR.

alter table contratantes add column if not exists pais text not null default 'BR';
