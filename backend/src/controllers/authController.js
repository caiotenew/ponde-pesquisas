const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken } = require('../lib/auth');

async function login(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });

    const token = signToken(user);
    return res.status(200).json({
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível realizar o login.' });
  }
}

async function me(req, res) {
  return res.json({
    user: {
      id: req.user.id,
      nome: req.user.nome,
      email: req.user.email,
      role: req.user.role
    }
  });
}

module.exports = { login, me };
