/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WhatsAppLinkService } from './whatsapp-link.service';

describe('WhatsAppLinkService', () => {
  let prisma: any;
  let service: WhatsAppLinkService;
  const owner = { id: 'owner-1' };

  beforeEach(() => {
    process.env.WHATSAPP_BUSINESS_NUMBER = '+54 9 11 5555 0000';
    prisma = {
      organization: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'org-1', plan: { hasWhatsApp: true } }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Empresa' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ORG_OWNER' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
      whatsAppLinkCode: {
        create: jest.fn().mockResolvedValue({ id: 'code-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn().mockResolvedValue({ id: 'code-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    service = new WhatsAppLinkService(prisma as never);
  });

  afterEach(() => {
    delete process.env.WHATSAPP_BUSINESS_NUMBER;
  });

  describe('assertCanManage', () => {
    it('rejects organizations without the Max plan', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        plan: { hasWhatsApp: false },
      });

      await expect(service.assertCanManage(owner, 'org-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects members that are not owners', async () => {
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });

      await expect(service.assertCanManage(owner, 'org-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects organizations that do not exist', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);

      await expect(service.assertCanManage(owner, 'org-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createLinkCode', () => {
    it('stores only the hash of the code and clears previous ones', async () => {
      const result = await service.createLinkCode(owner, 'org-1');

      expect(prisma.whatsAppLinkCode.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });

      const stored = prisma.whatsAppLinkCode.create.mock.calls[0][0].data;
      expect(stored.codeHash).toBe(WhatsAppLinkService.hashCode(result.code));
      expect(stored.codeHash).not.toContain(result.code);
      expect(stored.createdByUserId).toBe('owner-1');
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns a wa.me link with the code already written', async () => {
      const result = await service.createLinkCode(owner, 'org-1');

      expect(result.whatsappUrl).toBe(
        `https://wa.me/5491155550000?text=${encodeURIComponent(`VINCULAR ${result.code}`)}`,
      );
    });

    it('returns no link when the business number is not configured', async () => {
      delete process.env.WHATSAPP_BUSINESS_NUMBER;

      const result = await service.createLinkCode(owner, 'org-1');

      expect(result.whatsappUrl).toBeNull();
      expect(result.code).toHaveLength(10);
    });
  });

  describe('consumeCode', () => {
    const pending = (expiresAt: Date) => ({
      id: 'code-1',
      organizationId: 'org-1',
      createdByUserId: 'owner-1',
      expiresAt,
    });

    it('links the organization to the Meta user id and never to a phone number', async () => {
      prisma.whatsAppLinkCode.findUnique.mockResolvedValue(
        pending(new Date(Date.now() + 60_000)),
      );

      const organization = await service.consumeCode('ABCDEFGHJK', 'AR.12345');

      expect(organization).toEqual({
        id: 'org-1',
        name: 'Empresa',
        ownerId: 'owner-1',
      });

      const data = prisma.organization.update.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(data.whatsappUserId).toBe('AR.12345');
      expect(data.whatsappLinkedByUserId).toBe('owner-1');
      expect(Object.keys(data)).toEqual([
        'whatsappUserId',
        'whatsappLinkedByUserId',
        'whatsappLinkedAt',
      ]);
      expect(prisma.whatsAppLinkCode.delete).toHaveBeenCalledWith({
        where: { id: 'code-1' },
      });
    });

    it('is case insensitive because the code travels inside a link', async () => {
      prisma.whatsAppLinkCode.findUnique.mockResolvedValue(
        pending(new Date(Date.now() + 60_000)),
      );

      await service.consumeCode('abcdefghjk', 'AR.12345');

      expect(prisma.whatsAppLinkCode.findUnique).toHaveBeenCalledWith({
        where: { codeHash: WhatsAppLinkService.hashCode('ABCDEFGHJK') },
        select: expect.any(Object),
      });
    });

    it('rejects an expired code and burns it anyway', async () => {
      prisma.whatsAppLinkCode.findUnique.mockResolvedValue(
        pending(new Date(Date.now() - 1_000)),
      );

      await expect(
        service.consumeCode('ABCDEFGHJK', 'AR.1'),
      ).resolves.toBeNull();
      expect(prisma.whatsAppLinkCode.delete).toHaveBeenCalled();
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown code', async () => {
      await expect(
        service.consumeCode('NOEXISTE12', 'AR.1'),
      ).resolves.toBeNull();
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('rejects a code whose creator is no longer owner', async () => {
      prisma.whatsAppLinkCode.findUnique.mockResolvedValue(
        pending(new Date(Date.now() + 60_000)),
      );
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });

      await expect(
        service.consumeCode('ABCDEFGHJK', 'AR.1'),
      ).resolves.toBeNull();
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('rejects linking when the owner is inactive', async () => {
      prisma.whatsAppLinkCode.findUnique.mockResolvedValue(
        pending(new Date(Date.now() + 60_000)),
      );
      prisma.user.findUnique.mockResolvedValue({ isActive: false });
      await expect(
        service.consumeCode('ABCDEFGHJK', 'AR.1'),
      ).resolves.toBeNull();
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('rejects linking when the organization is inactive or the feature was revoked', async () => {
      prisma.whatsAppLinkCode.findUnique.mockResolvedValue(
        pending(new Date(Date.now() + 60_000)),
      );
      prisma.organization.findFirst.mockResolvedValue(null);
      await expect(
        service.consumeCode('ABCDEFGHJK', 'AR.1'),
      ).resolves.toBeNull();
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: 'org-1', isActive: true, plan: { hasWhatsApp: true } },
        select: { id: true },
      });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('reports the link without exposing any identifier', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        whatsappUserId: 'AR.12345',
        whatsappLinkedAt: new Date('2026-09-17T12:00:00Z'),
        whatsappLinkedByUserId: 'owner-1',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'owner-1',
        name: 'Ana',
        lastname: 'Pérez',
      });

      const status = await service.getStatus('org-1');

      expect(status).toEqual({
        linked: true,
        linkedAt: new Date('2026-09-17T12:00:00Z'),
        linkedBy: { id: 'owner-1', name: 'Ana Pérez' },
      });
      expect(JSON.stringify(status)).not.toContain('AR.12345');
    });

    it('reports no link when the organization has none', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        whatsappUserId: null,
        whatsappLinkedAt: null,
        whatsappLinkedByUserId: null,
      });

      await expect(service.getStatus('org-1')).resolves.toEqual({
        linked: false,
        linkedAt: null,
        linkedBy: null,
      });
    });
  });

  describe('unlink', () => {
    it('clears the link and the pending codes', async () => {
      await service.unlink('org-1');

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: {
          whatsappUserId: null,
          whatsappLinkedByUserId: null,
          whatsappLinkedAt: null,
        },
      });
      expect(prisma.whatsAppLinkCode.deleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });
    });

    it('clears every organization linked by a user', async () => {
      await service.unlinkAllForUser('owner-1');

      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { whatsappLinkedByUserId: 'owner-1' },
        data: {
          whatsappUserId: null,
          whatsappLinkedByUserId: null,
          whatsappLinkedAt: null,
        },
      });
    });
  });

  describe('findLinkedOrganizations', () => {
    it('only looks at active organizations with the Max plan', async () => {
      await service.findLinkedOrganizations('AR.12345');

      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          whatsappUserId: 'AR.12345',
          isActive: true,
          plan: { hasWhatsApp: true },
        },
        select: expect.any(Object),
      });
    });

    it('returns the organizations whose owner still has the role', async () => {
      prisma.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Empresa', whatsappLinkedByUserId: 'owner-1' },
      ]);

      await expect(
        service.findLinkedOrganizations('AR.12345'),
      ).resolves.toEqual([
        { id: 'org-1', name: 'Empresa', ownerId: 'owner-1' },
      ]);
    });

    it('drops and unlinks an organization whose owner lost the role', async () => {
      prisma.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Empresa', whatsappLinkedByUserId: 'owner-1' },
      ]);
      prisma.organizationMembership.findUnique.mockResolvedValue({
        role: 'ORG_MEMBER',
      });

      await expect(
        service.findLinkedOrganizations('AR.12345'),
      ).resolves.toEqual([]);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: {
          whatsappUserId: null,
          whatsappLinkedByUserId: null,
          whatsappLinkedAt: null,
        },
      });
    });

    it('drops an organization whose owner is no longer active', async () => {
      prisma.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Empresa', whatsappLinkedByUserId: 'owner-1' },
      ]);
      prisma.user.findUnique.mockResolvedValue({ isActive: false });

      await expect(
        service.findLinkedOrganizations('AR.12345'),
      ).resolves.toEqual([]);
    });
  });
});
