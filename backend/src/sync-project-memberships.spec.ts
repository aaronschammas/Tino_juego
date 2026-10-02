import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    organization: { findMany: jest.fn() },
    organizationMembership: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    projectMember: { findFirst: jest.fn(), createMany: jest.fn() },
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe('Sync Project Memberships Script', () => {
  let prisma: any;
  let processSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
    processSpy = jest.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    processSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should sync memberships for users with no project memberships', async () => {
    // Arrange
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-1', name: 'Org 1', isActive: true }]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      { userId: 'user-1', organizationId: 'org-1', user: { email: 'test@test.com' } }
    ]);
    prisma.project.findMany.mockResolvedValue([{ id: 'proj-1', name: 'Proj 1' }]);
    prisma.projectMember.findFirst.mockResolvedValue(null); // No project membership
    prisma.projectMember.createMany.mockResolvedValue({ count: 1 });

    // Act
    jest.isolateModules(() => {
      require('./sync-project-memberships');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect(prisma.organization.findMany).toHaveBeenCalled();
    expect(prisma.projectMember.createMany).toHaveBeenCalled();
  });

  it('should skip users that already have project memberships', async () => {
    // Arrange
    prisma.organization.findMany.mockResolvedValue([{ id: 'org-1', name: 'Org 1', isActive: true }]);
    prisma.organizationMembership.findMany.mockResolvedValue([
      { userId: 'user-1', organizationId: 'org-1', user: { email: 'test@test.com' } }
    ]);
    prisma.project.findMany.mockResolvedValue([{ id: 'proj-1', name: 'Proj 1' }]);
    prisma.projectMember.findFirst.mockResolvedValue({ id: 'pm-1' }); // Already has membership

    // Act
    jest.isolateModules(() => {
      require('./sync-project-memberships');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect(prisma.projectMember.createMany).not.toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    // Arrange
    prisma.organization.findMany.mockRejectedValue(new Error('Sync Error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    jest.isolateModules(() => {
      require('./sync-project-memberships');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect(prisma.organization.findMany).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(processSpy).toHaveBeenCalledWith(1);
  });
});
