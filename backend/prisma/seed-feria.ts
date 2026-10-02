import { PrismaClient } from '@prisma/client';
import { seedDemoBase } from '../src/modules/demo/demo-seed';

/** Carga la empresa demo de la feria. Usa DEMO_USER_EMAIL y DEMO_USER_PASSWORD; con --force la rehace desde cero. */
async function main() {
  const email = process.env.DEMO_USER_EMAIL?.trim();
  const password = process.env.DEMO_USER_PASSWORD?.trim();
  if (!email || !password || password.length < 6) {
    throw new Error('Definí DEMO_USER_EMAIL y DEMO_USER_PASSWORD (mínimo 6 caracteres) en .env.feria');
  }

  const prisma = new PrismaClient();
  try {
    const result = await seedDemoBase(prisma, {
      email,
      password,
      force: process.argv.includes('--force'),
    });
    console.log(
      result.created
        ? `Empresa demo creada (usuario ${email}).`
        : `La empresa demo ya existe (usuario ${email}); no se tocó. Usá --force para rehacerla.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('No se pudo cargar la empresa demo:', error instanceof Error ? error.message : error);
  process.exit(1);
});
