const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();
const email = 'damascenocaio311@gmail.com';

async function main() {
  const senhaHash = await bcrypt.hash('1234', 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { nome: 'Caio Damasceno', senhaHash, role: 'ADMIN', ativo: true, mustChangePassword: true, lastSeenAt: null }
    });
  } else {
    await prisma.user.create({
      data: { nome: 'Caio Damasceno', email, senhaHash, role: 'ADMIN', ativo: true, mustChangePassword: true }
    });
  }
  console.log(`Conta administradora preparada: ${email}`);
  console.log('Senha temporária: 1234. A troca será obrigatória no próximo login.');
  console.log('Nenhum outro usuário ou pesquisa foi apagado.');
}

main()
  .catch((error) => {
    console.error('Não foi possível preparar a conta administradora:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
