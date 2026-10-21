# Ponde Pesquisas — Instituto Provida

> Passo a passo pronto para VS Code + GitHub: veja **[GUIA_GITHUB.md](GUIA_GITHUB.md)**.


Sistema de pesquisa de satisfação para o Multicentro Adriano Pondé.

## Arquitetura final

```text
GitHub Pages (frontend)
        |
        v
Node.js + Express (Render)
        |
        v
Prisma ORM
        |
        v
PostgreSQL (Supabase)
        |
        +--> Metabase (opcional para BI)
```

### Stack
- Frontend: HTML + Tailwind CDN + CSS + Vanilla JS
- Gráficos: Chart.js
- Backend: Node.js + Express 5
- ORM: Prisma
- Banco: PostgreSQL
- Autenticação: JWT + bcryptjs
- Hospedagem sugerida: GitHub Pages + Render + Supabase

## Acesso administrativo

O acesso administrativo é criado pelo processo seguro de inicialização do backend. A conta de administrador não pode ser removida pela própria interface; ela é reservada para manutenção do sistema.

## Subir localmente

### 1. Criar banco PostgreSQL
Crie um banco chamado `ponde_pesquisas`.

### 2. Configurar backend

```bash
cd backend
copy .env.example .env
```

Preencha `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` e `ALLOWED_ORIGINS`. A primeira conta é criada pela tela inicial do portal. Defina `ADMIN_SETUP_KEY` como uma chave aleatória e privada no backend antes da configuração inicial. A conta criada será `damascenocaio311@gmail.com`, com senha temporária `1234`, e o sistema obrigará a troca dessa senha antes de liberar o restante do portal.

Depois:

```bash
npm install
npx prisma generate
npx prisma db push
npm start
```

Se esse banco já tiver usuários de uma instalação anterior e você precisar preparar/resetar especificamente a conta administradora, execute **manualmente** `npm run admin:reset` dentro de `backend`. Isso define a senha temporária `1234` para `damascenocaio311@gmail.com` e exige a troca no próximo login, sem apagar pesquisas ou outros usuários. Não é um comando de rotina.


A API ficará em `http://localhost:3000`.

### 3. Servir o frontend localmente

Na pasta `frontend` use o Live Server do VS Code (porta 5500) ou:

```bash
python -m http.server 5500
```

Não precisa configurar nada: ao abrir em `localhost`/`127.0.0.1`, o frontend usa a API em `http://localhost:3000` automaticamente.

## Publicar no GitHub Pages + Render

1. Crie um repositório no GitHub e envie esta pasta.
2. No Render, crie um Web Service apontando para a pasta `backend`.
3. Build: `npm install && npx prisma generate && npx prisma db push`. Não execute o seed automaticamente em cada publicação.
4. Start: `npm start`.
5. Configure as variáveis de ambiente do backend.
6. Configure no Render as variáveis `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` e `ADMIN_SETUP_KEY`. Gere uma chave com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; nunca publique essa chave no GitHub. Anote a URL pública do Render, por exemplo `https://ponde-pesquisas-api.onrender.com`.
7. Edite **uma única linha** em `frontend/js/config.js` (`PRODUCTION_API_URL`) com a URL pública do backend.
8. No GitHub, Settings → Pages → Source: GitHub Actions.
9. Faça push na branch `main`. O workflow `.github/workflows/pages.yml` publicará a pasta `frontend`.
10. No backend, coloque no `ALLOWED_ORIGINS` o endereço do seu GitHub Pages.

## Metabase

Conecte o Metabase ao mesmo PostgreSQL e use `metabase/queries.sql` para criar os cartões. Depois copie a URL pública do dashboard para `frontend/js/config.js`.

## Fluxo da coleta

- Meta diária: 60 pesquisas.
- As respostas obrigatórias P1 a P5 são validadas no frontend.
- O lote fica temporariamente no `localStorage`.
- Em `Enviar Pesquisas`, um modal pede confirmação.
- Em 60/60, o envio é disparado automaticamente.
- O backend recebe de 1 a 60 registros e retorna HTTP 201 em caso de sucesso.
- Depois do 201, o lote pendente é removido do `localStorage`.

## Segurança

- JWT com expiração de 8 horas.
- Senhas com bcrypt.
- Rotas de usuários protegidas para ADMIN; a presença online é visível para ADMIN/GESTAO.
- Cadastro público cria apenas perfil JOVEM; perfil GESTAO é criado pelo ADMIN.
- Criação inicial do ADMIN protegida por chave privada e limitada ao primeiro usuário.
- Senha temporária do administrador e senhas redefinidas por um gestor exigem troca antes de usar o restante do sistema.
- Rotas de dashboard protegidas para ADMIN/GESTAO.
- Rota de envio protegida para JOVEM.
- CORS controlado por `ALLOWED_ORIGINS`.
- `.env` ignorado pelo Git.


## Exportação CSV
Gestão e Administração possuem a opção **Baixar Pesquisas** no menu lateral. O sistema gera um CSV em UTF-8 com separador `;`, adequado para abrir no Excel, com filtro por período.

## Backup do Jovem Aprendiz

A versão atual inclui **Minhas Pesquisas** para o perfil Jovem. Cada pesquisa salva é arquivada localmente no navegador via IndexedDB e continua disponível para exportação mesmo quando o PostgreSQL/API fica temporariamente indisponível.

O botão de exportação tenta primeiro o banco; se não houver resposta, o sistema baixa automaticamente a cópia local. Há também exportação de período e de apenas itens pendentes de sincronização.

> A cópia local é uma camada de contingência. Para proteção institucional, mantenha também uma política de backup do PostgreSQL/Supabase e o download periódico dos CSVs.


### Como funciona o acesso

- **Primeiro acesso:** a primeira conta deve ser a administradora, `damascenocaio311@gmail.com`, protegida pela chave privada `ADMIN_SETUP_KEY`. A senha temporária é `1234` e a troca é obrigatória no primeiro acesso.
- **Jovem Aprendiz:** pode criar a própria conta no cadastro público e tem acesso apenas às pesquisas e ao histórico próprio.
- **Gestão:** não se cadastra publicamente. O ADMIN cria a conta em **Gerenciar Usuários**, define uma senha temporária e entrega as credenciais em particular. No primeiro login, a senha deve ser trocada. Não há envio automático de convites por e-mail.
- **ADMIN:** pode criar contas de Gestão/Jovem, alterar perfis, ativar/desativar acessos, redefinir senhas e remover usuários, preservando o histórico de pesquisas.
