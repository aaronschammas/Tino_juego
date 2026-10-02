/**
 * Prueba HTTP real del endpoint que llama Cloud Scheduler, con la misma
 * configuracion global que `main.ts`: sin sesion de Tino, protegido solo por el
 * header `X-Reconcile-Token`.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import { ResponseTransformInterceptor } from 'src/common/interceptors/response-transform.interceptor';
import { IntegrationsConfig } from './integrations.config';
import { IntegrationsReconcileController } from './integrations-reconcile.controller';
import { TrelloReconcileService } from './providers/trello/trello-reconcile.service';

describe('Integrations reconcile endpoint over HTTP', () => {
  const reconcileAll = jest.fn().mockResolvedValue({
    status: 'OK',
    processed: 1,
    succeeded: 1,
    failed: 0,
    results: [],
  });
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [IntegrationsReconcileController],
      providers: [
        { provide: TrelloReconcileService, useValue: { reconcileAll } },
        {
          provide: IntegrationsConfig,
          useValue: new IntegrationsConfig({
            INTEGRATIONS_RECONCILE_TOKEN: 'scheduler-secret',
          }),
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

  beforeEach(() => reconcileAll.mockClear());

  it('runs the daily review with the scheduler token', async () => {
    const response = await request(server)
      .post('/integrations/reconcile')
      .set('X-Reconcile-Token', 'scheduler-secret')
      .expect(200);

    expect(JSON.stringify(response.body)).toContain('"processed":1');
    expect(reconcileAll).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['without token', undefined],
    ['with a wrong token', 'guess'],
  ])('rejects a call %s', async (_label, token) => {
    const call = request(server).post('/integrations/reconcile');
    if (token) call.set('X-Reconcile-Token', token);

    await call.expect(401);
    expect(reconcileAll).not.toHaveBeenCalled();
  });
});
