const crypto = require('crypto');

// E-mail do administrador principal. É a única conta que pode ter o perfil ADMIN.
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'damascenocaio311@gmail.com').trim().toLowerCase();

// Quem enviou sinal de vida (heartbeat) nos últimos 2 minutos é considerado online.
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase().slice(0, 254);
}

function validateEmail(email) {
  return EMAIL_RE.test(email) ? null : 'Informe um e-mail válido.';
}

// bcrypt só considera os primeiros 72 bytes da senha.
function validatePassword(senha, min = 6) {
  if (typeof senha !== 'string' || senha.length < min) return `A senha precisa ter pelo menos ${min} caracteres.`;
  if (Buffer.byteLength(senha, 'utf8') > 72) return 'A senha pode ter no máximo 72 caracteres.';
  return null;
}

function statusData(status) {
  return { status, ativo: status === 'ATIVO' };
}

function isOnline(lastSeenAt, now = Date.now()) {
  return Boolean(lastSeenAt) && now - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
}

function publicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    status: user.status,
    cargo: user.cargo || null,
    mustChangePassword: Boolean(user.mustChangePassword)
  };
}

// Senha temporária legível (sem caracteres ambíguos como 0/O e 1/l/I).
function generateTempPassword(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

module.exports = {
  ADMIN_EMAIL, ONLINE_WINDOW_MS, cleanText, normalizeEmail, validateEmail, validatePassword,
  statusData, isOnline, publicUser, generateTempPassword
};
