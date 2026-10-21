const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const USER_SELECT = { id: true, nome: true, email: true, role: true, ativo: true, createdAt: true, lastSeenAt: true, mustChangePassword: true };

async function listUsers(req, res) {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: USER_SELECT });
  return res.json({ users });
}

async function listOnlineYoungs(req, res) {
  const cutoff = new Date(Date.now() - 90 * 1000);
  const users = await prisma.user.findMany({
    where: { role: 'JOVEM', ativo: true, lastSeenAt: { gte: cutoff } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, nome: true, lastSeenAt: true }
  });
  return res.json({ users, count: users.length, checkedAt: new Date().toISOString() });
}

async function createUser(req, res) {
  try {
    const nome = String(req.body?.nome || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');
    const role = req.body?.role;

    if (nome.length < 2 || nome.length > 120 || !email || !senha || !['JOVEM', 'GESTAO'].includes(role)) {
      return res.status(400).json({ error: 'Nome, e-mail, senha e perfil válido são obrigatórios. O administrador principal não pode ser criado por aqui.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (senha.length < 8 || senha.length > 72) return res.status(400).json({ error: 'A senha precisa ter entre 8 e 72 caracteres.' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });

    const senhaHash = await bcrypt.hash(senha, 12);
    const user = await prisma.user.create({
      data: { nome, email, senhaHash, role, ativo: true, mustChangePassword: true },
      select: USER_SELECT
    });
    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    return res.status(500).json({ error: 'Não foi possível criar o usuário.' });
  }
}

async function updateUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido.' });
    if (id === req.user.id) return res.status(400).json({ error: 'Use Minha Conta para alterar suas próprias credenciais.' });
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (target.role === 'ADMIN') return res.status(400).json({ error: 'A conta administradora principal é protegida.' });

    const data = {};
    if (typeof req.body?.ativo === 'boolean') data.ativo = req.body.ativo;
    if (req.body?.role !== undefined) {
      if (!['JOVEM', 'GESTAO'].includes(req.body.role)) return res.status(400).json({ error: 'O perfil deve ser Jovem Aprendiz ou Gestão.' });
      data.role = req.body.role;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nenhuma alteração válida foi informada.' });
    if (data.ativo === false) data.lastSeenAt = null;
    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
    return res.json({ user, message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível atualizar o usuário.' });
  }
}

async function resetUserPassword(req, res) {
  try {
    const id = Number(req.params.id);
    const senha = String(req.body?.novaSenha || '');
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido.' });
    if (id === req.user.id) return res.status(400).json({ error: 'Use Minha Conta para alterar sua própria senha.' });
    if (senha.length < 8 || senha.length > 72) return res.status(400).json({ error: 'A senha temporária deve ter entre 8 e 72 caracteres.' });
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (target.role === 'ADMIN') return res.status(400).json({ error: 'A senha do administrador deve ser alterada na própria conta.' });
    const senhaHash = await bcrypt.hash(senha, 12);
    await prisma.user.update({ where: { id }, data: { senhaHash, mustChangePassword: true, lastSeenAt: null } });
    return res.json({ message: `Senha redefinida para ${target.nome}.` });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível redefinir a senha.' });
  }
}

async function removeUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido.' });
    if (id === req.user.id) return res.status(400).json({ error: 'Você não pode remover a própria conta.' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (user.role === 'ADMIN') return res.status(400).json({ error: 'O administrador principal não pode ser removido.' });

    const total = await prisma.pesquisa.count({ where: { collectedById: id } });
    if (total > 0) {
      await prisma.user.update({ where: { id }, data: { ativo: false, lastSeenAt: null } });
      return res.json({ message: 'Usuário desativado para preservar o histórico das pesquisas.' });
    }

    await prisma.user.delete({ where: { id } });
    return res.json({ message: 'Usuário removido com sucesso.' });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível remover o usuário.' });
  }
}

module.exports = { listUsers, listOnlineYoungs, createUser, updateUser, resetUserPassword, removeUser };
