require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'damascenocaio311@gmail.com').trim().toLowerCase();
  const nome = (process.env.ADMIN_NAME || 'Caio Damasceno').trim();
  const configured = String(process.env.ADMIN_PASSWORD || '').trim();
  const password = configured || '1234';
  const resetPassword = String(process.env.ADMIN_RESET_PASSWORD || '').toLowerCase() === 'true';

  // Contas antigas desativadas (ativo=false) passam a ter status INATIVO.
  const legacy = await prisma.user.updateMany({ where: { ativo: false, status: 'ATIVO' }, data: { status: 'INATIVO' } });
  if (legacy.count) console.log(`${legacy.count} conta(s) antiga(s) desativada(s) sincronizada(s).`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: { nome, email, senhaHash: await bcrypt.hash(password, 12), role: 'ADMIN', status: 'ATIVO', ativo: true }
    });
    console.log(`Administrador criado: ${email}`);
    if (!configured) console.warn('ATENÇÃO: ADMIN_PASSWORD não definido — foi usada a senha inicial "1234". Altere-a no primeiro acesso.');
  } else {
    // Não sobrescreve a senha que o administrador já escolheu. Para forçar: ADMIN_RESET_PASSWORD=true.
    const data = { role: 'ADMIN', status: 'ATIVO', ativo: true };
    if (resetPassword) {
      data.senhaHash = await bcrypt.hash(password, 12);
      data.passwordChangedAt = new Date();
      data.mustChangePassword = false;
      console.log('Senha do administrador redefinida (ADMIN_RESET_PASSWORD=true).');
    }
    await prisma.user.update({ where: { id: existing.id }, data });
    console.log(`Administrador já existe: ${email} (senha mantida).`);
  }
  console.log('Seed concluído com sucesso.');
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
