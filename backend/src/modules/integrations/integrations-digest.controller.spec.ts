/**
 * Tests del endpoint del resumen diario que llama Cloud Scheduler: token
 * obligatorio, nada que mandar con las integraciones apagadas y, si todo esta
 * bien, delega en `WhatsAppDigestService`.
 */
import { UnauthorizedException } from '@nestjs/common';
import { WhatsAppDigestService } from '../whatsapp/whatsapp-digest.service';
import { IntegrationsConfig } from './integrations.config';
import { IntegrationsDigestController } from './integrations-digest.controller';

describe('IntegrationsDigestController', () => {
  const enabledEnv = {
    INTEGRATIONS_ENABLED: 'true',
    TRELLO_API_KEY: 'app-key',
    INTEGRATIONS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    INTEGRATIONS_RECONCILE_TOKEN: 'scheduler-token',
  };
  let digest: { sendDailyDigests: jest.Mock };

  const build = (env: NodeJS.ProcessEnv) =>
    new IntegrationsDigestController(
      new IntegrationsConfig(env),
      digest as unknown as WhatsAppDigestService,
    );

  beforeEach(() => {
    digest = {
      sendDailyDigests: jest.fn().mockResolvedValue({
        processed: 1,
        results: [{ organizationId: 'org-1', outcome: 'SENT_TEXT' }],
      }),
    };
  });

  it('rejects a missing or wrong token', async () => {
    const controller = build(enabledEnv);

    await expect(controller.run(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.run('otro')).rejects.toThrow(UnauthorizedException);
    expect(digest.sendDailyDigests).not.toHaveBeenCalled();
  });

  it('sends nothing while integrations are turned off', async () => {
    const controller = build({
      ...enabledEnv,
      INTEGRATIONS_ENABLED: 'false',
    });

    await expect(controller.run('scheduler-token')).resolves.toEqual({
      disabled: true,
      processed: 0,
      results: [],
    });
    expect(digest.sendDailyDigests).not.toHaveBeenCalled();
  });

  it('runs the daily digest and returns how it went', async () => {
    await expect(build(enabledEnv).run('scheduler-token')).resolves.toEqual({
      disabled: false,
      processed: 1,
      results: [{ organizationId: 'org-1', outcome: 'SENT_TEXT' }],
    });
  });
});
