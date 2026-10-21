const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(`Seed ignorado: o banco já possui ${existingUsers} usuário(s). Nenhuma conta ou senha foi alterada.`);
    return;
  }

  const email = String(process.env.ADMIN_EMAIL || 'damascenocaio311@gmail.com').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '1234');
  const senhaHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { nome: 'Caio Damasceno', email, senhaHash, role: 'ADMIN', ativo: true, mustChangePassword: true }
  });
  console.log('Administrador inicial criado. Altere a senha temporária no primeiro acesso.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
