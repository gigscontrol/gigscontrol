# flow.book

CRM e gestão para DJs, cantores, MCs e agências musicais. SaaS multi-tenant
com landing page, planos, autenticação, dashboard de cliente e painel de
administração da plataforma.

Stack: **Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS**.

---

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.

> Ao trocar a versão dos arquivos, apague a pasta `.next` antes de rodar de
> novo, para o Next.js não servir build em cache.

### Contas de demonstração

| Login             | Tipo              | Onde cai         |
|-------------------|-------------------|------------------|
| `two` / `two`     | Cliente (agência) | Dashboard `/app` |
| `admin` / `admin` | Super-admin       | Painel `/admin`  |

---

## Rotas (`src/app`)

| Rota      | Arquivo            | Descrição                                   |
|-----------|--------------------|---------------------------------------------|
| `/`       | `page.tsx`         | Landing page pública                        |
| `/planos` | `planos/page.tsx`  | Página de planos (carrossel + mensal/anual) |
| `/login`  | `login/page.tsx`   | Tela de login                               |
| `/app`    | `app/page.tsx`     | Dashboard do cliente (protegida)            |
| `/admin`  | `admin/page.tsx`   | Painel da plataforma (só super-admin)       |

---

## Estrutura de pastas

```
src/
├── app/                  Rotas (Next.js App Router)
│   ├── page.tsx              landing
│   ├── planos/               página de planos
│   ├── login/                login
│   ├── app/                  dashboard do cliente
│   ├── admin/                painel da plataforma
│   ├── layout.tsx            layout raiz + metadata
│   └── globals.css           design tokens + classes utilitárias
│
├── components/           Componentes da DASHBOARD DO CLIENTE
│   ├── admin/                Componentes do PAINEL DA PLATAFORMA
│   │   ├── AdminDashboard.tsx    KPIs do negócio
│   │   ├── AdminClientes.tsx     lista de clientes + detalhe
│   │   ├── AdminAssinaturas.tsx  gestão de assinaturas
│   │   └── AdminPlanos.tsx       edição de planos
│   ├── forms/                Formulários de cadastro
│   └── *.tsx                 Telas e widgets da dashboard
│
├── lib/                  Lógica, estado e dados
│   ├── *-context.tsx         React Contexts (estado em memória)
│   ├── permissoes.ts         papéis e cálculo de permissões
│   ├── planos.ts             definição dos planos
│   ├── plataforma.ts         dados da plataforma (super-admin)
│   ├── mock-*.ts             dados de exemplo
│   ├── data/                 catálogos (países, cidades BR)
│   └── *.ts                  helpers (whatsapp, stats...)
│
└── types/index.ts        Tipos compartilhados do domínio
```

---

## Conceitos

### Papéis (`lib/permissoes.ts`)

`admin` · `artista` · `vendedor` · `produtor` · `financeiro`.
A função `calcularPermissoes(papel, opts)` devolve o objeto `Permissoes`
que a UI consulta para mostrar/esconder/filtrar.

> A FUNDAÇÃO de permissões está pronta, mas ainda **não está aplicada**
> dentro da dashboard do cliente — esse é o próximo grande passo.

### Planos (`lib/planos.ts`)

5 planos: Individual, Equipe, Agência, Agência Plus, Agência Max.
Cada um com preço mensal e anual, limite de artistas e de usuários.

### Autenticação (`lib/auth-context.tsx`)

Dois tipos de conta: **cliente** (dono de um workspace) e **super-admin**
(administrador da plataforma). O super-admin pode visualizar a dashboard de
qualquer cliente em **modo somente-leitura** (`modoVisitante`).

### Estado

Todo o estado é mantido em memória via React Context — **não há banco de
dados ainda**. Os dados se perdem ao recarregar a página. A estrutura está
desenhada para uma migração futura para **Supabase**.

---

## Próximos passos sugeridos

1. Aplicar as permissões dentro da dashboard (filtrar dados por papel).
2. Tela de gerenciar usuários e configurar permissões (dentro do workspace).
3. Login individual por usuário (hoje só existem 2 contas demo).
4. Integração com Supabase (auth + persistência).
