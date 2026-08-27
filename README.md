# GIGS CONTROL

SaaS multi-tenant de gestão para agências de artistas e DJs: agenda de shows,
orçamentos, vendas, financeiro (parcelas), contratos com assinatura digital,
contatos e equipe — com landing page, planos pagos e painel super-admin.

**Produção:** https://gigscontrol.com (Vercel) · **Banco:** Supabase (sa-east-1)

## Stack

- **Next.js 14** (App Router) · React 18 · TypeScript `strict` · Tailwind CSS
- **Supabase**: Postgres 17 + Auth + Storage, RLS por workspace em todas as tabelas
- **Pagamentos**: Stripe (mundo, cartão) + Mercado Pago (BR: PIX + cartão via
  Payment Brick) — modelo **pré-pago por validade** (`subscriptions.acesso_ate`)
- **Sentry** nos 3 runtimes · **Vitest** + CI (GitHub Actions)

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha — ver comentários no próprio arquivo
npm run dev                  # http://localhost:3000
```

Scripts úteis: `npm test` (vitest) · `npm run typecheck` · `npm run lint`.

> As variáveis essenciais são as do Supabase; as demais (Stripe, Mercado Pago,
> Google Calendar, etc.) só afetam a própria feature — o app roda sem elas.

## Arquitetura (src/)

```
app/            rotas (App Router) — app autenticado em app/, APIs em api/ (~108 rotas)
components/     telas e widgets (client) — dashboard, wizards, admin/
lib/
  api/          sessão (autenticarComWorkspace), permissões, erros, rate-limit
  services/     regra de negócio (31 módulos) — billing, contratos, artistas...
  repositories/ acesso a dados (projeção COLS explícita)
  mappers/      linha do banco ⇄ tipo do domínio
  validators/   schemas zod por domínio
  i18n*.ts      PT (fonte) + EN/ES/FR/DE/IT carregados por chunk sob demanda
supabase/       scripts SQL numerados (01–96+) aplicados via SQL Editor — LEIA-ME.md
```

Padrão das rotas de API: `autenticar → permissão → zod → service → audit log`.
Toda mutação passa pelo paywall server-side (`exigirAcesso`) e vira histórico +
soft-delete com lixeira de 30 dias.

## Documentos vivos

- [PLANO.md](PLANO.md) — roadmap com checkboxes (fonte da verdade do que falta)
- [PLANO-BACKEND.md](PLANO-BACKEND.md) — arquitetura do backend em detalhe
- [GUIA-CLAUDE-CODE.md](GUIA-CLAUDE-CODE.md) — como trabalhar no projeto com o Claude

## Billing em uma linha

Todo pagamento aprovado (Stripe/MP/cortesia/cupom) passa pela RPC idempotente
`registrar_pagamento_estender` (UNIQUE por provider+payment id) que estende a
validade; o acesso deriva de `acesso_ate` em tempo real (1 dia de graça), sem
cron. Upgrade reinicia a validade com crédito convertido, decidido no webhook.
