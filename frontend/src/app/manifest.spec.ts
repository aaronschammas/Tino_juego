import manifest from './manifest';

describe('PWA manifest', () => {
  it('opens the mobile shell as a standalone application with required icons', () => {
    const result = manifest();
    expect(result).toEqual(expect.objectContaining({ start_url: '/mobile', scope: '/', display: 'standalone', prefer_related_applications: false }));
    expect(result.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/tino-pwa-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/tino-pwa-512.png', sizes: '512x512' }),
      expect.objectContaining({ src: '/tino-pwa-maskable-512.png', purpose: 'maskable' }),
    ]));
  });
});
