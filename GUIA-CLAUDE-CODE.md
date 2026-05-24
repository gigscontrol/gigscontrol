# GIGS CONTROL — Guia para fazer o backend no Claude Code

Este guia explica como continuar o projeto — a fase de backend — usando o
**Claude Code**. Você não precisa saber programar; o Claude Code conversa
com você em português e faz o trabalho técnico.

---

## Por que o Claude Code (e não o chat)

O backend precisa ser **escrito, executado e testado** em ciclos: escreve
um pedaço, roda, vê o erro, corrige. O chat do Claude.ai não roda código —
por isso a parte de backend trava lá. O Claude Code roda no seu computador,
dentro do projeto, e faz esse ciclo de verdade.

Resumindo: o desenho do site foi feito no chat (e está pronto). O backend
se faz no Claude Code.

---

## O que você vai precisar

1. **O projeto GIGS CONTROL** na sua máquina (esta pasta).
2. **Node.js** instalado (o projeto já usa — se `npm run dev` funciona, está ok).
3. **Claude Code** instalado. É uma ferramenta de terminal da Anthropic.
   A instalação atual está documentada em: https://docs.claude.com
   (procure por "Claude Code").
4. **A conta do Supabase** — já existe, criada durante o projeto.
5. **A chave secreta do Supabase** — precisa estar no arquivo `.env.local`
   (veja a seção abaixo).

---

## Antes de começar — confira o `.env.local`

Na raiz do projeto há um arquivo `.env.local`. Abra e confirme:

- `NEXT_PUBLIC_SUPABASE_URL` — preenchido
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — preenchido
- `SUPABASE_SECRET_KEY` — **precisa ter a chave secreta real**

Se a linha da chave secreta ainda estiver com um texto placeholder, pegue a
chave em: Supabase → Project Settings → API → secret key, e cole ali.
Essa chave é secreta — nunca compartilhe.

---

## Como conduzir o Claude Code

O segredo é: **uma etapa por vez**, e deixar ele testar antes de seguir.

Quando abrir o Claude Code no projeto, comece com algo assim:

> "Este projeto é o GIGS CONTROL, um SaaS de gestão para agências de DJs.
>  Leia o arquivo PLANO-BACKEND.md — ele tem o plano completo do backend.
>  Quero executar a fase de backend, uma etapa por vez. Vamos começar pela
>  Etapa 2 (autenticação real). Antes de mudar qualquer coisa, me explique
>  o que vai fazer."

Depois, a cada etapa:

- Peça para ele fazer **uma etapa só** (não "faça o backend todo").
- Peça para ele **rodar `npm run dev` e corrigir os erros** antes de dizer
  que terminou.
- Quando ele disser que a etapa está pronta, **teste você mesmo** no
  navegador antes de ir para a próxima.

---

## A ordem das etapas

Está detalhada na seção 10 do `PLANO-BACKEND.md`. Resumo:

1. Conferir o Supabase e o `.env.local`
2. **Auth real** — restaurar o login do Supabase, testar os 2 usuários
3. Shows
4. Contatos (+ coordenadas das cidades, para o Mapa de Dobras)
5. Orçamentos
6. Vendas e parcelas
7. Configurações do workspace (aparência, artistas, equipe)
8. Lixeira de 30 dias
9. Painel do super-admin
10. Permissões por papel
11. Deploy na Vercel

Faça **na ordem**. Cada etapa depende da anterior.

---

## Material que já está pronto no projeto

Você não começa do zero. Já existe:

- **`PLANO-BACKEND.md`** — o plano completo (leia a seção 10).
- **`supabase/`** — todos os scripts SQL. Os 3 primeiros já foram
  executados no banco; o `04_usuarios_demo.sql` cria os usuários de teste.
- **`src/lib/db/`** — os clientes de conexão com o Supabase, prontos.
- **`src/lib/auth-context.supabase.bak`** — a versão do login integrada ao
  Supabase. A Etapa 2 consiste basicamente em restaurar este arquivo.
- **`.env.local`** — as credenciais (confira a chave secreta).

---

## Uma dica importante

Quando o Claude Code for conectar cada entidade ao banco, ele vai precisar
trocar os IDs numéricos (1, 2, 3) por UUID. Isso é esperado e está previsto
no plano. Deixe ele fazer isso **dentro de cada etapa** — não tente fazer
tudo de uma vez. Uma entidade conectada e testada por vez é o caminho
seguro.

---

## Em resumo

O projeto está com todo o front-end desenhado e um plano de backend
detalhado. O Claude Code pega esse material e executa. Vá com calma, uma
etapa por vez, testando cada uma. Boa sorte.
