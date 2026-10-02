/**
 * Prueba HTTP real del webhook de Trello: levanta Nest con la misma
 * configuracion que `main.ts` (rawBody, ValidationPipe global, interceptor y
 * filtro de errores) y envia pedidos firmados como los manda Trello. Asegura que
 * la ruta es publica, que el HEAD de verificacion responde 200 y que la firma se
 * valida sobre el cuerpo original.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import type { Server } from 'http';
import request from 'supertest';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from 'src/common/interceptors/response-transform.interceptor';
import { PrismaService } from 'src/database/prisma.service';
import { IntegrationsConfig } from '../../integrations.config';
import { encryptSecret } from '../../security/token-cipher';
import { IntegrationChangeService } from '../../sync/integration-change.service';
import { TrelloAdapter } from './trello.adapter';
import { TrelloClient } from './trello.client';
import { TrelloWebhookController } from './trello-webhook.controller';
import { TrelloWebhookService } from './trello-webhook.service';
import { TrelloWebhookTranslator } from './trello-webhook-translator';
import { computeTrelloSignature } from './trello-signature';

describe('Trello webhook over HTTP', () => {
  const key = randomBytes(32);
  const connectionId = '22222222-2222-4222-8222-222222222222';
  const baseUrl = 'https://api.tino.test';
  const path = `/integrations/trello/webhook/${connectionId}`;
  const body = JSON.stringify({
    action: {
      id: 'act-http',
      type: 'updateCard',
      data: { card: { id: 'card-1', name: 'Nuevo' }, old: { name: 'Viejo' } },
    },
  });
  const signature = computeTrelloSignature(
    body,
    `${baseUrl}${path}`,
    'app-secret',
  );
  const apply = jest.fn().mockResolvedValue('APPLIED');
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TrelloWebhookController],
      providers: [
        TrelloWebhookService,
        TrelloWebhookTranslator,
        TrelloAdapter,
        { provide: TrelloClient, useValue: {} },
        { provide: IntegrationChangeService, useValue: { apply } },
        {
          provide: IntegrationsConfig,
          useValue: new IntegrationsConfig({
            INTEGRATIONS_ENABLED: 'true',
            TRELLO_API_KEY: 'app-key',
            TRELLO_API_SECRET: 'app-secret',
            INTEGRATIONS_ENCRYPTION_KEY: key.toString('base64'),
            INTEGRATIONS_WEBHOOK_BASE_URL: baseUrl,
          }),
        },
        {
          provide: PrismaService,
          useValue: {
            integrationConnection: {
              findFirst: jest.fn().mockResolvedValue({
                id: connectionId,
                organizationId: 'org-1',
                projectId: 'project-1',
                status: 'ACTIVE',
                accessTokenEnc: encryptSecret('user-token', key),
              }),
              update: jest.fn().mockResolvedValue({}),
            },
            integrationEvent: {
              findUnique: jest.fn().mockResolvedValue(null),
              upsert: jest.fn().mockResolvedValue({}),
            },
          },
        },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as unknown as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the HEAD verification with 200', async () => {
    await request(server).head(path).expect(200);
  });

  it('accepts a correctly signed update and applies it', async () => {
    const response = await request(server)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('X-Trello-Webhook', signature)
      .send(body)
      .expect(200);

    expect(JSON.stringify(response.body)).toContain('PROCESSED');
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1' }),
      {
        kind: 'ITEM_UPDATED',
        externalId: 'card-1',
        changes: { title: 'Nuevo' },
      },
    );
  });

  it('rejects a forged request with 401', async () => {
    await request(server)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('X-Trello-Webhook', 'forged')
      .send(body)
      .expect(401);
  });
});
