const prisma = require('../lib/prisma');
const { verifyToken } = require('../lib/auth');

const SEEN_THROTTLE_MS = 30 * 1000;

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Não autenticado.' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user || user.status !== 'ATIVO' || !user.ativo) {
      return res.status(401).json({ error: 'Sessão inválida ou conta sem acesso.' });
    }

    // Tokens emitidos antes da última troca/redefinição de senha deixam de valer.
    if (user.passwordChangedAt && payload.iat && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return res.status(401).json({ error: 'Sua senha foi alterada. Entre novamente.' });
    }

    // Marca presença (usado em "Jovens online"), no máximo uma vez a cada 30s por usuário.
    const now = Date.now();
    if (!user.lastSeenAt || now - new Date(user.lastSeenAt).getTime() > SEEN_THROTTLE_MS) {
      prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
    }

    req.user = user;
    return next();
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
