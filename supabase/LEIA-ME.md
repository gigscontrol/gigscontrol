# Configuração do banco — flow.book

Guia do **Passo 0 + 1**: deixar o Supabase pronto e o schema criado.

---

## 1. Instalar as dependências novas

No projeto, rode:

```bash
npm install
```

Isso baixa os pacotes do Supabase que foram adicionados ao `package.json`
(`@supabase/supabase-js` e `@supabase/ssr`).

---

## 2. Conferir o arquivo `.env.local`

Na raiz do projeto existe o arquivo `.env.local`. Ele já vem com a URL e a
chave pública preenchidas. **Falta uma coisa:**

Abra o `.env.local` e, na linha `SUPABASE_SECRET_KEY=`, cole a sua chave
secreta (a `secret`/`service_role` que você gerou no Supabase):

```
SUPABASE_SECRET_KEY=sb_secret_sua_chave_aqui
```

> Esse arquivo nunca vai para o Git — sua chave secreta fica só no seu PC.

---

## 3. Criar o schema no Supabase

No Supabase: **seu projeto → SQL Editor → New query**.

Rode os scripts da pasta `supabase/` **nesta ordem**, um de cada vez
(cole o conteúdo, clique em Run, espere terminar, passe pro próximo):

| Ordem | Arquivo               | O que faz                              |
|-------|-----------------------|----------------------------------------|
| 1º    | `01_schema.sql`       | Cria as 13 tabelas e os índices        |
| 2º    | `02_policies.sql`     | Liga o RLS e cria as regras de acesso  |
| 3º    | `03_seed.sql`         | Popula o catálogo de planos            |

Ao final do `03_seed.sql`, o editor mostra uma tabelinha com os 5 planos —
se aparecer, deu tudo certo.

---

## 4. Conferir no painel

No Supabase, vá em **Table Editor**. Você deve ver as 13 tabelas:
`plans`, `workspaces`, `profiles`, `artists`, `cidades`, `contratantes`,
`casas`, `orcamentos`, `vendas`, `parcelas`, `shows`, `subscriptions`,
`activity_logs`.

A tabela `plans` deve ter 5 linhas. As outras estão vazias por enquanto —
isso é normal.

> Se as tabelas aparecerem com um cadeado / aviso de RLS, ótimo: significa
> que a segurança está ligada. Elas só liberam dados quando houver um
> usuário logado — o que vem no Passo 2.

---

## Recomeçar do zero (se precisar)

Se algo der errado e você quiser refazer, rode o `99_reset.sql` (apaga
tudo) e depois repita os passos 1 → 2 → 3.

---

## Pronto. E agora?

Com o schema no ar, o próximo passo é o **Passo 2: autenticação real** —
substituir o login mockado pelo Supabase Auth e criar os workspaces e
usuários de demonstração. Avise quando os 3 scripts tiverem rodado sem erro.

---

# Passo 2 — Autenticação real

Agora o login deixa de ser mockado e passa a usar o **Supabase Auth**.

## 2.1 — Criar os usuários no painel

No Supabase: **Authentication → Users → Add user → Create new user**.

Crie os dois, marcando **"Auto Confirm User"** em cada:

| E-mail                        | Papel                  |
|-------------------------------|------------------------|
| brunorafaelsocek@outlook.com  | Cliente (admin do workspace) |
| gigscontrol26@gmail.com       | Super-admin da plataforma    |

A senha você define na criação — anote, é com ela que vai logar.

## 2.2 — Criar os profiles

No **SQL Editor**, rode o `04_usuarios_demo.sql`.
Ele cria o workspace "TWO DASH", liga cada usuário ao seu papel e cria a
assinatura. Ao final, mostra uma tabela com os 2 profiles — confira se
aparecem os dois (um cliente, um plataforma).

> Os UIDs dentro do `04_usuarios_demo.sql` já estão preenchidos com os
> IDs dos usuários criados. Se você recriar os usuários no painel, os
> UIDs mudam — aí é preciso atualizar o script.

## 2.3 — Testar

Rode o projeto (`npm run dev`) e acesse `/login`:

- `brunorafaelsocek@outlook.com` + senha → cai na dashboard `/app`
- `gigscontrol26@gmail.com` + senha → cai no painel `/admin`

Se entrar, o Passo 2 está concluído. 🎉

---

# ⚠️ ATENÇÃO — divergências a corrigir no Claude Code

Estes scripts foram escritos no início do projeto. O produto evoluiu desde
então. Antes de usar em produção, o Claude Code deve ajustar:

1. **Campo `max_usuarios_equipe`** (em `01_schema.sql` e `03_seed.sql`)
   → renomear para **`max_usuarios_adicionais`**, para bater com o código
   atual (`src/lib/planos.ts`).

2. **Valores dos planos** no `03_seed.sql` estão desatualizados.
   Os valores corretos (ver `src/lib/planos.ts`) são:
   - Individual: 1 artista, 1 adicional
   - Equipe: 3 artistas, 6 adicionais
   - Agência: 10 artistas, 14 adicionais
   - Agência Plus: 25 artistas, 34 adicionais
   - Agência Max: 50 artistas, 74 adicionais

3. **Campos novos a adicionar** nas tabelas:
   - `artists.acesso_suspenso` (boolean) — para a suspensão de acesso
   - `artists.deletado_em` / `profiles.deletado_em` (timestamptz) — lixeira
   - `cidades.latitude` / `cidades.longitude` (numeric) — Mapa de Dobras

Tudo isso está detalhado na seção 10 do `PLANO-BACKEND.md`.
