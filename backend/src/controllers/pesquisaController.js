const prisma = require('../lib/prisma');

const ALLOWED_P = new Set(['MUITO_SATISFEITO', 'SATISFEITO', 'INSATISFEITO', 'MUITO_INSATISFEITO']);
const ALLOWED_P5 = new Set(['COM_CERTEZA', 'SIM', 'NAO', 'DE_JEITO_NENHUM']);
const P1_4 = ['p1', 'p2', 'p3', 'p4'];
const QUESTION_LABELS = {
  p1: 'Recepção',
  p2: 'Equipe de Saúde',
  p3: 'Qualidade dos Serviços',
  p4: 'Satisfação com o Multicentro'
};

function dayStart(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayEnd(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

function score(value) {
  return { MUITO_SATISFEITO: 4, SATISFEITO: 3, INSATISFEITO: 2, MUITO_INSATISFEITO: 1 }[value] || 0;
}

function normalizeSurvey(item) {
  if (!item || typeof item !== 'object') return null;
  const data = dayStart(item.data);
  if (!data) return null;
  const required = [item.p1, item.p2, item.p3, item.p4].every((v) => ALLOWED_P.has(v)) && ALLOWED_P5.has(item.p5);
  if (!required) return null;
  return {
    data,
    nome: item.nome ? String(item.nome).trim().slice(0, 150) : null,
    p1: item.p1,
    p2: item.p2,
    p3: item.p3,
    p4: item.p4,
    p5: item.p5,
    feedback: item.feedback ? String(item.feedback).trim().slice(0, 2000) : null,
    contato: item.contato ? String(item.contato).trim().slice(0, 250) : null
  };
}

function parseRange(query) {
  const from = dayStart(query.from) || dayStart();
  const to = dayStart(query.to) || from;
  if (!from || !to || to < from) return null;
  return { from, to, toExclusive: dayEnd(to) };
}

function optionalYoungId(value) {
  if (value === undefined || value === null || value === '' || value === 'all') return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function makeWhere(range, youngId) {
  const where = { data: { gte: range.from, lt: range.toExclusive } };
  if (youngId) where.collectedById = youngId;
  return where;
}

function aggregateRows(rows) {
  let satisfactionPoints = 0;
  let recommendationPositive = 0;
  let positive = 0;
  let negative = 0;
  let feedbacks = 0;
  let identified = 0;

  const satisfaction = { MUITO_SATISFEITO: 0, SATISFEITO: 0, INSATISFEITO: 0, MUITO_INSATISFEITO: 0 };
  const recommendation = { COM_CERTEZA: 0, SIM: 0, NAO: 0, DE_JEITO_NENHUM: 0 };
  const daily = {};
  const questionScores = Object.fromEntries(P1_4.map((key) => [key, { points: 0, total: 0, positive: 0 }]));
  const activeYoungs = new Set();

  rows.forEach((row) => {
    activeYoungs.add(row.collectedById);
    [row.p1, row.p2, row.p3, row.p4].forEach((answer, index) => {
      const questionKey = P1_4[index];
      const q = questionScores[questionKey];
      const value = score(answer);
      satisfactionPoints += value;
      satisfaction[answer] = (satisfaction[answer] || 0) + 1;
      q.points += value;
      q.total += 1;
      if (answer === 'MUITO_SATISFEITO' || answer === 'SATISFEITO') {
        positive += 1;
        q.positive += 1;
      } else {
        negative += 1;
      }
    });
    if (row.p5 === 'COM_CERTEZA' || row.p5 === 'SIM') recommendationPositive += 1;
    recommendation[row.p5] = (recommendation[row.p5] || 0) + 1;
    if (row.feedback) feedbacks += 1;
    if (row.contato) identified += 1;
    const key = row.data.toISOString().slice(0, 10);
    daily[key] = (daily[key] || 0) + 1;
  });

  const total = rows.length;
  const satisfactionIndex = total ? Number(((satisfactionPoints / (total * 16)) * 100).toFixed(1)) : 0;
  const recommendationIndex = total ? Number(((recommendationPositive / total) * 100).toFixed(1)) : 0;
  const experiencePositive = positive + negative ? Number(((positive / (positive + negative)) * 100).toFixed(1)) : 0;
  const activeDays = Object.keys(daily).length;
  const avgPerDay = activeDays ? Number((total / activeDays).toFixed(1)) : 0;
  const questionPerformance = P1_4.map((key) => ({
    key,
    label: QUESTION_LABELS[key],
    score: questionScores[key].total ? Number(((questionScores[key].points / (questionScores[key].total * 4)) * 100).toFixed(1)) : 0,
    positive: questionScores[key].total ? Number(((questionScores[key].positive / questionScores[key].total) * 100).toFixed(1)) : 0
  }));

  return {
    totalPesquisas: total,
    satisfacao: satisfactionIndex,
    indicaria: recommendationIndex,
    experienciaPositiva: experiencePositive,
    feedbacks,
    identified,
    activeDays,
    avgPerDay,
    activeYoungs: activeYoungs.size,
    satisfaction,
    recommendation,
    daily,
    questionPerformance
  };
}

async function createBatch(req, res) {
  try {
    if (req.user.role !== 'JOVEM') return res.status(403).json({ error: 'Somente usuários Jovem podem enviar pesquisas.' });

    const pesquisas = Array.isArray(req.body) ? req.body : req.body?.pesquisas;
    if (!Array.isArray(pesquisas) || pesquisas.length === 0 || pesquisas.length > 60) {
      return res.status(400).json({ error: 'Envie um lote contendo de 1 a 60 pesquisas.' });
    }

    const normalized = pesquisas.map(normalizeSurvey);
    if (normalized.some((item) => !item)) return res.status(400).json({ error: 'Uma ou mais pesquisas possuem respostas inválidas ou incompletas.' });

    const grouped = normalized.reduce((acc, item) => {
      const key = item.data.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    for (const [dateKey, amount] of Object.entries(grouped)) {
      const start = dayStart(dateKey);
      const end = dayEnd(start);
      const existing = await prisma.pesquisa.count({ where: { collectedById: req.user.id, data: { gte: start, lt: end } } });
      if (existing + amount > 60) return res.status(400).json({ error: `A meta de 60 pesquisas já seria ultrapassada na data ${dateKey}.` });
    }

    await prisma.pesquisa.createMany({ data: normalized.map((item) => ({ ...item, collectedById: req.user.id })) });

    const dateCounts = {};
    for (const dateKey of Object.keys(grouped)) {
      const start = dayStart(dateKey);
      dateCounts[dateKey] = await prisma.pesquisa.count({ where: { collectedById: req.user.id, data: { gte: start, lt: dayEnd(start) } } });
    }

    return res.status(201).json({ message: 'Pesquisas salvas com sucesso.', saved: normalized.length, dateCounts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível salvar o lote de pesquisas.' });
  }
}

async function todayCount(req, res) {
  const selected = dayStart(req.query.date);
  if (!selected) return res.status(400).json({ error: 'Data inválida.' });
  const count = await prisma.pesquisa.count({ where: { collectedById: req.user.id, data: { gte: selected, lt: dayEnd(selected) } } });
  return res.json({ count, date: selected.toISOString().slice(0, 10) });
}

async function listYoungs(req, res) {
  try {
    const youngs = await prisma.user.findMany({
      where: { role: 'JOVEM' },
      select: { id: true, nome: true, email: true, ativo: true },
      orderBy: { nome: 'asc' }
    });
    return res.json({ youngs });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível carregar os jovens.' });
  }
}

async function dashboardSummary(req, res) {
  try {
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ error: 'Período inválido.' });
    const youngId = optionalYoungId(req.query.youngId);
    const where = makeWhere(range, youngId);
    const rows = await prisma.pesquisa.findMany({
      where,
      select: { p1: true, p2: true, p3: true, p4: true, p5: true, feedback: true, contato: true, collectedById: true, data: true, createdAt: true }
    });

    const current = aggregateRows(rows);
    const periodDays = Math.max(1, Math.round((range.to - range.from) / 86400000) + 1);

    // Comparativo com período anterior de mesma duração.
    const previousTo = new Date(range.from);
    previousTo.setDate(previousTo.getDate() - 1);
    const previousFrom = new Date(previousTo);
    previousFrom.setDate(previousFrom.getDate() - (periodDays - 1));
    const previousRows = await prisma.pesquisa.findMany({
      where: { ...makeWhere({ from: previousFrom, to: previousTo, toExclusive: dayEnd(previousTo) }, youngId) },
      select: { p1: true, p2: true, p3: true, p4: true, p5: true, feedback: true, contato: true, collectedById: true, data: true }
    });
    const previous = aggregateRows(previousRows);

    const feedbackRows = rows
      .filter((row) => row.feedback)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((row) => ({ date: row.data.toISOString().slice(0, 10), feedback: row.feedback }));

    const daysForGoal = periodDays;
    const expectedDailyCount = 60;
    const expectedTotal = expectedDailyCount * daysForGoal;
    const collectionRate = expectedTotal ? Number(((current.totalPesquisas / expectedTotal) * 100).toFixed(1)) : 0;

    return res.json({
      ...current,
      periodDays,
      expectedTotal,
      collectionRate,
      previous: {
        totalPesquisas: previous.totalPesquisas,
        satisfacao: previous.satisfacao,
        indicaria: previous.indicaria,
        feedbacks: previous.feedbacks,
        avgPerDay: previous.avgPerDay
      },
      recentFeedbacks: feedbackRows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível carregar os indicadores.' });
  }
}

async function dashboardUsers(req, res) {
  try {
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ error: 'Período inválido.' });
    const selectedId = optionalYoungId(req.query.youngId);
    const users = await prisma.user.findMany({
      where: { role: 'JOVEM', ...(selectedId ? { id: selectedId } : {}) },
      select: { id: true, nome: true, email: true, ativo: true },
      orderBy: { nome: 'asc' }
    });
    const rows = await prisma.pesquisa.findMany({
      where: makeWhere(range, selectedId),
      select: { collectedById: true, data: true, p1: true, p2: true, p3: true, p4: true, p5: true, feedback: true }
    });
    const map = new Map();
    users.forEach((user) => map.set(user.id, []));
    rows.forEach((row) => { if (!map.has(row.collectedById)) map.set(row.collectedById, []); map.get(row.collectedById).push(row); });

    const usersData = users.map((user) => {
      const userRows = map.get(user.id) || [];
      const summary = aggregateRows(userRows);
      return {
        ...user,
        count: summary.totalPesquisas,
        avgPerDay: summary.avgPerDay,
        percentDailyGoal: Math.min(100, Math.round((summary.avgPerDay / 60) * 100)),
        satisfacao: summary.satisfacao,
        indicaria: summary.indicaria,
        feedbacks: summary.feedbacks,
        activeDays: summary.activeDays
      };
    });

    return res.json({ users: usersData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível carregar o desempenho dos jovens.' });
  }
}

const CSV_HEADERS = [
  'ID', 'Data', 'Nome', 'P1 - Recepção', 'P2 - Equipe de Saúde',
  'P3 - Qualidade dos Serviços', 'P4 - Satisfação com o Multicentro',
  'P5 - Indicaria', 'Elogio / Reclamação / Sugestão', 'Contato',
  'Coletado por', 'E-mail do coletor', 'Criado em'
];

const ANSWER_LABELS = {
  MUITO_SATISFEITO: 'Muito Satisfeito', SATISFEITO: 'Satisfeito', INSATISFEITO: 'Insatisfeito', MUITO_INSATISFEITO: 'Muito Insatisfeito',
  COM_CERTEZA: 'Com Certeza', SIM: 'Sim', NAO: 'Não', DE_JEITO_NENHUM: 'De jeito Nenhum'
};

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDatePt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', dateStyle: 'short' }).format(date);
}

function formatDateTimePt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia', dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

async function listMine(req, res) {
  try {
    if (req.user.role !== 'JOVEM') return res.status(403).json({ error: 'Somente usuários Jovem podem consultar suas próprias pesquisas.' });
    const range = parseRange(req.query);
    if (!range) return res.status(400).json({ error: 'Período inválido.' });

    const rows = await prisma.pesquisa.findMany({
      where: { ...makeWhere(range, req.user.id) },
      select: {
        id: true,
        data: true,
        nome: true,
        p1: true,
        p2: true,
        p3: true,
        p4: true,
        p5: true,
        feedback: true,
        contato: true,
        createdAt: true
      },
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
      take: 1000
    });

    return res.json({
      total: rows.length,
      limit: 1000,
      truncated: rows.length >= 1000,
      synced: true,
      pesquisas: rows
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível carregar suas pesquisas do banco.' });
  }
}

async function exportCsv(req, res) {
  try {
    const fallbackFrom = new Date();
    fallbackFrom.setDate(1);
    const from = dayStart(req.query.from) || dayStart(fallbackFrom.toISOString().slice(0, 10));
    const to = dayStart(req.query.to) || dayStart();
    if (!from || !to || to < from) return res.status(400).json({ error: 'O período informado é inválido.' });
    const youngId = req.user.role === 'JOVEM' ? req.user.id : optionalYoungId(req.query.youngId);

    const rows = await prisma.pesquisa.findMany({
      where: { ...makeWhere({ from, to, toExclusive: dayEnd(to) }, youngId) },
      include: { collectedBy: { select: { nome: true, email: true } } },
      orderBy: [{ data: 'asc' }, { id: 'asc' }]
    });

    const lines = [CSV_HEADERS.map(csvEscape).join(';')];
    for (const row of rows) {
      lines.push([
        row.id,
        formatDatePt(row.data),
        row.nome || '',
        ANSWER_LABELS[row.p1] || row.p1,
        ANSWER_LABELS[row.p2] || row.p2,
        ANSWER_LABELS[row.p3] || row.p3,
        ANSWER_LABELS[row.p4] || row.p4,
        ANSWER_LABELS[row.p5] || row.p5,
        row.feedback || '',
        row.contato || '',
        row.collectedBy?.nome || '',
        row.collectedBy?.email || '',
        formatDateTimePt(row.createdAt)
      ].map(csvEscape).join(';'));
    }

    const csv = `\uFEFF${lines.join('\r\n')}`;
    const fromLabel = from.toISOString().slice(0, 10);
    const toLabel = to.toISOString().slice(0, 10);
    const suffix = youngId ? `_jovem_${youngId}` : '';
    const ownerSuffix = req.user.role === 'JOVEM' ? '_minhas_pesquisas' : '';
    const filename = `pesquisas_multicentro_${fromLabel}_a_${toLabel}${ownerSuffix || suffix}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(csv);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível gerar o arquivo CSV.' });
  }
}

module.exports = { createBatch, todayCount, listYoungs, dashboardSummary, dashboardUsers, listMine, exportCsv };
