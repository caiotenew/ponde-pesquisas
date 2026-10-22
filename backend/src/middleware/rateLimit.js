// Limitador simples em memória (sem dependências). Suficiente para uma instância única no Render.
function createLimiter({ windowMs, max, key, message }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  if (timer.unref) timer.unref();

  return function limiter(req, res, next) {
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    return next();
  };
}

const ip = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
const emailOf = (req) => String((req.body && req.body.email) || '').trim().toLowerCase();

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, max: 10,
  key: (req) => `login:${ip(req)}:${emailOf(req)}`,
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
});
const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, max: 15, key: (req) => `register:${ip(req)}`,
  message: 'Muitas tentativas de cadastro. Tente novamente mais tarde.'
});
const forgotLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, max: 8, key: (req) => `forgot:${ip(req)}`,
  message: 'Muitas solicitações. Tente novamente mais tarde.'
});
const passwordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, max: 10, key: (req) => `pwd:${ip(req)}:${(req.user && req.user.id) || ''}`,
  message: 'Muitas tentativas. Aguarde alguns minutos.'
});

module.exports = { createLimiter, loginLimiter, registerLimiter, forgotLimiter, passwordLimiter };
