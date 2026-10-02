import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'cookie',
  'if-match',
  'if-none-match',
  'range',
  'user-agent',
  'x-organization-id',
] as const;

const RESPONSE_HEADERS = [
  'accept-ranges',
  'content-disposition',
  'content-language',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
  'location',
  'vary',
] as const;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_TIMEOUT_MS = 30_000;

type RouteContext = { params: Promise<{ path: string[] }> };

function backendBaseUrl() {
  const configured = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, '');
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function sameOriginRequest(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return true;
  const source = request.headers.get('origin') || request.headers.get('referer');
  if (!source) return request.headers.get('sec-fetch-site') === 'same-origin';

  try {
    return new URL(source).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function sanitizeSetCookie(cookie: string) {
  return cookie.replace(/;\s*Domain=[^;]*/gi, '');
}

function getSetCookies(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof extended.getSetCookie === 'function') return extended.getSetCookie();
  const value = headers.get('set-cookie');
  // Some Fetch implementations expose all Set-Cookie values as one string. A
  // cookie separator is a comma followed by a new cookie-pair; the comma in an
  // Expires date is therefore left untouched.
  return value ? value.split(/,(?=\s*[^;,\s]+=)/) : [];
}

function hasSensitiveRedirectData(url: URL) {
  const sensitiveKeys = new Set(['access_token', 'refresh_token', 'id_token']);
  if ([...url.searchParams.keys()].some((key) => sensitiveKeys.has(key.toLowerCase()))) return true;

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  return [...fragment.keys()].some((key) => sensitiveKeys.has(key.toLowerCase()));
}

function safeLocation(location: string, request: NextRequest, backend: URL) {
  let target: URL;
  try {
    target = new URL(location, backend);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(target.protocol) || hasSensitiveRedirectData(target)) return null;

  if (target.origin === backend.origin) {
    return new URL(`/api${target.pathname}${target.search}${target.hash}`, request.nextUrl.origin).toString();
  }

  if (target.origin === request.nextUrl.origin || target.origin === 'https://accounts.google.com') {
    return target.toString();
  }

  const tinoHosts = new Set(['tinotime.com', 'www.tinotime.com']);
  if (tinoHosts.has(request.nextUrl.hostname) && tinoHosts.has(target.hostname) && target.protocol === 'https:') {
    return new URL(`${target.pathname}${target.search}${target.hash}`, request.nextUrl.origin).toString();
  }

  return null;
}

function proxyTimeoutMs() {
  const configured = Number(process.env.BACKEND_PROXY_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

export async function proxyRequest(request: NextRequest, context: RouteContext) {
  const backend = backendBaseUrl();
  if (!backend) {
    return NextResponse.json(
      { error: { code: 'API_PROXY_NOT_CONFIGURED', message: 'API no configurada' } },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  if (!sameOriginRequest(request)) {
    return NextResponse.json(
      { error: { code: 'CSRF_ORIGIN_REJECTED', message: 'Origen no permitido' } },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    );
  }

  const { path } = await context.params;
  if (!Array.isArray(path) || path.length === 0 || path.some((part) => !part || part === '.' || part === '..')) {
    return NextResponse.json(
      { error: { code: 'API_PATH_INVALID', message: 'Ruta de API invalida' } },
      { status: 400, headers: { 'cache-control': 'no-store' } },
    );
  }

  const target = new URL(path.map(encodeURIComponent).join('/'), backend);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, proxyTimeoutMs());
  const cancelUpstream = () => controller.abort();
  if (request.signal.aborted) controller.abort();
  else request.signal.addEventListener('abort', cancelUpstream, { once: true });

  try {
    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      redirect: 'manual',
      signal: controller.signal,
    };
    if (BODY_METHODS.has(request.method) && request.body) {
      init.body = request.body;
      init.duplex = 'half';
    }

    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    const location = upstream.headers.get('location');
    if (location) {
      const safeRedirect = safeLocation(location, request, backend);
      if (!safeRedirect) {
        return NextResponse.json(
          { error: { code: 'API_PROXY_REDIRECT_REJECTED', message: 'Redireccion no permitida' } },
          { status: 502, headers: { 'cache-control': 'no-store' } },
        );
      }
      responseHeaders.set('location', safeRedirect);
    }
    for (const cookie of getSetCookies(upstream.headers)) {
      responseHeaders.append('set-cookie', sanitizeSetCookie(cookie));
    }
    responseHeaders.set('cache-control', 'no-store');

    return new NextResponse(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut =
      didTimeout && typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
    return NextResponse.json(
      {
        error: {
          code: timedOut ? 'API_PROXY_TIMEOUT' : 'API_PROXY_UNAVAILABLE',
          message: timedOut ? 'La API excedio el tiempo de espera' : 'La API no esta disponible',
        },
      },
      { status: timedOut ? 504 : 502, headers: { 'cache-control': 'no-store' } },
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', cancelUpstream);
  }
}

export const GET = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
