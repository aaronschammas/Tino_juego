import { OrganizationRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  PilotProvisionConfig,
  provisionPilotUsers,
  validateConfig,
} from './provision-pilot-users';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (password: string) => `bcrypt:${password}`),
}));

const config: PilotProvisionConfig = {
  organizationName: 'Grido / Helacor - Piloto',
  projectName: 'Proyecto piloto Grido',
  planName: 'pro',
  allowedEmailDomain: 'helacor.com.ar',
  users: [
    {
      email: 'owner@helacor.com.ar',
      name: 'Pilot',
      lastname: 'Owner',
      organizationRole: OrganizationRole.ORG_OWNER,
      passwordEnv: 'OWNER_PASSWORD',
    },
  ],
};

function fakePrisma(initialUsers: any[] = []) {
  const users = [...initialUsers];
  const organizations: any[] = [];
  const projects: any[] = [];
  const memberships = new Map<string, any>();
  const projectMembers = new Map<string, any>();

  const tx: any = {
    role: {
      findUnique: jest.fn(async () => ({ id: 'role-user', name: 'USER' })),
    },
    plan: {
      findUnique: jest.fn(async () => ({ id: 'plan-pro', name: 'pro' })),
    },
    organization: {
      findMany: jest.fn(async ({ where }) =>
        organizations.filter((item) => item.name === where.name),
      ),
      create: jest.fn(async ({ data }) => {
        const item = { id: 'org-grido', ...data };
        organizations.push(item);
        return item;
      }),
    },
    user: {
      findFirst: jest.fn(async ({ where }) => {
        const email = where.email.equals.toLowerCase();
        const found = users.find((item) => item.email.toLowerCase() === email);
        return found
          ? { ...found, role: found.role ?? { name: 'USER' } }
          : null;
      }),
      create: jest.fn(async ({ data }) => {
        const item = { ...data };
        users.push(item);
        return item;
      }),
      update: jest.fn(async ({ where, data }) => {
        const item = users.find((candidate) => candidate.id === where.id);
        Object.assign(item, data);
        return { ...item };
      }),
    },
    organizationMembership: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const key = `${where.organizationId_userId.organizationId}:${where.organizationId_userId.userId}`;
        memberships.set(
          key,
          memberships.has(key)
            ? { ...memberships.get(key), ...update }
            : create,
        );
      }),
    },
    project: {
      findMany: jest.fn(async ({ where }) =>
        projects.filter(
          (item) =>
            item.name === where.name &&
            item.organizationId === where.organizationId,
        ),
      ),
      create: jest.fn(async ({ data }) => {
        const item = { id: 'project-grido', ...data };
        projects.push(item);
        return item;
      }),
    },
    projectMember: {
      upsert: jest.fn(async ({ where, create }) => {
        const key = `${where.projectId_userId.projectId}:${where.projectId_userId.userId}`;
        if (!projectMembers.has(key)) projectMembers.set(key, create);
      }),
    },
  };

  return {
    prisma: { $transaction: (callback: any) => callback(tx) },
    tx,
    users,
    organizations,
    projects,
    memberships,
    projectMembers,
  };
}

describe('provisionPilotUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a manual USER with a bcrypt hash, no Google identity and both memberships', async () => {
    const db = fakePrisma();
    const result = await provisionPilotUsers(db.prisma, config, {
      OWNER_PASSWORD: 'VerySecurePassword!1',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('VerySecurePassword!1', 12);
    expect(db.tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'owner@helacor.com.ar',
        password: 'bcrypt:VerySecurePassword!1',
        googleId: null,
        googleStatus: false,
        roleId: 'role-user',
        isActive: true,
      }),
    });
    expect(db.memberships.size).toBe(1);
    expect(db.projectMembers.size).toBe(1);
    expect(result.temporaryPasswords).toEqual([]);
  });

  it('is idempotent for users, organization memberships and project members', async () => {
    const db = fakePrisma();
    const env = { OWNER_PASSWORD: 'VerySecurePassword!1' };

    await provisionPilotUsers(db.prisma, config, env);
    const second = await provisionPilotUsers(db.prisma, config, env);

    expect(db.tx.user.create).toHaveBeenCalledTimes(1);
    expect(db.tx.organization.create).toHaveBeenCalledTimes(1);
    expect(db.tx.project.create).toHaveBeenCalledTimes(1);
    expect(db.memberships.size).toBe(1);
    expect(db.projectMembers.size).toBe(1);
    expect(second.users[0]).toEqual(
      expect.objectContaining({
        userCreated: false,
        passwordCreated: false,
      }),
    );
  });

  it('preserves an existing default organization while adding the Grido membership', async () => {
    const existing = {
      id: 'existing-user',
      email: 'owner@helacor.com.ar',
      name: 'Pilot',
      lastname: 'Owner',
      password: 'existing-hash',
      googleId: null,
      googleStatus: false,
      roleId: 'role-user',
      role: { name: 'USER' },
      isActive: true,
      organizationId: 'other-org',
    };
    const db = fakePrisma([existing]);

    const result = await provisionPilotUsers(db.prisma, config, {});

    expect(existing.organizationId).toBe('other-org');
    expect(db.tx.user.update).not.toHaveBeenCalled();
    expect(db.memberships.has('org-grido:existing-user')).toBe(true);
    expect(result.users[0].organizationDefaultPreserved).toBe(true);
  });

  it('refuses to reuse a globally privileged user', async () => {
    const db = fakePrisma([
      {
        id: 'admin-user',
        email: 'owner@helacor.com.ar',
        password: 'hash',
        googleId: null,
        googleStatus: false,
        role: { name: 'ADMIN' },
        isActive: true,
        organizationId: null,
      },
    ]);

    await expect(provisionPilotUsers(db.prisma, config, {})).rejects.toThrow(
      'tiene rol global ADMIN',
    );
    expect(db.tx.organizationMembership.upsert).not.toHaveBeenCalled();
  });
});

describe('validateConfig', () => {
  it('rejects plaintext passwords in the committed JSON shape', () => {
    expect(() =>
      validateConfig({
        ...config,
        users: [{ ...config.users[0], password: 'plaintext' } as any],
      }),
    ).toThrow('no se permite password en el archivo');
  });
});
