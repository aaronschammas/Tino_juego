import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Reset Database Script
 * Clears all data and creates a clean demo environment
 * 
 * Usage: npx ts-node src/reset-db.ts
 */

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🔄 Starting database reset...\n');

  try {
    // 1️⃣ Delete all data in correct order (respecting foreign keys)
    console.log('🗑️  Deleting existing data...');

    await prisma.timeEntry.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.organizationInvite.deleteMany({});
    await prisma.organizationMembership.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.role.deleteMany({});
    await prisma.plan.deleteMany({});

    console.log('✅ All data deleted\n');

    // 2️⃣ Create plans
    console.log('💎 Creating subscription plans...');
    await prisma.plan.createMany({
      data: [
        {
          name: 'free',
          title: 'Free',
          description: 'Basic plan for small teams',
          price: 0,
          maxUsers: 1,
          maxProjects: 2,
          hasAnalytics: true,
        },
        {
          name: 'pro',
          title: 'Pro',
          description: 'Advanced features for growing teams',
          price: 29,
          maxUsers: 10,
          maxProjects: null,
          hasAnalytics: true,
          hasEmailInvites: true,
        },
        {
          name: 'max',
          title: 'Max',
          description: 'Full potential for large organizations',
          price: 99,
          maxUsers: null,
          maxProjects: null,
          hasAnalytics: true,
          hasEmailInvites: true,
          hasSso: true,
          hasPrioritySupport: true,
          hasAdvancedPerms: true,
          hasAudit: true,
          hasWhatsApp: true,
        },
      ],
    });

    // 3️⃣ Create roles
    console.log('🔑 Creating system roles...');
    await prisma.role.createMany({
      data: [
        { name: 'ADMIN' },
        { name: 'SUPERADMIN' },
        { name: 'USER' },
      ],
    });
    
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });

    console.log('✅ Roles created\n');

    // 4️⃣ Create organization
    console.log('🏢 Creating organization TINO...');
    const organization = await prisma.organization.create({
      data: {
        name: 'TINO',
        plan: {
          connect: { name: 'pro' },
        },
        isActive: true,
      },
    });
    console.log(`✅ Organization created: ${organization.name} (${organization.id})\n`);

    // 4️⃣ Create Leonardo (owner) - ACTIVE
    console.log('👤 Creating owner user: leo@tino.com...');
    const hashedPasswordLeo = await bcrypt.hash('leobruno1829', 10);
    
    const userLeo = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'leo@tino.com',
        name: 'Leonardo',
        lastname: 'Mendez',
        password: hashedPasswordLeo,
        googleStatus: false,
        isActive: true,
        organizationId: organization.id,
        roleId: adminRole!.id,
      },
    });
    console.log(`✅ User created: ${userLeo.email}`);
    console.log(`   ID: ${userLeo.id}`);
    console.log(`   GoogleStatus: ${userLeo.googleStatus}`);
    console.log(`   Organization: ${organization.id}\n`);

    // 5️⃣ Create organization membership for Leonardo
    console.log('📋 Creating organization membership for Leo...');
    const membershipLeo = await prisma.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: userLeo.id,
        role: 'ORG_OWNER',
      },
    });
    console.log(`✅ Membership created: ORG_OWNER\n`);

    // 6️⃣ Create Victoria (pending - needs to accept invite)
    console.log('👤 Creating pending user: vicky@tino.com...');
    const userVicky = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'vicky@tino.com',
        name: 'Victoria',
        lastname: 'Suter',
        googleStatus: false,
        isActive: true,
        roleId: userRole!.id,
        // organizationId NOT set yet - will be set when invite accepted
      },
    });
    console.log(`✅ User created: ${userVicky.email}`);
    console.log(`   ID: ${userVicky.id}`);
    console.log(`   GoogleStatus: ${userVicky.googleStatus}`);
    console.log(`   (Waiting for invite acceptance)\n`);

    // 7️⃣ Create Test user (pending - needs to accept invite)
    console.log('👤 Creating pending user: test@tino.com...');
    const userTest = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'test@tino.com',
        name: 'Test',
        lastname: 'Test',
        googleStatus: false,
        isActive: true,
        roleId: userRole!.id,
        // organizationId NOT set yet - will be set when invite accepted
      },
    });
    console.log(`✅ User created: ${userTest.email}`);
    console.log(`   ID: ${userTest.id}`);
    console.log(`   GoogleStatus: ${userTest.googleStatus}`);
    console.log(`   (Waiting for invite acceptance)\n`);

    // 8️⃣ Create invitation for Victoria
    console.log('📧 Creating invitation for Victoria...');
    const tokenVicky = crypto.randomBytes(32).toString('hex');
    const expiresAtVicky = new Date();
    expiresAtVicky.setDate(expiresAtVicky.getDate() + 7);

    const inviteVicky = await prisma.organizationInvite.create({
      data: {
        organizationId: organization.id,
        email: 'vicky@tino.com',
        role: 'ORG_MEMBER',
        token: tokenVicky,
        expiresAt: expiresAtVicky,
        status: 'PENDING',
      },
    });
    console.log(`✅ Invitation created:`);
    console.log(`   Email: vicky@tino.com`);
    console.log(`   Token: ${tokenVicky}`);
    console.log(`   Expires: ${expiresAtVicky.toISOString()}`);
    console.log(`   Invite Link: http://localhost:3000/invite?token=${tokenVicky}\n`);

    // 9️⃣ Create invitation for Test
    console.log('📧 Creating invitation for Test...');
    const tokenTest = crypto.randomBytes(32).toString('hex');
    const expiresAtTest = new Date();
    expiresAtTest.setDate(expiresAtTest.getDate() + 7);

    const inviteTest = await prisma.organizationInvite.create({
      data: {
        organizationId: organization.id,
        email: 'test@tino.com',
        role: 'ORG_MEMBER',
        token: tokenTest,
        expiresAt: expiresAtTest,
        status: 'PENDING',
      },
    });
    console.log(`✅ Invitation created:`);
    console.log(`   Email: test@tino.com`);
    console.log(`   Token: ${tokenTest}`);
    console.log(`   Expires: ${expiresAtTest.toISOString()}`);
    console.log(`   Invite Link: http://localhost:3000/invite?token=${tokenTest}\n`);

    // 1️⃣0️⃣ Print summary
    console.log('\n' + '='.repeat(70));
    console.log('✨ DATABASE RESET COMPLETE - DEMO ENVIRONMENT READY');
    console.log('='.repeat(70) + '\n');

    console.log('🏢 ORGANIZATION:');
    console.log(`   Name: TINO`);
    console.log(`   ID: ${organization.id}\n`);

    console.log('👥 USERS:\n');

    console.log('1️⃣  OWNER (LEONARDO):');
    console.log(`   Email: leo@tino.com`);
    console.log(`   Password: leobruno1829`);
    console.log(`   Name: Leonardo Mendez`);
    console.log(`   GoogleStatus: false ✅`);
    console.log(`   Role: ORG_OWNER`);
    console.log(`   Ready: Can login immediately\n`);

    console.log('2️⃣  INVITED (VICTORIA):');
    console.log(`   Email: vicky@tino.com`);
    console.log(`   Name: Victoria Suter`);
    console.log(`   GoogleStatus: false ⏳`);
    console.log(`   Role: ORG_MEMBER`);
    console.log(`   Invite Token: ${tokenVicky}`);
    console.log(`   Invite Link: http://localhost:3000/invite?token=${tokenVicky}`);
    console.log(`   Action: Needs to accept invite and set password\n`);

    console.log('3️⃣  INVITED (TEST):');
    console.log(`   Email: test@tino.com`);
    console.log(`   Name: Test Test`);
    console.log(`   GoogleStatus: false ⏳`);
    console.log(`   Role: ORG_MEMBER`);
    console.log(`   Invite Token: ${tokenTest}`);
    console.log(`   Invite Link: http://localhost:3000/invite?token=${tokenTest}`);
    console.log(`   Action: Needs to accept invite and set password\n`);

    console.log('🔑 LOGIN TEST:');
    console.log(`   Email: leo@tino.com`);
    console.log(`   Password: leobruno1829\n`);

    console.log('📝 NEXT STEPS:');
    console.log('   1. Use invite links to accept Victoria and Test invitations');
    console.log('   2. Create projects as Leonardo (owner)');
    console.log('   3. Assign tasks to team members');
    console.log('   4. Test drag & drop task reordering\n');
  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset
resetDatabase();
