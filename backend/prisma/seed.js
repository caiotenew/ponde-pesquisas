const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'damascenocaio311@gmail.com').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!password) throw new Error('ADMIN_PASSWORD não foi definido no ambiente. Configure-o antes de executar o seed.');
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      nome: 'Caio Damasceno',
      senhaHash: passwordHash,
      role: 'ADMIN',
      ativo: true
    },
    create: {
      nome: 'Caio Damasceno',
      email,
      senhaHash: passwordHash,
      role: 'ADMIN',
      ativo: true
    }
  });

  console.log('Seed concluído com sucesso.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
