/**
 * Tests del resumen diario de Trello por WhatsApp. Prisma, el resumen de
 * novedades y el cliente de Meta estan simulados; se verifica cuando se manda,
 * por que via (texto dentro de la ventana de 24 horas o plantilla) y cuando no
 * se manda nada.
 */
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationActivityService } from '../integrations/activity/integration-activity.service';
import { WhatsAppClientService } from './whatsapp-client.service';
import {
  DIGEST_PERIOD_MS,
  WhatsAppDigestService,
} from './whatsapp-digest.service';

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-09-29T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR_MS);

describe('WhatsAppDigestService', () => {
  const organization = {
    id: 'org-1',
    name: 'Empresa',
    whatsappUserId: 'AR.83920174615529',
    whatsappLinkedByUserId: 'owner-1',
    whatsappLastInboundAt: hoursAgo(2),
    whatsappDigestSentAt: hoursAgo(24),
  };
  const withNews = {
    since: hoursAgo(24),
    until: NOW,
    created: [{ taskId: 't1', title: 'Login', projectName: 'Web' }],
    statusChanges: [],
    archived: [],
    work: [],
    totalMinutes: 0,
    isEmpty: false,
  };
  let prisma: {
    organization: { findMany: jest.Mock; update: jest.Mock };
    organizationMembership: { findUnique: jest.Mock };
  };
  let activity: { summarize: jest.Mock };
  let client: { sendText: jest.Mock; sendTemplate: jest.Mock };
  let service: WhatsAppDigestService;

  const summarizeScope = () =>
    (activity.summarize.mock.calls[0] as [{ since: Date; until: Date }])[0];

  beforeEach(() => {
    prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([organization]),
        update: jest.fn().mockResolvedValue({}),
      },
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ORG_OWNER' }),
      },
    };
    activity = { summarize: jest.fn().mockResolvedValue(withNews) };
    client = {
      sendText: jest.fn().mockResolvedValue(true),
      sendTemplate: jest.fn().mockResolvedValue(true),
    };
    service = new WhatsAppDigestService(
      prisma as unknown as PrismaService,
      activity as unknown as IntegrationActivityService,
      client as unknown as WhatsAppClientService,
    );
  });

  afterEach(() => {
    delete process.env.WHATSAPP_DIGEST_TEMPLATE;
    delete process.env.WHATSAPP_DIGEST_TEMPLATE_LANGUAGE;
    jest.restoreAllMocks();
  });

  it('only looks at organizations that can receive the digest', async () => {
    await service.sendDailyDigests(NOW);

    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          whatsappUserId: { not: null },
          whatsappLinkedByUserId: { not: null },
          plan: { hasWhatsApp: true, hasIntegrations: true },
          integrationConnections: { some: {} },
        },
      }),
    );
  });

  it('sends the full text for free while the 24 hour window is open', async () => {
    await expect(service.sendDailyDigests(NOW)).resolves.toEqual({
      processed: 1,
      results: [{ organizationId: 'org-1', outcome: 'SENT_TEXT' }],
    });

    expect(summarizeScope()).toEqual({
      organizationId: 'org-1',
      since: organization.whatsappDigestSentAt,
      until: NOW,
    });
    expect(client.sendText).toHaveBeenCalledWith(
      'AR.83920174615529',
      expect.stringContaining('*Login*'),
    );
    expect(client.sendTemplate).not.toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { whatsappDigestSentAt: NOW },
    });
  });

  it('uses the Meta template when the window is closed', async () => {
    process.env.WHATSAPP_DIGEST_TEMPLATE = 'tino_resumen_trello';
    prisma.organization.findMany.mockResolvedValue([
      { ...organization, whatsappLastInboundAt: hoursAgo(30) },
    ]);

    await expect(service.sendDailyDigests(NOW)).resolves.toMatchObject({
      results: [{ outcome: 'SENT_TEMPLATE' }],
    });
    expect(client.sendTemplate).toHaveBeenCalledWith(
      'AR.83920174615529',
      'tino_resumen_trello',
      'es_AR',
      ['Empresa', '1 tarea nueva'],
    );
    expect(client.sendText).not.toHaveBeenCalled();
  });

  it('keeps the news for the next digest when there is no channel', async () => {
    prisma.organization.findMany.mockResolvedValue([
      { ...organization, whatsappLastInboundAt: null },
    ]);

    await expect(service.sendDailyDigests(NOW)).resolves.toMatchObject({
      results: [{ outcome: 'NO_CHANNEL' }],
    });
    expect(client.sendText).not.toHaveBeenCalled();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('sends nothing when there was no news, but marks the day', async () => {
    activity.summarize.mockResolvedValue({ ...withNews, isEmpty: true });

    await expect(service.sendDailyDigests(NOW)).resolves.toMatchObject({
      results: [{ outcome: 'NO_NEWS' }],
    });
    expect(client.sendText).not.toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { whatsappDigestSentAt: NOW },
    });
  });

  it('does not send twice when Cloud Scheduler retries', async () => {
    prisma.organization.findMany.mockResolvedValue([
      { ...organization, whatsappDigestSentAt: hoursAgo(1) },
    ]);

    await expect(service.sendDailyDigests(NOW)).resolves.toMatchObject({
      results: [{ outcome: 'ALREADY_SENT' }],
    });
    expect(activity.summarize).not.toHaveBeenCalled();
  });

  it('skips an organization whose linked owner lost the role', async () => {
    prisma.organizationMembership.findUnique.mockResolvedValue({
      role: 'ORG_MEMBER',
    });

    await expect(service.sendDailyDigests(NOW)).resolves.toMatchObject({
      results: [{ outcome: 'NOT_OWNER' }],
    });
    expect(client.sendText).not.toHaveBeenCalled();
  });

  it('covers the last 24 hours the first time, and at most one week', async () => {
    prisma.organization.findMany.mockResolvedValue([
      { ...organization, whatsappDigestSentAt: null },
    ]);
    await service.sendDailyDigests(NOW);
    expect(summarizeScope().since).toEqual(
      new Date(NOW.getTime() - DIGEST_PERIOD_MS),
    );

    activity.summarize.mockClear();
    prisma.organization.findMany.mockResolvedValue([
      { ...organization, whatsappDigestSentAt: hoursAgo(24 * 30) },
    ]);
    await service.sendDailyDigests(NOW);
    expect(summarizeScope().since).toEqual(hoursAgo(24 * 7));
  });

  it('does not mark the day when Meta rejects the message', async () => {
    client.sendText.mockResolvedValue(false);

    await expect(service.sendDailyDigests(NOW)).resolves.toMatchObject({
      results: [{ outcome: 'FAILED' }],
    });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('keeps going with the next organization when one fails', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prisma.organization.findMany.mockResolvedValue([
      organization,
      { ...organization, id: 'org-2' },
    ]);
    activity.summarize
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValueOnce(withNews);

    await expect(service.sendDailyDigests(NOW)).resolves.toEqual({
      processed: 2,
      results: [
        { organizationId: 'org-1', outcome: 'FAILED' },
        { organizationId: 'org-2', outcome: 'SENT_TEXT' },
      ],
    });
  });

  it('builds the text of a period or null when nothing happened', async () => {
    await expect(
      service.buildDigestText('org-1', 'Empresa', hoursAgo(24), NOW),
    ).resolves.toContain('*Login*');

    activity.summarize.mockResolvedValue({ ...withNews, isEmpty: true });
    await expect(
      service.buildDigestText('org-1', 'Empresa', hoursAgo(24), NOW),
    ).resolves.toBeNull();
  });

  it('considers the window open only within the last 23.5 hours', () => {
    expect(WhatsAppDigestService.isWindowOpen(hoursAgo(23), NOW)).toBe(true);
    expect(WhatsAppDigestService.isWindowOpen(hoursAgo(24), NOW)).toBe(false);
    expect(WhatsAppDigestService.isWindowOpen(null, NOW)).toBe(false);
  });
});
