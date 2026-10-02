import {
  buildWhatsAppLinkUrl,
  DEFAULT_DIGEST_TEMPLATE_LANGUAGE,
  DEFAULT_GRAPH_VERSION,
  isWhatsAppReady,
  readWhatsAppConfig,
} from './whatsapp.config';

const KEYS = [
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_BUSINESS_NUMBER',
  'WHATSAPP_GRAPH_API_VERSION',
  'WHATSAPP_DIGEST_TEMPLATE',
  'WHATSAPP_DIGEST_TEMPLATE_LANGUAGE',
];

describe('whatsapp config', () => {
  afterEach(() => {
    for (const key of KEYS) delete process.env[key];
  });

  it('reads and trims the environment, with a default Graph API version', () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = ' 123 ';
    process.env.WHATSAPP_BUSINESS_NUMBER = '+1 555 166 1489 ';

    expect(readWhatsAppConfig()).toEqual(
      expect.objectContaining({
        phoneNumberId: '123',
        businessNumber: '+1 555 166 1489',
        graphVersion: DEFAULT_GRAPH_VERSION,
      }),
    );
  });

  it('uses the Graph API version from the environment', () => {
    process.env.WHATSAPP_GRAPH_API_VERSION = 'v25.0';

    expect(readWhatsAppConfig().graphVersion).toBe('v25.0');
  });

  it('has no digest template by default and reads it from the environment', () => {
    expect(readWhatsAppConfig()).toMatchObject({
      digestTemplate: undefined,
      digestTemplateLanguage: DEFAULT_DIGEST_TEMPLATE_LANGUAGE,
    });

    process.env.WHATSAPP_DIGEST_TEMPLATE = ' tino_resumen_trello ';
    process.env.WHATSAPP_DIGEST_TEMPLATE_LANGUAGE = 'es';
    expect(readWhatsAppConfig()).toMatchObject({
      digestTemplate: 'tino_resumen_trello',
      digestTemplateLanguage: 'es',
    });
  });

  it('is ready only when the four credentials are present', () => {
    const complete = {
      phoneNumberId: 'id',
      accessToken: 'token',
      appSecret: 'secret',
      verifyToken: 'verify',
      graphVersion: 'v25.0',
      digestTemplateLanguage: 'es_AR',
    };

    expect(isWhatsAppReady(complete)).toBe(true);
    expect(isWhatsAppReady({ ...complete, accessToken: undefined })).toBe(
      false,
    );
    expect(isWhatsAppReady({ ...complete, appSecret: '' })).toBe(false);
    expect(isWhatsAppReady({ ...complete, verifyToken: undefined })).toBe(
      false,
    );
    expect(isWhatsAppReady({ ...complete, phoneNumberId: undefined })).toBe(
      false,
    );
  });

  it('builds the wa.me link with only the digits of the number', () => {
    expect(buildWhatsAppLinkUrl('ABCDEFGHJK', '+1 (555) 166-1489')).toBe(
      'https://wa.me/15551661489?text=VINCULAR%20ABCDEFGHJK',
    );
  });

  it('returns no link without a usable business number', () => {
    expect(buildWhatsAppLinkUrl('ABCDEFGHJK', undefined)).toBeNull();
    expect(buildWhatsAppLinkUrl('ABCDEFGHJK', '+ -')).toBeNull();
  });
});
