import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { TrelloWebhookController } from './trello-webhook.controller';
import { TrelloWebhookService } from './trello-webhook.service';

describe('TrelloWebhookController', () => {
  it('answers the HEAD verification without doing anything', () => {
    const webhooks = { handle: jest.fn() };
    const controller = new TrelloWebhookController(
      webhooks as unknown as TrelloWebhookService,
    );

    expect(controller.verify()).toBeUndefined();
    expect(webhooks.handle).not.toHaveBeenCalled();
  });

  it('passes the raw body and the Trello signature to the service', async () => {
    const webhooks = { handle: jest.fn().mockResolvedValue('PROCESSED') };
    const controller = new TrelloWebhookController(
      webhooks as unknown as TrelloWebhookService,
    );
    const rawBody = Buffer.from('{"action":{}}');
    const payload = { action: { id: 'a', type: 't', data: {} } };

    await expect(
      controller.receive(
        'conn-1',
        { rawBody } as RawBodyRequest<Request>,
        'sig',
        payload,
      ),
    ).resolves.toEqual({ received: true, result: 'PROCESSED' });
    expect(webhooks.handle).toHaveBeenCalledWith(
      'conn-1',
      rawBody,
      'sig',
      payload,
    );
  });
});
