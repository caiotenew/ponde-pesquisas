# Release — Gestão Avançada v5

Esta versão amplia o módulo de Gestão para uso operacional diário, mantendo o visual do projeto.

## Novidades de Gestão

- Filtro global por período e por Jovem Aprendiz.
- Filtros rápidos: Hoje, 7 dias, Este mês e Mês anterior.
- Ação "Filtrar" por jovem diretamente na tabela de desempenho.
- Comparação automática com o período anterior de mesma duração.
- KPIs adicionais: média de pesquisas por dia e jovens com coleta.
- Indicador de ritmo da coleta com referência visual de 60 pesquisas por dia.
- Linha de meta diária (60) no gráfico de evolução.
- Gráfico de distribuição das avaliações.
- Gráfico de intenção de indicação.
- Gráfico de desempenho por pergunta (positivo %).
- Gráfico de média diária de pesquisas por jovem.
- Tabela operacional por jovem com volume, média/dia, satisfação, indicação e feedbacks.
- Leituras rápidas descritivas para apoiar o acompanhamento.
- Feedbacks recentes exibidos diretamente no dashboard.
- Exportação CSV respeitando período e Jovem selecionado.
- Endpoint protegido `GET /api/pesquisas/dashboard/youngs` para alimentar os filtros.
- Endpoints de dashboard e exportação aceitam `youngId`.

## Compatibilidade

- Frontend: HTML + CSS + Vanilla JS + Chart.js.
- Backend: Node.js + Express + Prisma.
- Banco: PostgreSQL.
- Exportação: CSV UTF-8 com separador `;` para Excel/Planilhas.

## V6 — Backup operacional do Jovem Aprendiz

Foi adicionada a área **Minhas Pesquisas** para o perfil Jovem Aprendiz.

- Cada pesquisa salva ganha uma cópia automática no IndexedDB do navegador.
- O CSV das próprias pesquisas tenta primeiro a fonte PostgreSQL/API.
- Se a API ou o banco estiverem indisponíveis, o sistema faz fallback automático para a cópia local.
- O jovem pode baixar o dia, um período ou somente pesquisas ainda pendentes de sincronização.
- Pesquisas pendentes permanecem no localStorage e no IndexedDB até o envio ser confirmado.
- O perfil Jovem só consegue exportar as próprias pesquisas; Gestão/Admin continuam com a exportação ampla.
- O painel mostra quantas cópias locais existem, quantas aguardam sincronização e quantas estão no banco.
- O botão “Tentar sincronizar novamente” aparece quando a meta foi atingida mas o lote ainda não chegou ao banco.

A cópia local é uma contingência operacional e não substitui uma política de backup do PostgreSQL. Limpar os dados do navegador pode remover a cópia local; por isso o fluxo recomenda baixar o CSV diariamente.
