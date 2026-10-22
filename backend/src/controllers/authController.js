const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken } = require('../lib/auth');
const A = require('../lib/accounts');

// Hash fictício: mantém o tempo de resposta parecido quando o e-mail não existe.
const DUMMY_HASH = bcrypt.hashSync('senha-fictícia-para-tempo-constante', 10);

const BLOCKED_MESSAGES = {
  PENDENTE: 'Seu cadastro está aguardando aprovação do administrador. Você poderá entrar assim que ele for aprovado.',
  RECUSADO: 'Sua solicitação de acesso não foi aprovada. Entre em contato com o administrador.',
  INATIVO: 'Esta conta está desativada. Entre em contato com o administrador.'
};

function session(user, senha) {
  return {
    token: signToken(user),
    user: A.publicUser(user),
    // Aviso para senhas curtas (ex.: a senha inicial do administrador).
    weakPassword: typeof senha === 'string' && senha.length < 6
  };
}

async function login(req, res) {
  try {
    const email = A.normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');
    if (!email || !senha) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(senha, user ? user.senhaHash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });

    if (user.status !== 'ATIVO' || !user.ativo) {
      return res.status(403).json({ error: BLOCKED_MESSAGES[user.status] || BLOCKED_MESSAGES.INATIVO, code: user.status });
    }

    const now = new Date();
    const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, lastSeenAt: now } });
    return res.status(200).json(session(updated, senha));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível realizar o login.' });
  }
}

async function register(req, res) {
  try {
    const nome = A.cleanText(req.body?.nome, 120);
    const email = A.normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');
    const requestedRole = req.body?.role;
    const cargo = A.cleanText(req.body?.cargo, 120);
    const justificativa = A.cleanText(req.body?.justificativa, 500);

    const isPrimary = email === A.ADMIN_EMAIL;

    if (nome.length < 3) return res.status(400).json({ error: 'Informe seu nome completo.' });
    const emailError = A.validateEmail(email);
    if (emailError) return res.status(400).json({ error: emailError });
    if (!isPrimary && !['JOVEM', 'GESTAO'].includes(requestedRole)) {
      return res.status(400).json({ error: 'Escolha o tipo de acesso: Jovem Aprendiz ou Gestão.' });
    }
    // A senha do administrador principal pode ter 4 caracteres (decisão do dono do sistema); as demais, 6.
    const passwordError = A.validatePassword(senha, isPrimary ? 4 : 6);
    if (passwordError) return res.status(400).json({ error: passwordError });
    if (!isPrimary && requestedRole === 'GESTAO' && cargo.length < 2) {
      return res.status(400).json({ error: 'Informe o cargo ou função para solicitar acesso de Gestão.' });
    }

    const duplicated = { error: 'Este e-mail já está cadastrado. Entre na sua conta ou use "Esqueci minha senha".' };
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json(duplicated);

    let role = requestedRole;
    if (isPrimary) {
      // A primeira (e única) conta de administrador é a do e-mail reservado.
      if (await prisma.user.findFirst({ where: { role: 'ADMIN' } })) return res.status(409).json(duplicated);
      role = 'ADMIN';
    }

    const status = role === 'GESTAO' ? 'PENDENTE' : 'ATIVO';
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        nome, email, role, cargo: cargo || null,
        justificativa: role === 'GESTAO' ? (justificativa || null) : null,
        senhaHash: await bcrypt.hash(senha, 12),
        ...A.statusData(status),
        ...(status === 'ATIVO' ? { lastLoginAt: now, lastSeenAt: now } : {})
      }
    });

    if (status === 'PENDENTE') {
      return res.status(201).json({
        pending: true,
        message: 'Solicitação enviada! O administrador vai analisar seu pedido de acesso de Gestão. Você poderá entrar assim que ele for aprovado.'
      });
    }
    return res.status(201).json({ ...session(user, senha), message: role === 'ADMIN' ? 'Conta de administrador criada com sucesso.' : 'Conta criada com sucesso.' });
  } catch (error) {
    if (error && error.code === 'P2002') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível criar a conta.' });
  }
}

async function me(req, res) {
  return res.json({ user: A.publicUser(req.user) });
}

async function logout(req, res) {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { lastSeenAt: null } });
  } catch (error) { /* sair nunca deve falhar para o usuário */ }
  return res.json({ ok: true });
}

// A presença em si é registrada pelo middleware de autenticação; aqui só confirmamos a sessão.
async function heartbeat(req, res) {
  return res.json({ ok: true, serverTime: new Date().toISOString() });
}

// Sem envio de e-mail: o pedido fica sinalizado para o administrador, que define uma senha temporária.
async function forgotPassword(req, res) {
  const generic = { message: 'Se o e-mail estiver cadastrado, o administrador foi avisado e vai definir uma nova senha para você.' };
  try {
    const email = A.normalizeEmail(req.body?.email);
    if (A.validateEmail(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status !== 'RECUSADO') {
      await prisma.user.update({ where: { id: user.id }, data: { resetRequestedAt: new Date() } });
    }
    return res.json(generic);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível registrar a solicitação.' });
  }
}

async function changePassword(req, res) {
  try {
    const senhaAtual = String(req.body?.senhaAtual || '');
    const novaSenha = String(req.body?.novaSenha || '');
    if (!senhaAtual) return res.status(400).json({ error: 'Informe a senha atual.' });
    const passwordError = A.validatePassword(novaSenha, 6);
    if (passwordError) return res.status(400).json({ error: passwordError });
    if (novaSenha === senhaAtual) return res.status(400).json({ error: 'A nova senha precisa ser diferente da atual.' });

    if (!(await bcrypt.compare(senhaAtual, req.user.senhaHash))) {
      return res.status(400).json({ error: 'A senha atual está incorreta.' });
    }
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        senhaHash: await bcrypt.hash(novaSenha, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        resetRequestedAt: null
      }
    });
    // Novo token: os emitidos antes desta troca deixam de valer.
    return res.json({ ...session(updated, novaSenha), message: 'Senha alterada com sucesso.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível alterar a senha.' });
  }
}

module.exports = { login, register, me, logout, heartbeat, forgotPassword, changePassword };
