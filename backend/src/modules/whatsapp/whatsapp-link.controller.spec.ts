/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { ForbiddenException } from '@nestjs/common';
import { WhatsAppLinkController } from './whatsapp-link.controller';

describe('WhatsAppLinkController', () => {
  const user = { id: 'owner-1' };
  const request = { headers: {} };
  const scopedUser = { id: 'owner-1', organizationId: 'org-1' };
  let links: any;
  let activeOrganization: any;
  let controller: WhatsAppLinkController;

  beforeEach(() => {
    links = {
      createLinkCode: jest.fn().mockResolvedValue({
        code: 'ABCDEFGHJK',
        expiresAt: new Date('2026-09-21T12:10:00Z'),
        whatsappUrl: 'https://wa.me/15551661489?text=VINCULAR%20ABCDEFGHJK',
      }),
      assertCanManage: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockResolvedValue({
        linked: true,
        linkedAt: new Date('2026-09-21T12:00:00Z'),
        linkedBy: { id: 'owner-1', name: 'Ana Pérez' },
      }),
      unlink: jest.fn().mockResolvedValue(undefined),
    };
    activeOrganization = {
      resolveScopedUser: jest.fn().mockResolvedValue(scopedUser),
    };
    controller = new WhatsAppLinkController(
      links as never,
      activeOrganization as never,
    );
  });

  it('creates the code for the active organization of the request', async () => {
    const result = await controller.createCode(user, request as never);

    expect(activeOrganization.resolveScopedUser).toHaveBeenCalledWith(
      user,
      request,
    );
    expect(links.createLinkCode).toHaveBeenCalledWith(scopedUser, 'org-1');
    expect(result.whatsappUrl).toContain('VINCULAR');
  });

  it('checks owner and plan before showing the status', async () => {
    await expect(controller.status(user, request as never)).resolves.toEqual(
      expect.objectContaining({ linked: true }),
    );

    expect(links.assertCanManage).toHaveBeenCalledWith(scopedUser, 'org-1');
    expect(links.getStatus).toHaveBeenCalledWith('org-1');
  });

  it('checks owner and plan before unlinking', async () => {
    await expect(controller.unlink(user, request as never)).resolves.toEqual({
      linked: false,
      linkedAt: null,
      linkedBy: null,
    });

    expect(links.assertCanManage).toHaveBeenCalledWith(scopedUser, 'org-1');
    expect(links.unlink).toHaveBeenCalledWith('org-1');
  });

  it('does not unlink when the user is not allowed', async () => {
    links.assertCanManage.mockRejectedValue(
      new ForbiddenException('Only organization owners can use WhatsApp'),
    );

    await expect(controller.unlink(user, request as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(links.unlink).not.toHaveBeenCalled();
  });

  it('does not reveal the status to someone who cannot manage it', async () => {
    links.assertCanManage.mockRejectedValue(
      new ForbiddenException('WhatsApp requires the Max plan'),
    );

    await expect(controller.status(user, request as never)).rejects.toThrow(
      ForbiddenException,
    );
    expect(links.getStatus).not.toHaveBeenCalled();
  });
});
