import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppClientService } from './whatsapp-client.service';
import type { WhatsAppWebhookPayload } from './whatsapp.types';

describe('WhatsApp webhook through AppModule', () => {
  let app: INestApplication;
  let linked: boolean;
  let activeOrganization: boolean;
  let feature: boolean;
  let ownerRole: string | null;
  let ownerActive: boolean;
  const savedEnv = { ...process.env };
  const client = {
    sendText: jest.fn(),
    sendMenu: jest.fn(),
    sendTemplate: jest.fn(),
  };
  const lookup = jest.fn();
  const prisma = {
    whatsAppProcessedMessage: { create: jest.fn().mockResolvedValue({}) },
    organization: {
      findMany: lookup,
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    organizationMembership: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    whatsAppLinkCode: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(WhatsAppClientService)
      .useValue(client)
      .compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify';
    process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'channel-1';
    linked = activeOrganization = feature = ownerActive = true;
    ownerRole = 'ORG_OWNER';
    lookup.mockImplementation(({ where }) => {
      expect(where).toEqual({
        whatsappUserId: 'AR.owner',
        isActive: true,
        plan: { hasWhatsApp: true },
      });
      return linked && activeOrganization && feature
        ? [
            {
              id: 'linked-org',
              name: 'Empresa',
              whatsappLinkedByUserId: 'owner-1',
            },
          ]
        : [];
    });
    prisma.user.findUnique.mockImplementation(async () => ({
      isActive: ownerActive,
    }));
    prisma.organizationMembership.findUnique.mockImplementation(async () =>
      ownerRole ? { role: ownerRole } : null,
    );
    client.sendText.mockResolvedValue(true);
    client.sendMenu.mockResolvedValue(true);
  });

  afterAll(async () => {
    await app?.close();
    for (const key of [
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_PHONE_NUMBER_ID',
    ]) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  function payload(channel = 'channel-1'): WhatsAppWebhookPayload {
    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: channel },
                contacts: [{ wa_id: '549110000', user_id: 'AR.owner' }],
                messages: [
                  {
                    id: 'message-1',
                    from: '549110000',
                    text: { body: 'hola' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  function post(body = payload(), signature?: string) {
    const raw = JSON.stringify(body);
    const signed =
      signature ??
      `sha256=${createHmac('sha256', 'test-app-secret').update(raw).digest('hex')}`;
    return request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', signed)
      .send(raw);
  }

  it('returns the exact plain-text challenge with the global interceptor active', async () => {
    const response = await request(app.getHttpServer())
      .get('/whatsapp/webhook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test-verify',
        'hub.challenge': '001158201444',
      })
      .expect(200)
      .expect('Content-Type', /text\/plain/);
    expect(response.text).toBe('001158201444');
    expect(client.sendText).not.toHaveBeenCalled();
  });

  it.each([
    {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong',
      'hub.challenge': '123',
    },
    {
      'hub.mode': 'wrong',
      'hub.verify_token': 'test-verify',
      'hub.challenge': '123',
    },
    { 'hub.mode': 'subscribe', 'hub.verify_token': 'test-verify' },
  ])('rejects an invalid verification request', async (query) => {
    await request(app.getHttpServer())
      .get('/whatsapp/webhook')
      .query(query)
      .expect(403);
  });

  it('preserves the standard envelope on other routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });

  it('accepts a valid raw-body signature and preserves the POST envelope', async () => {
    const response = await post().expect(200);
    expect(response.body).toEqual({ data: { received: true } });
    expect(client.sendMenu).toHaveBeenCalledWith(
      '549110000',
      expect.any(Object),
    );
  });

  it('rejects an invalid signature before any identity lookup', async () => {
    await post(payload(), 'sha256=' + '0'.repeat(64)).expect(403);
    expect(lookup).not.toHaveBeenCalled();
    expect(client.sendMenu).not.toHaveBeenCalled();
  });

  it.each(['different-channel', undefined])(
    'ignores a signed event with an incorrect or missing channel (%s)',
    async (channel) => {
      const body = payload();
      body.entry![0].changes![0].value!.metadata = channel
        ? { phone_number_id: channel }
        : undefined;
      await post(body).expect(200);
      expect(lookup).not.toHaveBeenCalled();
      expect(prisma.whatsAppProcessedMessage.create).not.toHaveBeenCalled();
      expect(client.sendMenu).not.toHaveBeenCalled();
    },
  );

  it('ignores a message without the existing persistent Meta identity', async () => {
    const body = payload();
    body.entry![0].changes![0].value!.contacts![0].user_id = undefined;
    await post(body).expect(200);
    expect(lookup).not.toHaveBeenCalled();
    expect(client.sendText).not.toHaveBeenCalled();
  });

  it.each([
    'unlinked',
    'inactive-org',
    'feature-off',
    'not-owner',
    'inactive-owner',
    'missing-membership',
  ])('does not allow organization queries when %s', async (condition) => {
    if (condition === 'unlinked') linked = false;
    if (condition === 'inactive-org') activeOrganization = false;
    if (condition === 'feature-off') feature = false;
    if (condition === 'not-owner') ownerRole = 'ORG_MEMBER';
    if (condition === 'missing-membership') ownerRole = null;
    if (condition === 'inactive-owner') ownerActive = false;
    await post().expect(200);
    expect(client.sendMenu).not.toHaveBeenCalled();
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it('ignores arbitrary tenant headers and cookies', async () => {
    await post()
      .set('X-Organization-Id', 'attacker-org')
      .set('Cookie', 'active_organization_id=attacker-org')
      .expect(200);
    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['linked-org'] } },
      data: { whatsappLastInboundAt: expect.any(Date) },
    });
  });

  it('refuses a menu selection for an arbitrary organization', async () => {
    const body = payload();
    body.entry![0].changes![0].value!.messages![0] = {
      id: 'selection',
      from: '549110000',
      interactive: { list_reply: { id: 'q:attacker-org:overdue_tasks' } },
    };
    await post(body).expect(200);
    expect(client.sendMenu).not.toHaveBeenCalled();
  });

  it.each(['WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_NUMBER_ID'])(
    'returns 503 without %s',
    async (key) => {
      delete process.env[key];
      await post().expect(503);
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it('returns 503 when the verify token is absent', async () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    await request(app.getHttpServer()).get('/whatsapp/webhook').expect(503);
  });
});
