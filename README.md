# Ponde Pesquisas — Projeto Final

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

Preencha `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` e `ALLOWED_ORIGINS`. A conta administrativa é criada pelo seed usando as credenciais definidas no ambiente seguro do backend.

Depois:

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm start
```

A API ficará em `http://localhost:3000`.

### 3. Servir o frontend localmente

Na pasta `frontend` use o Live Server do VS Code ou:

```bash
python -m http.server 5500
```

Antes de abrir, ajuste `frontend/js/config.js`:

```js
window.APP_CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
  METABASE_DASHBOARD_URL: ''
};
```

## Publicar no GitHub Pages + Render

1. Crie um repositório no GitHub e envie esta pasta.
2. No Render, crie um Web Service apontando para a pasta `backend`.
3. Build: `npm install && npx prisma generate && npx prisma db push && npx prisma db seed`.
4. Start: `npm start`.
5. Configure as variáveis de ambiente do backend.
6. Anote a URL pública do Render, por exemplo `https://ponde-pesquisas-api.onrender.com`.
7. Edite `frontend/js/config.js` para usar a URL pública do backend.
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
- Rotas de usuários protegidas para ADMIN.
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
