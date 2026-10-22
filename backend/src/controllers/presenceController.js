const prisma = require('../lib/prisma');
const A = require('../lib/accounts');

function dayBounds(value) {
  const start = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime())) return dayBounds();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Equipe e presença. Gestão enxerga os Jovens; o administrador enxerga Jovens e Gestão.
async function listPresence(req, res) {
  try {
    const roles = req.user.role === 'ADMIN' ? ['JOVEM', 'GESTAO'] : ['JOVEM'];
    const users = await prisma.user.findMany({
      where: { role: { in: roles }, status: 'ATIVO' },
      select: { id: true, nome: true, email: true, role: true, cargo: true, lastSeenAt: true },
      orderBy: { nome: 'asc' }
    });

    const { start, end } = dayBounds(req.query.date);
    const jovemIds = users.filter((u) => u.role === 'JOVEM').map((u) => u.id);
    const counts = new Map();
    if (jovemIds.length) {
      const grouped = await prisma.pesquisa.groupBy({
        by: ['collectedById'],
        where: { collectedById: { in: jovemIds }, data: { gte: start, lt: end } },
        _count: { _all: true }
      });
      grouped.forEach((row) => counts.set(row.collectedById, row._count._all));
    }

    const now = Date.now();
    const people = users.map((u) => ({
      id: u.id, nome: u.nome, email: u.email, role: u.role, cargo: u.cargo || null,
      lastSeenAt: u.lastSeenAt, online: A.isOnline(u.lastSeenAt, now),
      todayCount: u.role === 'JOVEM' ? (counts.get(u.id) || 0) : null
    })).sort((a, b) => Number(b.online) - Number(a.online) || a.nome.localeCompare(b.nome, 'pt-BR'));

    const jovens = people.filter((p) => p.role === 'JOVEM');
    return res.json({
      serverTime: new Date(now).toISOString(),
      windowSeconds: A.ONLINE_WINDOW_MS / 1000,
      people,
      summary: {
        online: people.filter((p) => p.online).length,
        jovensOnline: jovens.filter((p) => p.online).length,
        jovensTotal: jovens.length,
        collectedToday: jovens.reduce((sum, p) => sum + (p.todayCount || 0), 0)
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível carregar a equipe online.' });
  }
}

module.exports = { listPresence };
