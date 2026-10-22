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

## Primeiro acesso como administrador

1. Depois do deploy (ou do `npx prisma db seed` local), abra o site e entre com
   **e-mail** `damascenocaio311@gmail.com` e **senha** `1234`.
2. O sistema abre a tela **Alterar senha**. Troque a senha agora (a senha `1234` é fraca e este e-mail está público no repositório).
3. Em **Gerenciar Usuários** você aprova pedidos de Gestão, redefine senhas, desativa ou remove contas.
4. Em **Jovens online** você vê quem está conectado e quanto cada jovem coletou hoje.

Esqueceu a senha do administrador? No terminal, dentro de `backend`:

```powershell
npm run admin:reset -- "NovaSenha123"
```

## 2) Testar no seu computador (opcional, antes de publicar)

```powershell
cd backend
copy .env.example .env
# edite o backend\.env com DATABASE_URL, DIRECT_URL, JWT_SECRET e ADMIN_PASSWORD
npm install
npx prisma generate
npx prisma db push      # cria/atualiza as tabelas (inclui as novas colunas de conta)
npx prisma db seed      # cria o administrador damascenocaio311@gmail.com
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
| `ADMIN_EMAIL` | e-mail do administrador |
| `ADMIN_PASSWORD` | senha inicial do administrador (se vazio, usa `1234`) |
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
