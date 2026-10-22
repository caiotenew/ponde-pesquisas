# Backend — Ponde Pesquisas

## Stack
- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT + bcryptjs
- Helmet + CORS

## Configuração local
1. Copie `.env.example` para `.env`.
2. Preencha `DATABASE_URL`, `DIRECT_URL` e `JWT_SECRET`.
3. Execute:

```bash
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm start
```

## Endpoints principais
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/pesquisas/batch`
- `GET /api/pesquisas/today-count?date=YYYY-MM-DD`
- `GET /api/pesquisas/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/pesquisas/dashboard/users?date=YYYY-MM-DD`
- `GET /api/users`
- `POST /api/users`
- `DELETE /api/users/:id`
- `GET /api/health`


### Exportação para Excel
`GET /api/pesquisas/export/csv?from=AAAA-MM-DD&to=AAAA-MM-DD` (ADMIN/GESTAO) retorna um CSV em UTF-8 com BOM e separador `;`.
