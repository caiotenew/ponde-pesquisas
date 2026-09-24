const prisma = require('../lib/prisma');
const { verifyToken } = require('../lib/auth');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user || !user.ativo) return res.status(401).json({ error: 'Sessão inválida ou usuário inativo.' });

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    next();
  };
}

module.exports = { auth, requireRole };
