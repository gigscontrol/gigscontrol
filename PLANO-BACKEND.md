# GIGS CONTROL — Plano de Backend (MVP)

> Documento de planejamento. Define banco, arquitetura, endpoints e ordem de
> execução **antes** de escrever código. Revise e ajuste — só depois codamos.

---

## 1. Decisões fechadas

| Tema        | Decisão                                                    |
|-------------|------------------------------------------------------------|
| Banco       | **Supabase** (PostgreSQL gerenciado)                       |
| Backend     | **Route Handlers do Next.js** (`app/api/...`)              |
| Front       | React (já existe) — passa a consumir a API no lugar do mock|
| Auth        | **Supabase Auth** (e-mail/senha)                           |
| Deploy      | **Vercel** (front + API) + Supabase (banco)                |
| Organização | **Por camadas** (ver seção 3)                              |

### Por que não MVC clássico

Next.js não é MVC. O equivalente profissional é separar por camadas:
**rota → service → repository → banco**. Cada camada tem uma responsabilidade
única, igual ao que o MVC busca, mas sem brigar com o framework.

---

## 2. Multi-tenant — a regra mais importante

Cada agência é um **workspace** (tenant). Todo dado pertence a um workspace.
A regra de ouro: **nenhum cliente pode ver dado de outro**.

Isso é garantido em DUAS camadas:

1. **Row Level Security (RLS)** no Supabase — o banco recusa, por padrão,
   qualquer linha que não seja do workspace do usuário logado. É a trava
   final, à prova de bug de código.
2. **Filtro por `workspace_id`** em toda query da camada de repositório.

O super-admin tem uma policy especial que enxerga todos os workspaces.

---

## 3. Estrutura de pastas (depois do backend)

```
src/
├── app/
│   ├── api/                      → Route Handlers (a "API")
│   │   ├── auth/
│   │   ├── shows/
│   │   ├── orcamentos/
│   │   ├── vendas/
│   │   ├── parcelas/
│   │   ├── contatos/
│   │   ├── usuarios/
│   │   └── admin/                → endpoints só do super-admin
│   ├── (rotas de página já existentes)
│
├── lib/
│   ├── db/
│   │   ├── supabase.ts           → cliente browser
│   │   └── supabase-server.ts    → cliente server (com cookies/sessão)
│   │
│   ├── repositories/             → CAMADA DE DADOS (fala com o banco)
│   │   ├── shows.repo.ts
│   │   ├── orcamentos.repo.ts
│   │   ├── vendas.repo.ts
│   │   ├── contatos.repo.ts
│   │   └── ...
│   │
│   ├── services/                 → CAMADA DE NEGÓCIO (regras, validação)
│   │   ├── shows.service.ts
│   │   ├── vendas.service.ts     → ex: ao concretizar venda, gera show + parcelas
│   │   └── ...
│   │
│   ├── validators/               → schemas de validação (zod)
│   │
│   ├── *-context.tsx             → contexts (passam a chamar a API)
│   └── ...                       → helpers já existentes
│
└── types/                        → tipos compartilhados (já existe)
```

**Fluxo de uma requisição:**

```
Componente React
   → context (fetch para /api/...)
      → Route Handler (app/api/.../route.ts)   valida entrada, checa sessão
         → Service                             aplica regras de negócio
            → Repository                       monta a query
               → Supabase (Postgres + RLS)     executa, RLS filtra o tenant
```

---

## 4. Schema do banco (tabelas)

Todas as tabelas (exceto `workspaces` e `plans`) têm `workspace_id` e RLS.

### `workspaces` — as contas/agências
| coluna        | tipo        | nota                          |
|---------------|-------------|-------------------------------|
| id            | uuid PK     |                               |
| nome          | text        |                               |
| plano         | text        | FK lógica → plans.id          |
| ciclo         | text        | mensal \| anual               |
| status        | text        | ativa \| trial \| suspensa... |
| criado_em     | timestamptz |                               |

### `profiles` — usuários (extensão do Supabase Auth)
| coluna        | tipo    | nota                                   |
|---------------|---------|----------------------------------------|
| id            | uuid PK | = id do usuário no Supabase Auth        |
| workspace_id  | uuid FK | nulo para o super-admin                 |
| nome          | text    |                                        |
| email         | text    |                                        |
| papel         | text    | admin/artista/vendedor/produtor/financeiro |
| is_super_admin| bool    | true só para o admin da plataforma     |
| artista_id    | uuid FK | se papel=artista, qual artista ele é   |
| status        | text    | ativo \| bloqueado \| desativado       |

### `plans` — catálogo de planos (global, sem workspace)
id, nome, preco_mensal, preco_anual_por_mes, max_artistas, max_usuarios, recursos (jsonb)

### `artists` — os DJs/cantores/MCs
id, workspace_id, nome, cor, criado_em

### `contratantes`
id, workspace_id, nome, documento, email, telefone, endereco, cidade_id, criado_por (FK profiles), criado_em

### `casas`
id, workspace_id, nome, tipo, cidade_id, capacidade, endereco, contato, telefone

### `cidades`
id, workspace_id, nome, estado

### `orcamentos`
id, workspace_id, numero, status, tipo_evento, contratante_id, casa_id, cidade_id,
artist_id, valor_cache, duracao, itens (jsonb: camarim/efeitos/hotel), logistica (jsonb),
criado_por, criado_em

### `vendas`
id, workspace_id, numero, orcamento_id, show_id, dados do contratante (snapshot),
dados do evento, artist_id, cache, line_up (jsonb), itens (jsonb), logistica (jsonb),
criado_por, criado_em

### `parcelas` — pagamentos das vendas
id, workspace_id, venda_id, percentual, valor, data_vencimento, status_base, data_pagamento

### `shows` — agenda
id, workspace_id, artist_id, contratante_id, casa_id, cidade_id, data, horario,
status, valor, orcamento_id, venda_id

### `subscriptions` — histórico de cobrança (painel super-admin)
id, workspace_id, plano, ciclo, status, valor, inicio_em, proxima_cobranca

### `activity_logs` — auditoria
id, workspace_id, tipo, descricao, usuario_id, data

---

## 5. Endpoints da API

Padrão REST. Todos exigem sessão; o `workspace_id` sai da sessão (nunca do
cliente — segurança).

```
POST   /api/auth/login            entra (Supabase Auth)
POST   /api/auth/logout           sai
GET    /api/auth/me               sessão atual + perfil

GET    /api/shows                 lista shows do workspace
POST   /api/shows                 cria show
GET    /api/shows/:id             detalhe
PATCH  /api/shows/:id             edita
DELETE /api/shows/:id             remove

GET/POST/PATCH/DELETE  /api/orcamentos[/:id]
GET/POST/PATCH/DELETE  /api/vendas[/:id]
PATCH  /api/parcelas/:id          informar/desfazer pagamento
GET/POST/PATCH/DELETE  /api/contatos/contratantes[/:id]
GET/POST/PATCH/DELETE  /api/contatos/casas[/:id]
GET/POST/PATCH/DELETE  /api/contatos/cidades[/:id]
GET/POST/PATCH/DELETE  /api/usuarios[/:id]      (gestão da equipe)

— Só super-admin —
GET    /api/admin/workspaces      todas as assinaturas
PATCH  /api/admin/workspaces/:id  muda status/plano
GET    /api/admin/usuarios        todos os usuários da plataforma
GET    /api/admin/metricas        KPIs (MRR, churn, etc.)
```

---

## 6. Autenticação e papéis

- **Supabase Auth** cuida de senha (hash, reset) e sessão (cookie seguro).
- No login, busca-se o `profile` → papel + workspace.
- Cada Route Handler valida a sessão antes de qualquer coisa.
- As **permissões por papel** (já temos `calcularPermissoes`) passam a ser
  aplicadas no service: ex. um vendedor só recebe os contratantes do escopo
  dele; um artista só os próprios shows.
- O RLS no banco reforça tudo isso como rede de segurança.

---

## 7. Ordem de execução (uma fatia por vez)

Cada passo é entregue e validado antes do próximo.

| # | Etapa | Entrega |
|---|-------|---------|
| 0 | **Setup** | Projeto no Supabase, variáveis de ambiente, clientes `db/` |
| 1 | **Schema + RLS** | Todas as tabelas criadas via SQL, RLS ligado, seed de exemplo |
| 2 | **Auth real** | Login/logout via Supabase, `/api/auth/*`, troca do auth-context mock |
| 3 | **Shows** | Repo + service + API + ligar o shows-context na API |
| 4 | **Contatos** | Contratantes, casas, cidades |
| 5 | **Orçamentos** | CRUD completo |
| 6 | **Vendas + Parcelas** | CRUD + regra "concretizar venda gera show e parcelas" |
| 7 | **Usuários/equipe** | Gestão de usuários do workspace |
| 8 | **Painel super-admin** | Endpoints `/api/admin/*` com dados reais |
| 9 | **Permissões aplicadas** | Filtro por papel em cada service |
| 10| **Deploy** | Vercel + Supabase em produção |

> Observação importante: eu **não consigo criar o projeto no Supabase nem
> rodar o deploy** — isso depende de você (precisa de conta, senha, painel).
> O que eu faço: gero todo o código, os scripts SQL e um passo a passo
> exato do que você clica/cola em cada serviço.

---

## 8. O que muda no que já existe

- Os `*-context.tsx` deixam de usar `mock-*.ts` e passam a chamar `/api/...`.
  A interface dos contexts (as funções que os componentes usam) **continua
  igual** — os componentes não precisam ser reescritos.
- Os arquivos `mock-*.ts` viram **seed** do banco (passo 1) e depois saem.
- `auth-context.tsx` passa a falar com o Supabase Auth.

---

## 9. Decisões que ainda precisam de você

1. **Conta no Supabase** — criar em supabase.com (grátis). Sem isso o passo 0
   não anda.
2. **Pagamento real** (Stripe/PIX) entra **depois** do MVP — por enquanto o
   status da assinatura é definido manualmente no painel admin.
3. **Senha das contas demo** — com auth real, `two/two` e `admin/admin`
   viram usuários de verdade no banco (criados no seed).

---

## Próximo passo

Revise este plano. Se aprovar, começo pelo **Passo 0 + 1** (setup e schema):
eu gero os scripts SQL completos e o guia de configuração do Supabase, e
você executa no painel. A partir daí seguimos fatia por fatia.

---

## 10. ATUALIZAÇÃO — estado real do projeto (maio/2026)

> Esta seção foi adicionada depois. Reflete tudo que mudou desde que o
> plano original foi escrito. Leia-a com prioridade.

### O que já está PRONTO (parte do material de backend)

- **Supabase já criado** — projeto ativo, URL e chaves nos arquivos `.env`.
- **Scripts SQL prontos e testados** na pasta `supabase/`:
  - `01_schema.sql` — 13 tabelas (JÁ EXECUTADO no Supabase do cliente)
  - `02_policies.sql` — RLS (JÁ EXECUTADO)
  - `03_seed.sql` — planos (JÁ EXECUTADO)
  - `04_usuarios_demo.sql` — workspace + profiles dos 2 usuários
  - `99_reset.sql` — limpar tudo
- **Clientes de conexão prontos** em `src/lib/db/` (browser, server, admin).
- **Auth real guardado** em `src/lib/auth-context.supabase.bak` — é a versão
  do auth-context integrada ao Supabase Auth. Para religar: substituir o
  `auth-context.tsx` atual (mock) por este arquivo.
- Usuários reais já criados no Supabase Auth:
  - `brunorafaelsocek@outlook.com` — cliente (admin do workspace)
  - `gigscontrol26@gmail.com` — super-admin da plataforma

### O que mudou no PRODUTO desde o plano original

O plano original (seções 1-9) continua válido na arquitetura. Mas o produto
cresceu — o backend precisa cobrir também:

1. **Módulo de Configurações do workspace** (`workspace-context.tsx`):
   - Aparência: nome da agência + logo (logo → Supabase **Storage**)
   - Artistas: CRUD com limite por plano + **suspensão de acesso**
   - Equipe: criar usuários, papéis acumuláveis, escopo de permissão
   - Segurança: troca de senha (via Supabase Auth)
2. **Tabela `artists`** precisa do campo `acesso_suspenso` (boolean).
3. **Lixeira de 30 dias** — exclusão de artistas/usuários é "soft delete":
   - Campos `deletado_em` (timestamptz) nas tabelas relevantes
   - Um registro deletado some das listas, mas fica recuperável por 30 dias
   - Limpeza definitiva após 30 dias (job agendado, ou checagem na leitura)
4. **Autoria dos registros** — shows, orçamentos, vendas e contatos já têm
   `criado_por`. A UI deve mostrar "usuário removido" quando o autor foi
   excluído (não apagar o registro, só exibir o estado).
5. **Mapa de Dobras** (Contatos) — busca de contatos por raio em km:
   - A tabela `cidades` precisa de `latitude` e `longitude`
   - No seed, popular as coordenadas (fonte: IBGE)
6. **Planos** — a estrutura mudou para `max_artistas` +
   `max_usuarios_adicionais` (ver `src/lib/planos.ts`). O `03_seed.sql`
   pode precisar de ajuste para bater com os 5 planos atuais.

### Unificação de IDs (number → string/uuid)

O projeto mock usa **IDs numéricos** (1, 2, 3) em shows, vendas, contatos,
etc. O Supabase usa **UUID** (string). Essa migração:

- **NÃO foi feita** — uma tentativa no ambiente de chat falhou (sem
  compilador para validar). É uma mudança que toca ~340 pontos.
- **Deve ser feita no Claude Code**, entidade por entidade, junto com a
  conexão de cada uma ao banco. Cada entidade que conecta ao Supabase
  recebe UUID naturalmente. Não é um passo separado — acontece dentro de
  cada fatia (shows, contatos, orçamentos...).
- A exceção: `djId` chegou a ser parcialmente migrado e revertido. Está
  como `number` de novo. Tratar junto com os outros.

### Ordem de execução recomendada (revisada)

Mantém a lógica do plano original (seção 7), com os ajustes:

| # | Etapa | Observação |
|---|-------|------------|
| 0 | Setup | Supabase já existe — só conferir `.env.local` |
| 1 | Schema + RLS | Já executado. Adicionar: `acesso_suspenso`, `deletado_em`, `lat/lng` em cidades |
| 2 | Auth real | Restaurar `auth-context.supabase.bak`. Testar login dos 2 usuários |
| 3 | Shows | Conectar + migrar IDs dos shows para uuid |
| 4 | Contatos | Contratantes, casas, cidades (+ coordenadas para o Mapa de Dobras) |
| 5 | Orçamentos | CRUD + dedup de contato por telefone |
| 6 | Vendas + Parcelas | CRUD + regra "concretizar venda gera show e parcelas" |
| 7 | Workspace/Configurações | Aparência, artistas, equipe, suspensão |
| 8 | Lixeira | Soft delete de 30 dias para artistas e usuários |
| 9 | Painel super-admin | Endpoints `/api/admin/*` com dados reais |
| 10 | Permissões aplicadas | Filtrar dados por papel/escopo dentro da dashboard |
| 11 | Deploy | Vercel + Supabase em produção |

### Como executar (no Claude Code)

Este backend deve ser feito no **Claude Code** — a ferramenta de terminal
da Anthropic que roda o projeto, compila o TypeScript e testa cada passo.
O chat do Claude.ai não compila código, por isso a parte de backend não
pode ser feita lá.

Passo a passo no Claude Code:
1. Abrir o projeto GIGS CONTROL no Claude Code.
2. Apontar este `PLANO-BACKEND.md` como referência.
3. Pedir para executar uma etapa por vez (começar pela 2 — Auth).
4. A cada etapa: o Claude Code escreve o código, roda `npm run dev`,
   corrige os erros que aparecem, e só então passa para a próxima.

O Claude Code conversa em linguagem natural — não é preciso saber
programar para conduzi-lo.
