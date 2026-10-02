/** @jest-environment node */

import { NextRequest } from 'next/server';
import { proxyRequest } from './route';

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe('same-origin API proxy', () => {
  const originalBackendUrl = process.env.BACKEND_API_URL;
  const originalTimeout = process.env.BACKEND_PROXY_TIMEOUT_MS;

  beforeEach(() => {
    process.env.BACKEND_API_URL = 'https://backend.internal.example';
    delete process.env.BACKEND_PROXY_TIMEOUT_MS;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterAll(() => {
    if (originalBackendUrl === undefined) delete process.env.BACKEND_API_URL;
    else process.env.BACKEND_API_URL = originalBackendUrl;
    if (originalTimeout === undefined) delete process.env.BACKEND_PROXY_TIMEOUT_MS;
    else process.env.BACKEND_PROXY_TIMEOUT_MS = originalTimeout;
  });

  it('uses a fixed backend and preserves path, query and status', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response('missing', { status: 404 }));
    const request = new NextRequest('https://tinotime.com/api/tasks/list?page=2');

    const response = await proxyRequest(request, context(['tasks', 'list']));

    expect(global.fetch).toHaveBeenCalledWith(
      new URL('https://backend.internal.example/tasks/list?page=2'),
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('missing');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('preserves duplicate query values and safely encodes path segments', async () => {
    await proxyRequest(
      new NextRequest('https://tinotime.com/api/reports/a%20b?tag=one&tag=two&filter=a%2Fb'),
      context(['reports', 'a b']),
    );

    const [target] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(target.toString()).toBe(
      'https://backend.internal.example/reports/a%20b?tag=one&tag=two&filter=a%2Fb',
    );
  });

  it('preserves JSON request bodies and required headers only', async () => {
    const request = new NextRequest('https://tinotime.com/api/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://tinotime.com',
        'content-type': 'application/json',
        cookie: 'access_token=test',
        host: 'attacker.example',
        'x-forwarded-host': 'attacker.example',
        'x-organization-id': 'org-1',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    await proxyRequest(request, context(['auth', 'login']));

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('cookie')).toBe('access_token=test');
    expect(headers.get('x-organization-id')).toBe('org-1');
    expect(headers.get('host')).toBeNull();
    expect(headers.get('x-forwarded-host')).toBeNull();
    expect(await new Response(init.body).text()).toBe('{"email":"user@example.com"}');
  });

  it('forwards urlencoded bodies without forwarding transport headers', async () => {
    const request = new NextRequest('https://tinotime.com/api/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://tinotime.com',
        'content-type': 'application/x-www-form-urlencoded',
        'content-encoding': 'gzip',
        'content-length': '999',
      },
      body: 'email=user%40example.com&password=test',
    });

    await proxyRequest(request, context(['auth', 'login']));

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('content-encoding')).toBeNull();
    expect(headers.get('content-length')).toBeNull();
    expect(await new Response(init.body).text()).toContain('email=user%40example.com');
  });

  it('streams multipart requests and download response headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response('file-bytes', {
        status: 206,
        headers: {
          'content-type': 'application/octet-stream',
          'content-disposition': 'attachment; filename="report.bin"',
          'content-range': 'bytes 0-9/10',
        },
      }),
    );
    const request = new NextRequest('https://tinotime.com/api/uploads', {
      method: 'POST',
      headers: {
        origin: 'https://tinotime.com',
        'content-type': 'multipart/form-data; boundary=test',
      },
      body: '--test\r\ncontent\r\n--test--',
    });

    const response = await proxyRequest(request, context(['uploads']));

    expect(response.status).toBe(206);
    expect(response.headers.get('content-disposition')).toContain('report.bin');
    expect(await response.text()).toBe('file-bytes');
  });

  it('preserves HttpOnly cookies and strips an upstream Domain attribute', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: {
          location: 'https://tinotime.com/login?google=success',
          'set-cookie': 'access_token=test; Domain=run.app; Path=/; HttpOnly; Secure; SameSite=Lax',
        },
      }),
    );

    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/auth/google/continue/callback?code=x&state=y'),
      context(['auth', 'google', 'continue', 'callback']),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).not.toMatch(/Domain=/i);
  });

  it('preserves multiple Set-Cookie values, including an Expires comma', async () => {
    const headers = new Headers();
    headers.append(
      'set-cookie',
      'access_token=one; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Domain=run.app; Path=/; HttpOnly',
    );
    headers.append('set-cookie', 'refresh_token=two; Domain=run.app; Path=/; HttpOnly');
    (global.fetch as jest.Mock).mockResolvedValueOnce(new Response(null, { status: 204, headers }));

    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/auth/refresh'),
      context(['auth', 'refresh']),
    );

    const cookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('Expires=Wed, 21 Oct 2030 07:28:00 GMT');
    expect(cookies.join(';')).not.toMatch(/Domain=/i);
  });

  it('rewrites backend redirects to the same-origin proxy', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'https://backend.internal.example/auth/callback?code=ok' },
      }),
    );

    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/auth/start'),
      context(['auth', 'start']),
    );

    expect(response.headers.get('location')).toBe('https://tinotime.com/api/auth/callback?code=ok');
  });

  it('allows the exact Google authorization origin', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=safe' },
      }),
    );

    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/auth/google/login'),
      context(['auth', 'google', 'login']),
    );

    expect(response.headers.get('location')).toContain('https://accounts.google.com/');
  });

  it('rejects arbitrary redirects and token-bearing Locations', async () => {
    for (const location of [
      'https://evil.example/steal',
      'https://tinotime.com/login#access_token=secret',
    ]) {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location } }),
      );
      const response = await proxyRequest(
        new NextRequest('https://tinotime.com/api/auth/callback'),
        context(['auth', 'callback']),
      );
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ error: { code: 'API_PROXY_REDIRECT_REJECTED' } });
    }
  });

  it('rejects cross-origin mutations before contacting the backend', async () => {
    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      }),
      context(['auth', 'logout']),
    );

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects mutations without browser origin evidence', async () => {
    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/auth/logout', { method: 'POST' }),
      context(['auth', 'logout']),
    );

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('cannot be turned into an open proxy through the requested path', async () => {
    await proxyRequest(
      new NextRequest('https://tinotime.com/api/https%3A%2F%2Fevil.example/steal'),
      context(['https://evil.example', 'steal']),
    );

    const [target] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(target.origin).toBe('https://backend.internal.example');
    expect(target.pathname).toContain('https%3A%2F%2Fevil.example');
  });

  it('returns a stable error when the backend is unavailable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'));

    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/health'),
      context(['health']),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: 'API_PROXY_UNAVAILABLE' } });
  });

  it('returns 504 on timeout', async () => {
    jest.useFakeTimers();
    try {
      process.env.BACKEND_PROXY_TIMEOUT_MS = '5';
      (global.fetch as jest.Mock).mockImplementationOnce(
        (_target: URL, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      );

      const responsePromise = proxyRequest(
        new NextRequest('https://tinotime.com/api/slow'),
        context(['slow']),
      );
      await jest.advanceTimersByTimeAsync(5);
      const response = await responsePromise;

      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({ error: { code: 'API_PROXY_TIMEOUT' } });
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels the upstream request when the browser disconnects', async () => {
    const browser = new AbortController();
    let upstreamSignal: AbortSignal | null | undefined;
    (global.fetch as jest.Mock).mockImplementationOnce(
      (_target: URL, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          upstreamSignal = init.signal;
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const request = new NextRequest('https://tinotime.com/api/slow');
    Object.defineProperty(request, 'signal', { value: browser.signal });
    const responsePromise = proxyRequest(request, context(['slow']));

    await Promise.resolve();
    browser.abort();
    const response = await responsePromise;

    expect(upstreamSignal?.aborted).toBe(true);
    expect(response.status).toBe(502);
  });

  it('does not return a body or compressed transport metadata for HEAD', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response('compressed', {
        headers: { 'content-encoding': 'gzip', 'content-length': '10', 'content-type': 'text/plain' },
      }),
    );

    const response = await proxyRequest(
      new NextRequest('https://tinotime.com/api/health', { method: 'HEAD' }),
      context(['health']),
    );

    expect(response.body).toBeNull();
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
  });
});
