# PLANO DE FINALIZAÇÃO — GIGS CONTROL

> Roadmap pra fechar o produto e começar a faturar. A gente marca o que
> fecha. Ordem pensada pra destravar **receita** o quanto antes —
> pagamento é a espinha porque sem ele o resto é polimento.

**Como usar:** trabalhamos de cima pra baixo. Cada fase termina em algo
*shippable*. Não pular fase sem fechar a anterior (ou marcar explicitamente
como "depois").

**Legenda:** `[x]` feito · `[~]` parcial · `[ ]` a fazer · 🔴 bloqueador de launch

---

## ✅ JÁ FEITO (pra lembrar que não é "nada pronto")

### Dashboard (app autenticado) — ~pronto
- [x] Agenda / calendário (grid mês, navegação, cards por DJ, detalhe do show)
- [x] Orçamentos (wizard 3 etapas, detalhe, histórico, duplicar, status, info extra)
- [x] Vendas (concretizar de orçamento ou avulsa, detalhe, histórico)
- [x] Financeiro (controle de pagamentos, parcelas %/R$, marcar pago)
- [x] Contatos (contratantes / casas / cidades, CRUD, ranking por receita)
- [x] Configurações (geral, artistas, equipe, segurança, histórico, lixeira)
- [x] Notificações (sino no topo + aba completa)
- [x] Lixeira unificada 30 dias (8 tipos de entidade)
- [x] Histórico / audit log de ações

### Landing / vendas — ~pronto
- [x] Landing page (`/`) com hero, features, CTAs
- [x] Pricing (`/planos`) — 5 planos, toggle mensal/anual, FAQ
- [x] Signup self-serve (`/signup`) + verificação de email
- [x] Login (`/login`) com email/senha + OAuth Google/Facebook
- [x] Forgot/reset password

### Auth & multi-tenant — pronto
- [x] Supabase Auth + RLS por workspace
- [x] Login por username (`nome-slugAgencia`)
- [x] Papéis (admin, artista, vendedor, financeiro, produtor, super-admin)
- [x] Flag senha_padrao + valor visível pro admin (migrations 27/28)

---

## 🎯 DECISÕES TRAVADAS
- **Pagamento:** gateway BR (PIX + boleto + cartão) **+** Stripe (cartão internacional).
- **Gateway BR escolhido: Mercado Pago.** (PIX + boleto + cartão; Checkout Pro
  ou API de Assinaturas/Preapproval pra recorrência.)
- **Plano persistido** neste arquivo (`PLANO.md`), versionado no repo.

## ❓ SUB-DECISÕES EM ABERTO
- [ ] Mercado Pago: **Checkout Pro** (redirect, mais simples) vs **Assinaturas/
      Preapproval** (recorrência nativa) vs Checkout transparente (mais trabalho).
- [ ] Cobrança recorrente automática ou renovação manual no 1º momento?
- [ ] Trial de quantos dias? (onboarding hoje assume 7)

---

## FASE 0 — Blindar a dashboard 🟢 *(em andamento)*
> O scan diz "pronto", mas só essa semana achamos 3 bugs reais que scan não
> pega (venda sem DJ, info_extra, capacidade). Teste de verdade, não carimbo.

### Sweep de classes de bug conhecidas (feito)
- [x] `type="date"` locale → limpo (tudo migrado pra InputDataBR)
- [x] COLS de repo faltando coluna → varrido todos; só usuarios.repo (latente) → **corrigido**
- [x] Schema numérico estrito (risco 500) → `contatos.capacidade` endurecido (coerção) ✓
- [x] null filtrado escondendo dado → mapeado (raiz já corrigida; resíduo no backlog)

### Smoke test logado (Claude dirigiu o browser) — feito
- [x] Agenda dashboard + Agenda de Shows renderizam dado real
- [x] Vendas dashboard + detalhe da venda OK (CPF/CNPJ, capacidade,
      info_extra, datas BR confirmados ao vivo)
- [x] **Bug 1 achado + corrigido:** venda duplicada (ORC concretizado 2x
      → 2 VND com mesmo número). Fix nas 4 camadas (client/server/banco/
      limpeza). Migration 30.
- [x] **Bug 2 achado + corrigido:** calendário Mon-first vs header
      DOM-first (off-by-one). Alinhado pra DOM-first. Verificado ao vivo.

### Smoke test — varredura completa (Claude dirigiu)
- [x] Financeiro: totais batem com o dado curado (R$5k, atrasado OK)
- [x] Contatos: Bruno Galindo 1 show/1 venda consistente
- [x] Config › Geral: logo, nome, e-mail OK
- [x] Config › Artistas: editar Maninhoo — bloco Senha mostra
      `Delta-Lyra-9700` (senha padrão) + e-mail "não cadastrou" ✓ ao vivo
- [x] Config › Equipe: vazia (plano Individual 0/1) — esperado
- [x] Lixeira: itens trashados com Restaurar funcionando
- [x] Migration 30 rodada no DEV (+ conserto do show órfão)

### Falta (ação do usuário)
- [ ] Confirmar migrations **27, 28, 29, 30** aplicadas em PROD
- [ ] (Opcional) Pass de responsivo mobile
- [ ] (Opcional) Testar bloco senha de Equipe — exige criar 1 membro
      (código já verificado, espelha o do artista)

---

## FASE 1 — Pagamento real (Mercado Pago Checkout Pro) 🔴
> **Decidido:** Checkout Pro (redirect, PIX+boleto+cartão, paga por ciclo).
> Recorrência automática (Preapproval) e Stripe ficam pra depois.
> Muita fundação JÁ existe: tabela `subscriptions`, 5 planos, onboarding
> Etapa 2, `/pagamento` (mock), endpoints escolher/ativar-plano e trial.

### Você (em paralelo, antes de testar)
- [ ] Criar aplicação no Mercado Pago Developers → pegar **Access Token**
      e **Public Key** (modo TESTE primeiro)
- [ ] Pôr as chaves no `.env.local` (dev) e na Vercel (prod) — Claude
      não manuseia chave secreta

### Build (Claude) — feito, falta testar
- [x] **31 — schema**: colunas MP em subscriptions + tabela
      `pagamento_eventos` (idempotência)
- [x] **SDK + env**: `mercadopago@3.1.0` + .env.example
- [x] **mercadopago.service**: criarPreferenceCheckout + buscarPagamento
- [x] **POST /api/checkout/mercadopago**: cria a preference, grava ref
- [x] **/pagamento**: resumo + botão "Pagar com Mercado Pago" → init_point
- [x] **/pagamento/retorno**: back_url, polling até ativar
- [x] **POST /api/webhooks/mercadopago**: ativa no payment.approved,
      x-signature gated, idempotente, proxima_cobranca por ciclo

### Testar (precisa de ação tua)
- [ ] Rodar **migration 31** no Supabase (DEV)
- [ ] `.env.local`: garantir MP keys + `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- [ ] Restart do dev server (Claude faz) + testar o botão → checkout MP
- [ ] **Webhook em dev**: MP não alcança localhost. Pra testar ativação
      precisa de túnel (ngrok/cloudflared) OU deploy na Vercel preview.
      Configurar o webhook no painel MP apontando pra essa URL.

---

## FASE 2 — Enforcement de assinatura 🔴 *(tampar o vazamento)*
> Hoje conta suspensa/vencida continua funcionando = dinheiro vazando.

- [ ] Trial expira de verdade (checagem no login + middleware)
- [ ] Status `suspenso`/`vencido` bloqueia acesso ao app (middleware/API)
- [ ] Tela de "renovar assinatura" pro bloqueado
- [ ] Cron/job de verificação diária de vencimentos
- [ ] Notificar cliente X dias antes do vencimento

---

## FASE 3 — Painel admin com dado real 🟡
> UI e CRUD já existem. Trocar os mocks por dado de verdade.

- [ ] MRR/ARR/Churn calculados das assinaturas reais (hoje `MOCK_*`)
- [ ] Métricas de uso por workspace reais (shows/vendas/receita) — hoje hardcoded
- [ ] Audit log do admin ligado ao histórico real (hoje `MOCK_LOGS`)
- [ ] Gestão de trial ligada à Fase 1/2
- [ ] Suspender/reativar com efeito real (puxa do enforcement da Fase 2)
- [ ] (Opcional) Notas por cliente / suporte

---

## FASE 4 — Fechar a landing pra vender 🟡
- [ ] 🔴 Termos de uso reais (revisão jurídica — LGPD)
- [ ] 🔴 Política de privacidade real (LGPD)
- [ ] SEO: metadata por página + OG tags + JSON-LD
- [ ] Sinais de confiança: depoimentos, logos, "como funciona"
- [ ] Revisar copy de conversão (hero → planos → signup)

---

## FASE 5 — Pré-lançamento
- [ ] Todas as migrations aplicadas em PROD
- [ ] Teste do funil completo: landing → signup → email → onboarding → pagar → app
- [ ] Monitoramento de erro (Sentry ou similar)
- [ ] Backup/restore do banco testado
- [ ] Revisão de segurança (RLS, rotas admin, service_role)
- [ ] Checklist de "primeiro cliente real"

---

## BACKLOG (não bloqueia launch — fazer depois)
- [ ] **Resíduo do null-filter:** shows/vendas/orçamentos com `djId` vazio (DJ
      deletado) somem das dashboards e da agenda (5 superfícies filtram por
      `selectedDJs.includes(x.djId)`). Raiz já corrigida (concretizar sempre
      grava DJ). Falta tratar órfãos legados — ex: bucket "Sem DJ" ou
      reatribuição. Decisão anterior do user: DJ sempre travado do orçamento,
      sem bucket. Reavaliar se aparecerem órfãos.
- [ ] Validação de colisão nome/email no modal de equipe (espelhar AbaArtistas)
- [ ] Proteção de reuso de email de equipe na lixeira
- [ ] Máscara de telefone consistente em todo o site
- [ ] Date picker visual (popover) além do InputDataBR
- [ ] Schema: `union([number,string])` em mais campos numéricos (integrações n8n/zapier)
