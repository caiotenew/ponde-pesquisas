const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const A = require('../lib/accounts');

const ADMIN_SELECT = {
  id: true, nome: true, email: true, role: true, status: true, cargo: true, justificativa: true,
  mustChangePassword: true, resetRequestedAt: true, lastLoginAt: true, lastSeenAt: true, createdAt: true,
  _count: { select: { pesquisas: true } }
};

function toAdminView(user, now = Date.now()) {
  const { _count, ...rest } = user;
  return {
    ...rest,
    pesquisas: _count ? _count.pesquisas : 0,
    online: A.isOnline(user.lastSeenAt, now),
    principal: user.email === A.ADMIN_EMAIL
  };
}

// Carrega o alvo da ação e bloqueia alterações indevidas (a si mesmo ou ao administrador).
async function loadTarget(req, res, { allowSelf = false, allowAdmin = false } = {}) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'ID inválido.' }); return null; }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) { res.status(404).json({ error: 'Usuário não encontrado.' }); return null; }
  if (!allowSelf && target.id === req.user.id) {
    res.status(400).json({ error: 'Você não pode alterar a própria conta por aqui.' }); return null;
  }
  if (!allowAdmin && target.role === 'ADMIN') {
    res.status(400).json({ error: 'A conta do administrador principal não pode ser alterada por aqui.' }); return null;
  }
  return target;
}

async function listUsers(req, res) {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, select: ADMIN_SELECT });
    const now = Date.now();
    return res.json({ users: users.map((u) => toAdminView(u, now)) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível carregar os usuários.' });
  }
}

async function createUser(req, res) {
  try {
    const nome = A.cleanText(req.body?.nome, 120);
    const email = A.normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');
    const role = req.body?.role;
    const cargo = A.cleanText(req.body?.cargo, 120);

    if (nome.length < 3 || !['JOVEM', 'GESTAO'].includes(role)) {
      return res.status(400).json({ error: 'Informe nome, e-mail, senha e perfil (Jovem Aprendiz ou Gestão). Só existe um administrador.' });
    }
    const emailError = A.validateEmail(email);
    if (emailError) return res.status(400).json({ error: emailError });
    const passwordError = A.validatePassword(senha, 6);
    if (passwordError) return res.status(400).json({ error: passwordError });
    if (email === A.ADMIN_EMAIL) return res.status(400).json({ error: 'Este e-mail é reservado ao administrador principal.' });
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });

    const user = await prisma.user.create({
      data: { nome, email, role, cargo: cargo || null, senhaHash: await bcrypt.hash(senha, 12), ...A.statusData('ATIVO') },
      select: ADMIN_SELECT
    });
    return res.status(201).json({ user: toAdminView(user) });
  } catch (error) {
    if (error && error.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível criar o usuário.' });
  }
}

async function updateUser(req, res) {
  try {
    const target = await loadTarget(req, res, { allowSelf: true, allowAdmin: true });
    if (!target) return;
    const data = {};
    if (req.body?.nome !== undefined) {
      const nome = A.cleanText(req.body.nome, 120);
      if (nome.length < 3) return res.status(400).json({ error: 'Informe o nome completo.' });
      data.nome = nome;
    }
    if (req.body?.cargo !== undefined) data.cargo = A.cleanText(req.body.cargo, 120) || null;
    if (req.body?.email !== undefined) {
      const email = A.normalizeEmail(req.body.email);
      const emailError = A.validateEmail(email);
      if (emailError) return res.status(400).json({ error: emailError });
      if (email !== target.email) {
        if (target.role === 'ADMIN') return res.status(400).json({ error: 'O e-mail do administrador principal não pode ser alterado.' });
        if (email === A.ADMIN_EMAIL) return res.status(400).json({ error: 'Este e-mail é reservado ao administrador principal.' });
        if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
        data.email = email;
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nenhuma alteração informada.' });
    const user = await prisma.user.update({ where: { id: target.id }, data, select: ADMIN_SELECT });
    return res.json({ user: toAdminView(user), message: 'Dados atualizados.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível atualizar o usuário.' });
  }
}

async function setRole(req, res) {
  try {
    const role = req.body?.role;
    if (!['JOVEM', 'GESTAO'].includes(role)) return res.status(400).json({ error: 'Perfil inválido.' });
    const target = await loadTarget(req, res);
    if (!target) return;
    const user = await prisma.user.update({ where: { id: target.id }, data: { role }, select: ADMIN_SELECT });
    return res.json({ user: toAdminView(user), message: 'Perfil atualizado.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível alterar o perfil.' });
  }
}

async function setStatus(req, res) {
  try {
    const status = req.body?.status;
    if (!['ATIVO', 'INATIVO'].includes(status)) return res.status(400).json({ error: 'Situação inválida.' });
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status === 'PENDENTE') return res.status(400).json({ error: 'Este cadastro aguarda aprovação: use Aprovar ou Recusar.' });
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { ...A.statusData(status), ...(status === 'INATIVO' ? { lastSeenAt: null } : {}) },
      select: ADMIN_SELECT
    });
    return res.json({ user: toAdminView(user), message: status === 'ATIVO' ? 'Acesso reativado.' : 'Conta desativada. O histórico de pesquisas foi preservado.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível alterar a situação da conta.' });
  }
}

async function decide(req, res, status, message) {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.status !== 'PENDENTE') return res.status(400).json({ error: 'Este cadastro não está pendente.' });
    const user = await prisma.user.update({ where: { id: target.id }, data: A.statusData(status), select: ADMIN_SELECT });
    return res.json({ user: toAdminView(user), message });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível concluir a ação.' });
  }
}
const approveUser = (req, res) => decide(req, res, 'ATIVO', 'Acesso aprovado.');
const rejectUser = (req, res) => decide(req, res, 'RECUSADO', 'Solicitação recusada.');

// Define uma senha temporária (exibida uma única vez ao administrador). O usuário precisa trocá-la no próximo acesso.
async function resetPassword(req, res) {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;
    const temporaryPassword = A.generateTempPassword(10);
    await prisma.user.update({
      where: { id: target.id },
      data: {
        senhaHash: await bcrypt.hash(temporaryPassword, 12),
        mustChangePassword: true,
        // +1s: o "iat" do JWT tem precisão de segundos; assim, qualquer token anterior (inclusive do mesmo segundo) é invalidado.
        passwordChangedAt: new Date(Date.now() + 1000),
        resetRequestedAt: null,
        lastSeenAt: null
      }
    });
    return res.json({ temporaryPassword, message: 'Senha temporária definida.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível redefinir a senha.' });
  }
}

async function removeUser(req, res) {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;
    const total = await prisma.pesquisa.count({ where: { collectedById: target.id } });
    if (total > 0) {
      await prisma.user.update({ where: { id: target.id }, data: { ...A.statusData('INATIVO'), lastSeenAt: null } });
      return res.json({ message: 'Usuário desativado para preservar o histórico das pesquisas.', deactivated: true });
    }
    await prisma.user.delete({ where: { id: target.id } });
    return res.json({ message: 'Usuário removido com sucesso.', deleted: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível remover o usuário.' });
  }
}

module.exports = { listUsers, createUser, updateUser, setRole, setStatus, approveUser, rejectUser, resetPassword, removeUser };
