import { NextRequest, NextResponse } from 'next/server';

/**
 * Reenvia el callback OAuth unificado de Google al proxy first-party preservando los query params.
 * @param request Solicitud entrante del callback recibido en el frontend.
 * @returns Redireccion interna al proxy de API.
 */
export async function GET(request: NextRequest) {
  const callbackUrl = new URL('/api/auth/google/continue/callback', request.url);

  request.nextUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.append(key, value);
  });

  return NextResponse.redirect(callbackUrl);
}
