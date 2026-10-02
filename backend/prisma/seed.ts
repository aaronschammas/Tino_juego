import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create Plans
    console.log('💎 Creating subscription plans...');
    
    const plans = [
      {
        name: 'free',
        title: 'Free',
        description: 'Ideal para validar el flujo y comenzar con lo esencial.',
        price: 0,
        maxUsers: 1,
        maxProjects: 2,
        hasAnalytics: true,
        hasEmailInvites: false,
        hasSso: false,
        hasPrioritySupport: false,
        hasAdvancedPerms: false,
        hasAudit: false,
      },
      {
        name: 'pro',
        title: 'Plan Pro',
        description: 'Ideal para equipos que necesitan más visibilidad.',
        price: 29,
        maxUsers: 10,
        maxProjects: null, // unlimited
        hasAnalytics: true,
        hasEmailInvites: true,
        hasSso: false,
        hasPrioritySupport: false,
        hasAdvancedPerms: false,
        hasAudit: false,
      },
      {
        name: 'max',
        title: 'Plan Max',
        description: 'Para operar con mayor capacidad y control.',
        price: 99,
        maxUsers: null, // unlimited
        maxProjects: null, // unlimited
        hasAnalytics: true,
        hasEmailInvites: true,
        hasSso: true,
        hasPrioritySupport: true,
        hasAdvancedPerms: true,
        hasAudit: true,
        hasWhatsApp: true,
        hasIntegrations: true,
      },
    ];

    for (const planData of plans) {
      await prisma.plan.upsert({
        where: { name: planData.name },
        update: planData,
        create: planData,
      });
    }

    // Create Roles
    console.log('🔑 Creating system roles...');
    
    const roles = [
      { name: 'ADMIN' },
      { name: 'USER' },
      { name: 'SUPERADMIN' },
    ];

    for (const roleData of roles) {
      await prisma.role.upsert({
        where: { name: roleData.name },
        update: {},
        create: roleData,
      });
    }
    
    console.log('\n================================');
    console.log('🎉 Seeding completed successfully!');
    console.log('================================');
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
