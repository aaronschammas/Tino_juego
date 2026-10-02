import { PrismaClient } from '@prisma/client';

/**
 * Sync script: Ensures all organization members have project memberships
 * Run this once to fix the task assignment bug for existing users
 * 
 * Usage: npx ts-node src/sync-project-memberships.ts
 */

const prisma = new PrismaClient();

async function syncProjectMemberships() {
  console.log('🔄 Starting project membership synchronization...\n');

  try {
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      where: { isActive: true },
    });

    console.log(`📊 Found ${organizations.length} active organizations\n`);

    let totalSynced = 0;

    for (const org of organizations) {
      console.log(`\n🏢 Processing organization: ${org.name} (${org.id})`);

      // Get all members in this organization
      const members = await prisma.organizationMembership.findMany({
        where: { organizationId: org.id },
        include: { user: { select: { email: true } } },
      });

      console.log(`   └─ Found ${members.length} members`);

      // Get all active projects in this organization
      const activeProjects = await prisma.project.findMany({
        where: {
          organizationId: org.id,
          isActive: true,
        },
        select: { id: true, name: true },
      });

      console.log(`   └─ Found ${activeProjects.length} active projects`);

      // For each member, ensure they have project membership
      for (const member of members) {
        // Check if user has ANY project membership in this organization
        const hasProjectMembership = await prisma.projectMember.findFirst({
          where: {
            userId: member.userId,
            project: {
              organizationId: org.id,
            },
          },
        });

        if (!hasProjectMembership && activeProjects.length > 0) {
          console.log(
            `   ├─ 📝 Syncing ${member.user.email} → Adding to ${activeProjects.length} projects...`,
          );

          // Add user to all active projects
          await prisma.projectMember.createMany({
            data: activeProjects.map((project) => ({
              projectId: project.id,
              userId: member.userId,
              role: 'MEMBER',
            })),
            skipDuplicates: true,
          });

          totalSynced++;
          console.log(
            `   └─ ✅ ${member.user.email} synchronized`,
          );
        } else if (hasProjectMembership) {
          console.log(`   ├─ ✓ ${member.user.email} already has project memberships`);
        } else {
          console.log(`   ├─ ⚠️  ${member.user.email} has no active projects to join`);
        }
      }
    }

    console.log(`\n✨ Synchronization complete!`);
    console.log(`📈 Total members synchronized: ${totalSynced}`);
    console.log(`\n✅ All organization members should now be able to:`);
    console.log(`   • Create and manage tasks in projects`);
    console.log(`   • Be assigned to tasks`);
    console.log(`   • View project information`);
  } catch (error) {
    console.error('❌ Synchronization failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncProjectMemberships();
