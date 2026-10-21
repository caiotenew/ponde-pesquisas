const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { signToken } = require('../lib/auth');

const ADMIN_EMAIL = 'damascenocaio311@gmail.com';
const INITIAL_ADMIN_PASSWORD = '1234';
const ADMIN_SETUP_KEY = String(process.env.ADMIN_SETUP_KEY || '').trim();

function publicUser(user) {
  return { id: user.id, nome: user.nome, email: user.email, role: user.role, mustChangePassword: Boolean(user.mustChangePassword) };
}

function authPayload(user) {
  return { token: signToken(user), user: publicUser(user) };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');

    if (!email || !senha) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });

    const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    return res.status(200).json(authPayload(updatedUser));
  } catch (error) {
    console.error('Falha no login:', error.message);
    return res.status(500).json({ error: 'Não foi possível realizar o login.' });
  }
}

async function setupStatus(req, res) {
  try {
    const count = await prisma.user.count();
    return res.json({ needsSetup: count === 0, setupConfigured: Boolean(ADMIN_SETUP_KEY.length >= 32 && !ADMIN_SETUP_KEY.startsWith('TROQUE_')) });
  } catch (error) {
    return res.status(503).json({ error: 'Não foi possível verificar o estado inicial do sistema.' });
  }
}

// A primeira conta só pode ser criada uma única vez e só para o e-mail do proprietário definido no projeto.
// O segredo inicial é intencionalmente temporário: o administrador deve alterá-lo ao entrar.
async function bootstrapAdmin(req, res) {
  const nome = String(req.body?.nome || 'Caio Damasceno').trim().slice(0, 120) || 'Caio Damasceno';
  const suppliedKey = String(req.body?.setupKey || '').trim();
  if (ADMIN_SETUP_KEY.length < 32 || ADMIN_SETUP_KEY.startsWith('TROQUE_')) {
    return res.status(503).json({ error: 'A chave de configuração inicial ainda não foi definida no backend.' });
  }
  const suppliedBuffer = Buffer.from(suppliedKey);
  const expectedBuffer = Buffer.from(ADMIN_SETUP_KEY);
  const validKey = suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
  if (!validKey) return res.status(403).json({ error: 'Chave de configuração incorreta.' });
  try {
    const passwordHash = await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 12);
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count();
      if (count !== 0) return { conflict: true };
      const user = await tx.user.create({
        data: {
          nome,
          email: ADMIN_EMAIL,
          senhaHash: passwordHash,
          role: 'ADMIN',
          ativo: true,
          lastSeenAt: new Date(),
          mustChangePassword: true
        }
      });
      return { user };
    }, { isolationLevel: 'Serializable' });

    if (result.conflict) return res.status(409).json({ error: 'A configuração inicial já foi concluída. Entre com uma conta existente.' });
    return res.status(201).json(authPayload(result.user));
  } catch (error) {
    if (error.code === 'P2034' || error.code === 'P2002') {
      return res.status(409).json({ error: 'A configuração inicial já foi concluída. Atualize a página e entre com sua conta.' });
    }
    console.error('Falha ao criar administrador inicial:', error.message);
    return res.status(500).json({ error: 'Não foi possível criar o administrador inicial.' });
  }
}

// Cadastro público é restrito ao perfil JOVEM. Perfis GESTAO só podem ser criados pelo ADMIN.
async function register(req, res) {
  const nome = String(req.body?.nome || '').trim();
  const email = normalizeEmail(req.body?.email);
  const senha = String(req.body?.senha || '');

  if (nome.length < 2 || nome.length > 120) return res.status(400).json({ error: 'Informe um nome entre 2 e 120 caracteres.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (senha.length < 8 || senha.length > 72) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });

  try {
    if ((await prisma.user.count()) === 0) {
      return res.status(409).json({ error: 'A primeira conta precisa ser a do administrador. Use a configuração inicial.' });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    const senhaHash = await bcrypt.hash(senha, 12);
    const user = await prisma.user.create({
      data: { nome, email, senhaHash, role: 'JOVEM', ativo: true, lastSeenAt: new Date() }
    });
    return res.status(201).json(authPayload(user));
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    console.error('Falha no cadastro público:', error.message);
    return res.status(500).json({ error: 'Não foi possível criar a conta.' });
  }
}

async function me(req, res) {
  return res.json({ user: publicUser(req.user) });
}

async function heartbeat(req, res) {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { lastSeenAt: new Date() } });
    return res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível atualizar a presença.' });
  }
}

async function logout(req, res) {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { lastSeenAt: null } });
  } catch (error) {
    // O token ainda será apagado no navegador mesmo se a presença não conseguir ser limpa.
  }
  return res.json({ ok: true });
}

async function changePassword(req, res) {
  const atual = String(req.body?.senhaAtual || '');
  const nova = String(req.body?.novaSenha || '');
  if (!atual || !nova) return res.status(400).json({ error: 'Preencha a senha atual e a nova senha.' });
  if (nova.length < 8 || nova.length > 72) return res.status(400).json({ error: 'A nova senha deve ter entre 8 e 72 caracteres.' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await bcrypt.compare(atual, user.senhaHash))) {
      return res.status(400).json({ error: 'A senha atual está incorreta.' });
    }
    const senhaHash = await bcrypt.hash(nova, 12);
    await prisma.user.update({ where: { id: user.id }, data: { senhaHash, lastSeenAt: new Date(), mustChangePassword: false } });
    return res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    console.error('Falha ao alterar senha:', error.message);
    return res.status(500).json({ error: 'Não foi possível alterar a senha.' });
  }
}

module.exports = { login, setupStatus, bootstrapAdmin, register, me, heartbeat, logout, changePassword };
