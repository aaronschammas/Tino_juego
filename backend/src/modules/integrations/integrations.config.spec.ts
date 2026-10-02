import { randomBytes } from 'crypto';
import { IntegrationsConfig } from './integrations.config';

describe('IntegrationsConfig', () => {
  const validKey = randomBytes(32).toString('base64');
  const ready = {
    INTEGRATIONS_ENABLED: 'true',
    TRELLO_API_KEY: 'trello-key',
    INTEGRATIONS_ENCRYPTION_KEY: validKey,
  };

  it('is ready when the flag, api key and encryption key are set', () => {
    const config = new IntegrationsConfig(ready);

    expect(config.issue()).toBeNull();
    expect(config.trelloApiKey).toBe('trello-key');
    expect(config.encryptionKey()).toHaveLength(32);
  });

  it('is disabled by default so production stays off', () => {
    expect(new IntegrationsConfig({}).issue()).toBe('FEATURE_DISABLED');
    expect(
      new IntegrationsConfig({
        ...ready,
        INTEGRATIONS_ENABLED: 'false',
      }).issue(),
    ).toBe('FEATURE_DISABLED');
  });

  it('accepts the flag regardless of case and spaces', () => {
    expect(
      new IntegrationsConfig({
        ...ready,
        INTEGRATIONS_ENABLED: ' TRUE ',
      }).issue(),
    ).toBeNull();
  });

  it('reports a missing Trello api key', () => {
    expect(
      new IntegrationsConfig({ ...ready, TRELLO_API_KEY: ' ' }).issue(),
    ).toBe('TRELLO_NOT_CONFIGURED');
  });

  it.each([undefined, '', 'short-key', randomBytes(16).toString('base64')])(
    'reports an invalid encryption key (%s)',
    (value) => {
      const config = new IntegrationsConfig({
        ...ready,
        INTEGRATIONS_ENCRYPTION_KEY: value,
      });

      expect(config.encryptionKey()).toBeNull();
      expect(config.issue()).toBe('ENCRYPTION_NOT_CONFIGURED');
    },
  );

  describe('live sync', () => {
    const live = {
      ...ready,
      TRELLO_API_SECRET: 'app-secret',
      INTEGRATIONS_WEBHOOK_BASE_URL: 'https://api.tino.test/',
    };

    it('is ready with secret and public url, and builds the callback url', () => {
      const config = new IntegrationsConfig(live);

      expect(config.liveSyncIssue()).toBeNull();
      expect(config.webhookUrl('conn-1')).toBe(
        'https://api.tino.test/integrations/trello/webhook/conn-1',
      );
    });

    it('reports a missing secret', () => {
      expect(
        new IntegrationsConfig({
          ...live,
          TRELLO_API_SECRET: '',
        }).liveSyncIssue(),
      ).toBe('WEBHOOK_SECRET_MISSING');
    });

    it.each(['', 'not a url', 'ftp://api.tino.test'])(
      'reports an invalid public url (%s)',
      (value) => {
        const config = new IntegrationsConfig({
          ...live,
          INTEGRATIONS_WEBHOOK_BASE_URL: value,
        });

        expect(config.liveSyncIssue()).toBe('WEBHOOK_URL_MISSING');
        expect(config.webhookUrl('conn-1')).toBeNull();
      },
    );

    it('does not affect the base availability', () => {
      expect(new IntegrationsConfig(ready).issue()).toBeNull();
      expect(new IntegrationsConfig(ready).liveSyncIssue()).toBe(
        'WEBHOOK_SECRET_MISSING',
      );
    });
  });

  describe('reconcile token', () => {
    it('accepts only the configured token', () => {
      const config = new IntegrationsConfig({
        INTEGRATIONS_RECONCILE_TOKEN: ' scheduler-secret ',
      });

      expect(config.isValidReconcileToken('scheduler-secret')).toBe(true);
      expect(config.isValidReconcileToken('scheduler-secreT')).toBe(false);
      expect(config.isValidReconcileToken('short')).toBe(false);
      expect(config.isValidReconcileToken(undefined)).toBe(false);
    });

    it('rejects everything when no token is configured', () => {
      expect(new IntegrationsConfig({}).isValidReconcileToken('')).toBe(false);
      expect(new IntegrationsConfig({}).isValidReconcileToken('x')).toBe(false);
    });
  });
});
