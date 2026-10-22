/*
 * Redefine a senha do administrador diretamente no banco (esqueceu a senha e não há como entrar).
 * Uso:   npm run admin:reset -- "NovaSenhaAqui"
 * Requer o backend/.env com DATABASE_URL apontando para o banco desejado.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'damascenocaio311@gmail.com').trim().toLowerCase();
  const nova = String(process.argv[2] || '').trim();
  if (nova.length < 4) throw new Error('Informe a nova senha (mínimo 4 caracteres). Ex.: npm run admin:reset -- "MinhaSenha123"');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Administrador ${email} não encontrado. Rode primeiro: npx prisma db seed`);

  await prisma.user.update({
    where: { id: user.id },
    data: { senhaHash: await bcrypt.hash(nova, 12), role: 'ADMIN', status: 'ATIVO', ativo: true, passwordChangedAt: new Date(), mustChangePassword: false }
  });
  console.log(`Senha de ${email} redefinida. Entre no sistema e altere-a em "Alterar senha".`);
}

main()
  .catch((error) => { console.error(error.message || error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
