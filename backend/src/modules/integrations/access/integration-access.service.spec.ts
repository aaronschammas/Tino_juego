import { ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationsConfig } from '../integrations.config';
import { IntegrationAccessService } from './integration-access.service';

describe('IntegrationAccessService', () => {
  const owner = { id: 'owner-1', role: 'USER', organizationId: 'org-1' };
  const readyEnv = {
    INTEGRATIONS_ENABLED: 'true',
    TRELLO_API_KEY: 'key',
    INTEGRATIONS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  };
  let prisma: {
    organization: { findFirst: jest.Mock };
    organizationMembership: { findUnique: jest.Mock };
  };

  const build = (env: NodeJS.ProcessEnv = readyEnv) =>
    new IntegrationAccessService(
      prisma as unknown as PrismaService,
      new IntegrationsConfig(env),
    );

  beforeEach(() => {
    prisma = {
      organization: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ plan: { hasIntegrations: true } }),
      },
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ORG_OWNER' }),
      },
    };
  });

  it('allows an owner of a Max organization when the feature is on', async () => {
    await expect(build().getAvailability(owner, 'org-1')).resolves.toEqual({
      enabled: true,
      canManage: true,
      reason: null,
    });
    await expect(
      build().assertCanManage(owner, 'org-1'),
    ).resolves.toBeUndefined();
  });

  it('stays off without touching the database when the flag is disabled', async () => {
    const service = build({ ...readyEnv, INTEGRATIONS_ENABLED: 'false' });

    await expect(service.getAvailability(owner, 'org-1')).resolves.toEqual({
      enabled: false,
      canManage: false,
      reason: 'FEATURE_DISABLED',
    });
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
    await expect(service.assertCanManage(owner, 'org-1')).rejects.toThrow(
      new ForbiddenException(
        'Las integraciones no estan habilitadas en este entorno',
      ),
    );
  });

  it('requires a plan with integrations', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      plan: { hasIntegrations: false },
    });

    await expect(build().getAvailability(owner, 'org-1')).resolves.toEqual({
      enabled: false,
      canManage: false,
      reason: 'PLAN_REQUIRED',
    });
    await expect(build().assertCanManage(owner, 'org-1')).rejects.toThrow(
      'Las integraciones requieren el Plan Max',
    );
  });

  it('treats a missing or inactive organization as without plan', async () => {
    prisma.organization.findFirst.mockResolvedValue(null);

    await expect(build().getAvailability(owner, 'org-1')).resolves.toEqual(
      expect.objectContaining({ reason: 'PLAN_REQUIRED' }),
    );
    expect(prisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-1', isActive: true } }),
    );
  });

  it('lets members see it is enabled but not manage it', async () => {
    prisma.organizationMembership.findUnique.mockResolvedValue({
      role: 'ORG_MEMBER',
    });

    await expect(build().getAvailability(owner, 'org-1')).resolves.toEqual({
      enabled: true,
      canManage: false,
      reason: 'OWNER_REQUIRED',
    });
    await expect(build().assertCanManage(owner, 'org-1')).rejects.toThrow(
      'Solo el owner de la organizacion puede conectar integraciones',
    );
  });
});
