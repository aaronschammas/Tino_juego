import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  ACTIVE_ORGANIZATION_HEADER,
  ActiveOrganizationService,
} from './active-organization.service';
import { PrismaService } from 'src/database/prisma.service';

describe('ActiveOrganizationService', () => {
  let service: ActiveOrganizationService;
  let prisma: any;

  const freePlan = {
    id: 'plan-free',
    name: 'free',
    title: 'Free',
    maxUsers: 1,
    maxProjects: 2,
    hasEmailInvites: false,
    hasAnalytics: false,
    hasSso: false,
    hasPrioritySupport: false,
    hasAdvancedPerms: false,
    hasAudit: false,
  };

  const proPlan = {
    id: 'plan-pro',
    name: 'pro',
    title: 'Pro',
    maxUsers: 10,
    maxProjects: null,
    hasEmailInvites: true,
    hasAnalytics: true,
    hasSso: false,
    hasPrioritySupport: false,
    hasAdvancedPerms: false,
    hasAudit: false,
  };

  function userWithMemberships(
    organizationId: string | null,
    memberships: any[],
  ) {
    return {
      id: 'user-1',
      email: 'juan@test.com',
      name: 'Juan',
      lastname: 'Perez',
      role: { name: 'USER' },
      roleId: 'role-user',
      isActive: true,
      googleStatus: false,
      googleId: null,
      password: 'hash',
      organizationId,
      organizationMemberships: memberships,
    };
  }

  function membership(
    id: string,
    organizationId: string,
    name: string,
    role: string,
    plan: any,
    isActive = true,
  ) {
    return {
      id,
      organizationId,
      userId: 'user-1',
      role,
      organization: {
        id: organizationId,
        name,
        isActive,
        plan,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    };
  }

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveOrganizationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ActiveOrganizationService);
  });

  it('reads requested organization from header before cookie and trims it', () => {
    expect(
      service.readRequestedOrganizationId({
        headers: { [ACTIVE_ORGANIZATION_HEADER]: '  org-header  ' },
        cookies: { [ACTIVE_ORGANIZATION_COOKIE]: 'org-cookie' },
      }),
    ).toEqual({ organizationId: 'org-header', explicit: true });
  });

  it('reads requested organization from first header value when header is an array', () => {
    expect(
      service.readRequestedOrganizationId({
        headers: { [ACTIVE_ORGANIZATION_HEADER]: ['org-array', 'org-ignored'] },
      }),
    ).toEqual({ organizationId: 'org-array', explicit: true });
  });

  it('falls back to cookie when no valid organization header exists', () => {
    expect(
      service.readRequestedOrganizationId({
        headers: { [ACTIVE_ORGANIZATION_HEADER]: '   ' },
        cookies: { [ACTIVE_ORGANIZATION_COOKIE]: '  org-cookie  ' },
      }),
    ).toEqual({ organizationId: 'org-cookie', explicit: false });
  });

  it('returns no requested organization when request data is missing', () => {
    expect(service.readRequestedOrganizationId()).toEqual({
      organizationId: null,
      explicit: false,
    });
  });

  it('throws a controlled error when user cannot be loaded', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.getContext({ id: 'missing-user', role: 'USER' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns context without active organization for user with zero organizations', async () => {
    prisma.user.findUnique.mockResolvedValue(userWithMemberships(null, []));

    const context = await service.getContext({ id: 'user-1', role: 'USER' });

    expect(context.activeOrganization).toBeNull();
    expect(context.activeMembership).toBeNull();
    expect(context.memberships).toEqual([]);
  });

  it('selects the only organization automatically', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships(null, [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
      ]),
    );

    const context = await service.getContext({ id: 'user-1', role: 'USER' });

    expect(context.activeOrganization?.id).toBe('org-free');
    expect(context.activeMembership?.role).toBe('ORG_OWNER');
    expect(context.features.maxProjects).toBe(2);
  });

  it('exposes the organization creation date for range defaults', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships(null, [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
      ]),
    );

    const context = await service.getContext({ id: 'user-1', role: 'USER' });

    expect(context.activeOrganization?.createdAt).toEqual(
      new Date('2026-05-01T00:00:00.000Z'),
    );
  });

  it('uses a valid requested organization for multi-org users', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-free', [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
        membership('mem-pro', 'org-pro', 'Grido', 'ORG_MEMBER', proPlan),
      ]),
    );

    const context = await service.getContext(
      { id: 'user-1', role: 'USER' },
      'org-pro',
      { rejectInvalidRequested: true },
    );

    expect(context.activeOrganization?.id).toBe('org-pro');
    expect(context.activeOrganization?.plan?.name).toBe('pro');
    expect(context.features.canInviteMembers).toBe(true);
  });

  it('falls back to legacy default when no active organization was requested', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-free', [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
        membership('mem-pro', 'org-pro', 'Grido', 'ORG_MEMBER', proPlan),
      ]),
    );

    const context = await service.getContext({ id: 'user-1', role: 'USER' });

    expect(context.activeOrganization?.id).toBe('org-free');
    expect(context.activeOrganization?.plan?.name).toBe('free');
  });

  it('rejects switching to an organization without membership', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-free', [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
      ]),
    );

    await expect(
      service.getContext({ id: 'user-1', role: 'USER' }, 'org-other', {
        rejectInvalidRequested: true,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ignores an invalid non-explicit requested organization and falls back safely', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-free', [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
      ]),
    );

    const context = await service.getContext(
      { id: 'user-1', role: 'USER' },
      'org-other',
      { rejectInvalidRequested: false },
    );

    expect(context.activeOrganization?.id).toBe('org-free');
    expect(context.activeMembership?.id).toBe('mem-free');
  });

  it('selects the first membership when user has multiple organizations and no valid default', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-missing', [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
        membership('mem-pro', 'org-pro', 'Grido', 'ORG_MEMBER', proPlan),
      ]),
    );

    const context = await service.getContext({ id: 'user-1', role: 'USER' });

    expect(context.activeOrganization?.id).toBe('org-free');
    expect(context.memberships.map((item) => item.organizationId)).toEqual([
      'org-free',
      'org-pro',
    ]);
  });

  it('filters inactive organizations and fails scoped resolution when no active org remains', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-inactive', [
        membership(
          'mem-inactive',
          'org-inactive',
          'Inactive Org',
          'ORG_OWNER',
          freePlan,
          false,
        ),
      ]),
    );

    const context = await service.getContext({ id: 'user-1', role: 'USER' });

    expect(context.memberships).toEqual([]);
    expect(context.activeOrganization).toBeNull();
    await expect(
      service.resolveScopedUser({ id: 'user-1', role: 'USER' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns default feature flags when active organization has no plan', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...userWithMemberships(null, [
        membership(
          'mem-no-plan',
          'org-no-plan',
          'No Plan Org',
          'ORG_MEMBER',
          null,
        ),
      ]),
      googleId: 'google-1',
      googleStatus: true,
      password: null,
    });

    const context = await service.getContext({ id: 'user-1', role: 'USER' });

    expect(context.activeOrganization?.id).toBe('org-no-plan');
    expect(context.user.requiresInternalPasswordSetup).toBe(true);
    expect(context.user.hasInternalPassword).toBe(false);
    expect(context.features).toEqual({
      canInviteMembers: false,
      maxProjects: null,
      maxMembers: null,
      hasAnalytics: false,
      hasSso: false,
      hasPrioritySupport: false,
      hasAdvancedPerms: false,
      hasAudit: false,
      hasWhatsApp: false,
      hasIntegrations: false,
    });
  });

  it('rejects an invalid explicit organization header through request context', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-free', [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
      ]),
    );

    await expect(
      service.getContextForRequest(
        { id: 'user-1', role: 'USER' },
        { headers: { [ACTIVE_ORGANIZATION_HEADER]: 'org-other' } },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('uses cookie organization through request context and resolves scoped user', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userWithMemberships('org-free', [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
        membership('mem-pro', 'org-pro', 'Grido', 'ORG_MEMBER', proPlan),
      ]),
    );

    const scopedUser = await service.resolveScopedUser(
      { id: 'user-1', role: 'USER' },
      { cookies: { [ACTIVE_ORGANIZATION_COOKIE]: 'org-pro' } },
    );

    expect(scopedUser.organizationId).toBe('org-pro');
    expect(scopedUser.orgRole).toBe('ORG_MEMBER');
    expect(scopedUser.organizationPlan?.name).toBe('pro');
  });

  it('allows a SUPERADMIN requested organization but returns no active org without membership payload', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...userWithMemberships(null, [
        membership('mem-free', 'org-free', 'Juan Org', 'ORG_OWNER', freePlan),
      ]),
      role: { name: 'SUPERADMIN' },
    });

    const context = await service.getContext(
      { id: 'user-1', role: 'SUPERADMIN' },
      'org-not-member',
      { rejectInvalidRequested: true },
    );

    expect(context.activeOrganization).toBeNull();
    expect(context.activeMembership).toBeNull();
    expect(context.memberships).toHaveLength(1);
  });
});
