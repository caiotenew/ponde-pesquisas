-- Consultas base para o Metabase.
-- Conecte o Metabase ao mesmo PostgreSQL usado pelo Prisma.

-- 1. Total de pesquisas
SELECT COUNT(*) AS total_pesquisas FROM "Pesquisa";

-- 2. Satisfação média (%) considerando P1 a P4
SELECT ROUND(
  AVG((
    (CASE p1 WHEN 'MUITO_SATISFEITO' THEN 4 WHEN 'SATISFEITO' THEN 3 WHEN 'INSATISFEITO' THEN 2 ELSE 1 END) +
    (CASE p2 WHEN 'MUITO_SATISFEITO' THEN 4 WHEN 'SATISFEITO' THEN 3 WHEN 'INSATISFEITO' THEN 2 ELSE 1 END) +
    (CASE p3 WHEN 'MUITO_SATISFEITO' THEN 4 WHEN 'SATISFEITO' THEN 3 WHEN 'INSATISFEITO' THEN 2 ELSE 1 END) +
    (CASE p4 WHEN 'MUITO_SATISFEITO' THEN 4 WHEN 'SATISFEITO' THEN 3 WHEN 'INSATISFEITO' THEN 2 ELSE 1 END)
  ) / 16.0 * 100
)::numeric, 1) AS satisfacao_percentual
FROM "Pesquisa";

-- 3. Pesquisas por dia
SELECT DATE("data") AS data, COUNT(*) AS pesquisas
FROM "Pesquisa"
GROUP BY DATE("data")
ORDER BY data;

-- 4. Distribuição das respostas (P1-P4)
SELECT resposta, COUNT(*) AS quantidade
FROM (
  SELECT p1 AS resposta FROM "Pesquisa"
  UNION ALL SELECT p2 FROM "Pesquisa"
  UNION ALL SELECT p3 FROM "Pesquisa"
  UNION ALL SELECT p4 FROM "Pesquisa"
) x
GROUP BY resposta
ORDER BY quantidade DESC;

-- 5. Intenção de indicação
SELECT p5 AS resposta, COUNT(*) AS quantidade
FROM "Pesquisa"
GROUP BY p5
ORDER BY quantidade DESC;

-- 6. Desempenho por jovem no dia atual
SELECT u.nome, COUNT(p.id) AS pesquisas
FROM "User" u
LEFT JOIN "Pesquisa" p ON p."collectedById" = u.id AND DATE(p.data) = CURRENT_DATE
WHERE u.role = 'JOVEM'
GROUP BY u.id, u.nome
ORDER BY pesquisas DESC;

-- 7. Feedbacks registrados
SELECT DATE("data") AS data, COUNT(*) AS feedbacks
FROM "Pesquisa"
WHERE feedback IS NOT NULL AND TRIM(feedback) <> ''
GROUP BY DATE("data")
ORDER BY data;
