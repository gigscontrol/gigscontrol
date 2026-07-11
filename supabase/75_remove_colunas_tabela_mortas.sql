-- Limpeza de duplicação morta (confirmado: 0 não-nulos, sem referência de
-- leitura/escrita no código após os edits desta rodada).
-- E-mail de contato órfão (a feature de admin setar e-mail foi removida):
alter table profiles drop column if exists email_contato;
alter table artists  drop column if exists email;
-- Tabela de log duplicada e VAZIA (o log real é historico_acoes, 71 linhas;
-- activity_logs tem 0 linhas e nenhuma referência no código):
drop table if exists activity_logs;
