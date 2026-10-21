# Guia rápido — VS Code → GitHub → Publicação

Todos os comandos abaixo são para o **terminal do VS Code** (PowerShell), com a pasta do projeto aberta
(`Arquivo > Abrir Pasta…` e depois `Ctrl + '` para abrir o terminal).

## 1) Subir para o GitHub

1. No GitHub, clique em **New repository**. Dê um nome (ex.: `ponde-pesquisas`), deixe **vazio**
   (sem README, sem .gitignore) e clique em **Create repository**.
2. No terminal do VS Code, dentro da pasta do projeto:

```powershell
git init
git add .
git commit -m "Ponde Pesquisas - versão inicial com identidade Provida"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/ponde-pesquisas.git
git push -u origin main
```

> Se o Git pedir seu nome/e-mail na primeira vez:
> `git config --global user.name "Seu Nome"` e `git config --global user.email "seu@email.com"`.

O arquivo `.env` (com senhas) **não sobe** para o GitHub: ele já está no `.gitignore`.

## 2) Testar no seu computador (opcional, antes de publicar)

```powershell
cd backend
copy .env.example .env
# edite o backend\.env com DATABASE_URL, DIRECT_URL, JWT_SECRET, ALLOWED_ORIGINS e ADMIN_SETUP_KEY
npm install
npx prisma generate
npx prisma db push
npm start
```

Em outro terminal, abra `frontend/index.html` com o **Live Server** (porta 5500).
O frontend já usa `http://localhost:3000` sozinho quando está em localhost.
Teste a API em: http://localhost:3000/api/health

## 3) Publicar o backend (Render)

1. No Render: **New > Web Service** > escolha o repositório. O arquivo `render.yaml` já traz os comandos.
2. Em **Environment**, cadastre:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL (Supabase) |
| `DIRECT_URL` | URL direta do PostgreSQL |
| `JWT_SECRET` | texto longo e aleatório |
| `ADMIN_SETUP_KEY` | chave privada usada uma única vez para criar o primeiro administrador |
| `ALLOWED_ORIGINS` | `https://SEU_USUARIO.github.io` (somente o domínio, **sem** `/ponde-pesquisas` no final) |

3. Quando terminar, abra `https://SEU-BACKEND.onrender.com/api/health`. Deve responder `"status":"ok"`.

## 4) Publicar o frontend (GitHub Pages)

1. Edite **uma única linha** em `frontend/js/config.js`:

```js
var PRODUCTION_API_URL = 'https://SEU-BACKEND.onrender.com';
```

2. Envie a alteração:

```powershell
git add .
git commit -m "Configura URL da API"
git push
```

3. No GitHub: **Settings > Pages > Source: GitHub Actions**. O workflow `.github/workflows/pages.yml`
   publica a pasta `frontend` a cada `git push` na branch `main`.
4. O site ficará em `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

## Trocar a fonte do sistema

A fonte fica em um único lugar: a variável `--font-provida` no topo de `frontend/css/style.css`
(e o `<link>` do Google Fonts no `<head>` de `frontend/index.html`).


**Primeiro acesso:** antes de publicar, gere uma chave com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e configure o valor em `ADMIN_SETUP_KEY` no backend (e também nas variáveis de ambiente do Render). O administrador inicial será `damascenocaio311@gmail.com`, com senha temporária `1234`; a troca é obrigatória. Não compartilhe a chave nem a envie para o GitHub.
