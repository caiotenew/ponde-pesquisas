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

## Contas, perfis e permissões

| Perfil | Como entra | O que pode fazer |
|---|---|---|
| **Administrador** (único) | Conta `damascenocaio311@gmail.com`, criada no deploy pelo seed (senha inicial `1234`) ou pela tela **Criar conta** | Tudo: gerencia usuários, aprova acessos, redefine senhas, vê dashboards, exporta dados e acompanha quem está online |
| **Gestão** | Cria conta e **aguarda aprovação** do administrador | Dashboards, **Jovens online**, exportação de pesquisas |
| **Jovem Aprendiz** | Cria conta e entra na hora | **Somente** coletar pesquisas e ver/baixar as próprias |

Regras importantes:

- Só existe **um** administrador. Ninguém vira ADMIN pela interface ou pela API.
- **Esqueci minha senha**: o pedido aparece para o administrador (selo "senha?"), que gera uma **senha temporária**; o usuário é obrigado a trocá-la no próximo acesso.
- Trocar a senha ou ter a senha redefinida **encerra as sessões antigas** daquele usuário.
- Se o **administrador** esquecer a própria senha: `cd backend` e `npm run admin:reset -- "NovaSenha"` (usa o `.env` / banco configurado).
- O seed **não sobrescreve** a senha escolhida pelo administrador nos próximos deploys (só com `ADMIN_RESET_PASSWORD=true`).
- Há limite de tentativas de login/cadastro por IP para dificultar adivinhação de senhas.

> **Segurança:** a senha inicial `1234` é fraca e o e-mail do administrador aparece neste repositório. O sistema avisa e abre a tela de troca no primeiro login — **altere logo após o primeiro acesso em produção**, ou defina `ADMIN_PASSWORD` com outra senha no Render antes do primeiro deploy.

## Subir localmente

### 1. Criar banco PostgreSQL
Crie um banco chamado `ponde_pesquisas`.

### 2. Configurar backend

```bash
cd backend
copy .env.example .env
```

Preencha `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` e `ALLOWED_ORIGINS`. O administrador é criado pelo seed (`ADMIN_EMAIL`, `ADMIN_PASSWORD`; se vazio, a senha inicial é `1234`).

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

Na pasta `frontend` use o Live Server do VS Code (porta 5500) ou:

```bash
python -m http.server 5500
```

Não precisa configurar nada: ao abrir em `localhost`/`127.0.0.1`, o frontend usa a API em `http://localhost:3000` automaticamente.

## Publicar no GitHub Pages + Render

1. Crie um repositório no GitHub e envie esta pasta.
2. No Render, crie um Web Service apontando para a pasta `backend`.
3. Build: `npm install && npx prisma generate && npx prisma db push && npx prisma db seed`.
4. Start: `npm start`.
5. Configure as variáveis de ambiente do backend.
6. Anote a URL pública do Render, por exemplo `https://ponde-pesquisas-api.onrender.com`.
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
- Rotas de usuários protegidas para ADMIN; "Jovens online" e dashboard para ADMIN/GESTAO.
- Perfil e situação da conta são relidos do banco a cada requisição (desativar/rebaixar vale na hora).
- Rota de envio protegida para JOVEM.
- CORS controlado por `ALLOWED_ORIGINS`.
- `.env` ignorado pelo Git.


## Exportação CSV
Gestão e Administração possuem a opção **Baixar Pesquisas** no menu lateral. O sistema gera um CSV em UTF-8 com separador `;`, adequado para abrir no Excel, com filtro por período.

## Backup do Jovem Aprendiz

A versão atual inclui **Minhas Pesquisas** para o perfil Jovem. Cada pesquisa salva é arquivada localmente no navegador via IndexedDB e continua disponível para exportação mesmo quando o PostgreSQL/API fica temporariamente indisponível.

O botão de exportação tenta primeiro o banco; se não houver resposta, o sistema baixa automaticamente a cópia local. Há também exportação de período e de apenas itens pendentes de sincronização.

> A cópia local é uma camada de contingência. Para proteção institucional, mantenha também uma política de backup do PostgreSQL/Supabase e o download periódico dos CSVs.
