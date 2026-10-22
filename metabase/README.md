# Metabase

O Metabase deve apontar para o **mesmo PostgreSQL** usado pelo Prisma. Assim, o jovem coleta no site, a API grava no PostgreSQL e o Metabase lê os dados reais.

## Dashboard sugerido
1. Total de pesquisas
2. Satisfação (%)
3. Intenção de indicação (%)
4. Pesquisas por dia
5. Distribuição das avaliações P1-P4
6. Indicações P5
7. Desempenho por jovem
8. Feedbacks por período

Use `queries.sql` como ponto de partida.

No frontend, preencha `frontend/js/config.js` em `METABASE_DASHBOARD_URL` para mostrar um botão que abre o dashboard publicado.
