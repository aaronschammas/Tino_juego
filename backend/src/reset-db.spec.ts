import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    timeEntry: { deleteMany: jest.fn() },
    task: { deleteMany: jest.fn() },
    projectMember: { deleteMany: jest.fn() },
    project: { deleteMany: jest.fn() },
    organizationInvite: { deleteMany: jest.fn(), create: jest.fn() },
    organizationMembership: { deleteMany: jest.fn(), create: jest.fn() },
    organization: { deleteMany: jest.fn(), create: jest.fn() },
    user: { deleteMany: jest.fn(), create: jest.fn() },
    role: { deleteMany: jest.fn(), createMany: jest.fn(), findUnique: jest.fn() },
    plan: { deleteMany: jest.fn(), createMany: jest.fn() },
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe('Reset DB Script', () => {
  let prisma: any;
  let processSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
    prisma.organization.create.mockResolvedValue({ id: 'org-1', name: 'TINO' });
    prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'leo@tino.com' });
    prisma.organizationMembership.create.mockResolvedValue({});
    prisma.organizationInvite.create.mockResolvedValue({});
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1' });
    
    processSpy = jest.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    processSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('should reset the database and create demo data', async () => {
    // Arrange & Act
    jest.isolateModules(() => {
      require('./reset-db');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect(prisma.timeEntry.deleteMany).toHaveBeenCalled();
    expect(prisma.organization.create).toHaveBeenCalled();
  });

  it('should handle errors during reset', async () => {
    // Arrange
    prisma.timeEntry.deleteMany.mockRejectedValue(new Error('DB Error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    jest.isolateModules(() => {
      require('./reset-db');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert
    expect(prisma.timeEntry.deleteMany).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    expect(processSpy).toHaveBeenCalledWith(1);
  });
});
