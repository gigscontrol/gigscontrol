-- Migration 99 — assinatura PENDENTE de confirmação por e-mail (OTP) +
-- CPF avançado (nome completo + data de nascimento do signatário).
--
-- Fluxo novo do OTP (pedido do dono, 04/09/2026): a pessoa preenche TUDO e
-- clica em assinar; o servidor guarda o pacote em `pendente_payload` (fotos já
-- sobem pro Storage; aqui ficam só os paths), envia o código de 6 dígitos E um
-- botão mágico por e-mail; a assinatura só EFETIVA quando ela digita o código
-- na página OU clica no botão do e-mail. Validade: 30 minutos (otp_expira_em).
--
-- `confirm_token_hash`: sha256 do token do botão mágico (o token cru só viaja
-- no e-mail). `nome_completo`/`data_nascimento`: coletados pela exigência
-- "CPF avançado".

alter table public.contrato_signatarios
  add column if not exists pendente_payload jsonb,
  add column if not exists confirm_token_hash text,
  add column if not exists nome_completo text,
  add column if not exists data_nascimento date;

comment on column public.contrato_signatarios.pendente_payload is
  'Assinatura submetida aguardando confirmação por e-mail (OTP/botão). Campos: assinatura, documento, ip, geolocalizacao, dispositivo, fuso_horario, arquivos (paths no Storage), nome_completo, data_nascimento. Limpo na efetivação/expiração.';
comment on column public.contrato_signatarios.confirm_token_hash is
  'sha256 do token do botão "concluir assinatura" enviado por e-mail (mesmo prazo do OTP).';

create index if not exists contrato_signatarios_confirm_token_idx
  on public.contrato_signatarios (confirm_token_hash)
  where confirm_token_hash is not null;
