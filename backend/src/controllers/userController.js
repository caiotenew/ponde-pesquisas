const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

async function listUsers(req, res) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, nome: true, email: true, role: true, ativo: true, createdAt: true }
  });
  return res.json({ users });
}

async function createUser(req, res) {
  try {
    const nome = String(req.body?.nome || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');
    const role = req.body?.role;

    if (!nome || !email || !senha || !['JOVEM', 'GESTAO'].includes(role)) {
      return res.status(400).json({ error: 'Nome, e-mail, senha e perfil são obrigatórios. O admin principal não pode ser criado por aqui.' });
    }
    if (senha.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });

    const senhaHash = await bcrypt.hash(senha, 12);
    const user = await prisma.user.create({
      data: { nome, email, senhaHash, role },
      select: { id: true, nome: true, email: true, role: true, ativo: true, createdAt: true }
    });

    return res.status(201).json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível criar o usuário.' });
  }
}

async function removeUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID inválido.' });
    if (id === req.user.id) return res.status(400).json({ error: 'O administrador atual não pode remover a própria conta.' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (user.role === 'ADMIN') return res.status(400).json({ error: 'O administrador principal não pode ser removido.' });

    const total = await prisma.pesquisa.count({ where: { collectedById: id } });
    if (total > 0) {
      await prisma.user.update({ where: { id }, data: { ativo: false } });
      return res.json({ message: 'Usuário desativado para preservar o histórico das pesquisas.' });
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'Usuário removido com sucesso.' });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível remover o usuário.' });
  }
}

module.exports = { listUsers, createUser, removeUser };
