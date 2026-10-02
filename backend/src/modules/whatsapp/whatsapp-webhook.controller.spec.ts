/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

const SECRET = 'app-secret';
const VERIFY_TOKEN = 'verify-token';

describe('WhatsAppWebhookController', () => {
  let whatsapp: any;
  let controller: WhatsAppWebhookController;

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = SECRET;
    process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'channel-1';
    whatsapp = { handleWebhook: jest.fn().mockResolvedValue(undefined) };
    controller = new WhatsAppWebhookController(whatsapp as never);
  });

  afterEach(() => {
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  describe('verify', () => {
    it('returns the challenge when the token matches', () => {
      const response = { type: jest.fn().mockReturnThis(), send: jest.fn() };
      controller.verify(
        {
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': '1158201444',
        },
        response as never,
      );
      expect(response.type).toHaveBeenCalledWith('text/plain');
      expect(response.send).toHaveBeenCalledWith('1158201444');
    });

    it('rejects a wrong verify token', () => {
      expect(() =>
        controller.verify(
          {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'otro',
            'hub.challenge': '1158201444',
          },
          {} as never,
        ),
      ).toThrow(ForbiddenException);
    });
  });

  it('fails explicitly when verification is not configured', () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    expect(() => controller.verify({}, {} as never)).toThrow(
      ServiceUnavailableException,
    );
  });

  it.each(['WHATSAPP_APP_SECRET', 'WHATSAPP_PHONE_NUMBER_ID'])(
    'fails closed without %s',
    async (key) => {
      delete process.env[key];
      await expect(
        controller.receive({} as never, undefined, {}),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(whatsapp.handleWebhook).not.toHaveBeenCalled();
    },
  );

  describe('receive', () => {
    const payload = { object: 'whatsapp_business_account', entry: [] };
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const signature = `sha256=${createHmac('sha256', SECRET).update(rawBody).digest('hex')}`;

    it('processes a payload signed by Meta', async () => {
      await expect(
        controller.receive({ rawBody } as never, signature, payload),
      ).resolves.toEqual({ received: true });
      expect(whatsapp.handleWebhook).toHaveBeenCalledWith(payload);
    });

    it('rejects a payload with an invalid signature', async () => {
      await expect(
        controller.receive({ rawBody } as never, 'sha256=00', payload),
      ).rejects.toThrow(ForbiddenException);
      expect(whatsapp.handleWebhook).not.toHaveBeenCalled();
    });

    it('rejects a payload with no signature at all', async () => {
      await expect(
        controller.receive({ rawBody } as never, undefined, payload),
      ).rejects.toThrow(ForbiddenException);
      expect(whatsapp.handleWebhook).not.toHaveBeenCalled();
    });

    it('rejects when the raw body is not available', async () => {
      await expect(
        controller.receive({} as never, signature, payload),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
