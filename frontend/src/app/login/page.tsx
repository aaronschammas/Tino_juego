'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ApiClientError, apiGet } from '@/lib/api';
import { clearClientSession } from '@/lib/session-cleanup';
import { User } from '@/types/user';

interface GoogleLoginUrlResponse {
  url: string;
}

interface OrganizationBootstrap {
  workspaceState?: {
    hasAccessibleProjects: boolean;
  };
}

const GOOGLE_LOGIN_REASON_LABELS: Record<string, string> = {
  missing_params: 'Faltan parámetros del callback de Google.',
  invalid_state: 'La sesión de Google expiró. Intentá nuevamente.',
  oauth_not_configured: 'Google OAuth no está configurado en el backend.',
  oauth_exchange_failed: 'No se pudo validar el login con Google.',
  invalid_google_profile: 'El perfil de Google no es válido.',
  missing_access_token: 'Google no devolvió un token válido.',
  google_already_linked: 'Esta cuenta de Google está vinculada a otro usuario.',
  inactive_user: 'Tu usuario está inactivo. Contactá a un administrador.',
  account_not_registered: 'No se pudo continuar con Google para este correo.',
  user_without_organization: 'Tu cuenta no pertenece a una organización. Solicitá una invitación.',
  provider_cancelled: 'Cancelaste el acceso con Google.',
};

function sanitizeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';

  try {
    const parsed = new URL(next, 'http://tino.local');
    parsed.searchParams.delete('google');
    parsed.searchParams.delete('reason');
    parsed.searchParams.delete('token');

    const normalizedPath = parsed.pathname + (parsed.search ? parsed.search : '');
    if (normalizedPath === '/login') return '/dashboard';
    return normalizedPath;
  } catch {
    return '/dashboard';
  }
}

function googleSessionErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) {
    return 'Google completo el acceso, pero no se recibio una sesion valida. Intenta nuevamente.';
  }
  if (error instanceof ApiClientError && error.status === undefined) {
    return 'No se pudo conectar con Tino para validar la sesion. Revisa tu conexion e intenta nuevamente.';
  }
  return 'No se pudo completar el inicio de sesion con Google.';
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, user, isLoading: authLoading, refreshContext } = useAuth();
  const [loginStatus, setLoginStatus] = useState<'idle' | 'validating' | 'syncing' | 'redirecting' | 'error'>('idle');

  const statusMessages = {
    validating: 'Validando credenciales...',
    syncing: 'Sincronizando perfil...',
    redirecting: 'Preparando tu dashboard...',
    idle: 'Verificando acceso',
    error: 'Error de verificación'
  };

  const googleStatus = searchParams.get('google');
  const googleReason = searchParams.get('reason');
  const hasNextParam = Boolean(searchParams.get('next'));

  const nextPath = useMemo(() => {
    return sanitizeNextPath(searchParams.get('next'));
  }, [searchParams]);



  /**
   * Fuerza navegación completa al dashboard tras autenticación exitosa.
   * Evita estados intermedios donde la ruta `/login` queda visible hasta refrescar.
   * @returns No retorna valor; redirige el navegador a `/dashboard`.
   */
  /**
   * Resuelve el destino posterior al login según estado de onboarding.
   * @param authenticatedUser Usuario autenticado con estado de organización/plan.
   * @returns No retorna valor; navega a la ruta correspondiente.
   */
  const redirectAfterAuth = useCallback(async (authenticatedUser: User) => {
    if (authenticatedUser.requiresInternalPasswordSetup) {
      router.replace('/auth/setup-password');
      return;
    }

    if (!authenticatedUser.organizationId) {
      router.replace(`/register?step=organization&userId=${encodeURIComponent(authenticatedUser.id)}`);
      return;
    }

    const planName = typeof authenticatedUser.organizationPlan === 'string' 
      ? authenticatedUser.organizationPlan 
      : authenticatedUser.organizationPlan?.name;

    if (!planName || planName === '') {
      router.replace(`/register?step=plan&userId=${encodeURIComponent(authenticatedUser.id)}`);
      return;
    }

    if (hasNextParam) {
      router.replace(nextPath);
      return;
    }

    try {
      const organization = await apiGet<OrganizationBootstrap>('/orgs/me');
      router.replace(
        organization.workspaceState?.hasAccessibleProjects === false
          ? '/projects'
          : nextPath,
      );
    } catch {
      router.replace(nextPath);
    }
  }, [hasNextParam, nextPath, router]);

  const googleLoginExecuted = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const completeGoogleLogin = async () => {
      if (googleStatus !== 'success' || googleLoginExecuted.current) return;
      googleLoginExecuted.current = true;

      try {
        setLoginStatus('validating');
        setIsGoogleLoading(true);
        setError('');
        
        const context = await refreshContext();
        if (!context) {
          if (isMounted) setIsGoogleLoading(false);
          return;
        }
        
        setLoginStatus('syncing');
        
        if (isMounted) {
          setLoginStatus('redirecting');
        }
      } catch (err) {
        clearClientSession();
        if (isMounted) {
          setLoginStatus('error');
          setError(googleSessionErrorMessage(err));
          setIsGoogleLoading(false);
        }
      }
    };

    completeGoogleLogin();

    return () => {
      isMounted = false;
    };
  }, [googleStatus, refreshContext]);

  useEffect(() => {
    if (googleStatus === 'error') {
      setError(
        GOOGLE_LOGIN_REASON_LABELS[googleReason || ''] ||
          'No se pudo iniciar sesión con Google.',
      );
      setIsGoogleLoading(false);
    }
  }, [googleReason, googleStatus]);

  useEffect(() => {
    if (!authLoading && user) {
      void redirectAfterAuth(user);
    }
  }, [authLoading, redirectAfterAuth, user]);

  if (authLoading || isGoogleLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-md border border-slate-100">
            <Image
              src="/logo-tino.png"
              alt="Tino"
              width={64}
              height={64}
              className="h-full w-full object-contain p-2 opacity-80"
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[15px] font-bold text-slate-800 tracking-tight">
              {statusMessages[loginStatus]}
            </p>
            <div className="h-1 w-32 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#0033ff] w-1/2 rounded-full animate-loading" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
      // La redirección será manejada por el useEffect al detectar el cambio en el estado 'user'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setError('');
      clearClientSession();
      const response = await apiGet<GoogleLoginUrlResponse>(
        `/auth/google/continue-url?returnTo=${encodeURIComponent(nextPath)}`,
      );
      window.location.href = response.url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar el login con Google',
      );
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-indigo-100 to-white px-4">
      <div className="bg-white w-full max-w-md rounded-[2rem] p-8 sm:p-10 shadow-2xl relative">
        <div className="space-y-2 mb-8">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">
            LOGIN
          </p>
          <h2 className="text-2xl font-bold text-slate-900">
            Ingresa a tu cuenta
          </h2>
          <p className="text-sm text-slate-500">
            Usa tus credenciales para acceder al entorno privado de Tino
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm text-slate-600"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#eef2f9] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0033ff] outline-none"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm text-slate-600"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#eef2f9] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0033ff] outline-none pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex flex-col gap-1 transition-all duration-200 ease-in-out shadow-sm">
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div className="flex flex-col gap-1 w-full">
                  <span className="font-medium leading-tight">{error}</span>
                  {googleReason && (
                    <button 
                      type="button"
                      onClick={() => setShowDetails(!showDetails)}
                      className="text-[11px] text-red-500 hover:text-red-700 underline text-left w-fit font-medium"
                    >
                      {showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}
                    </button>
                  )}
                  {showDetails && googleReason && (
                    <div className="mt-1 p-2 bg-red-100/50 rounded-lg border border-red-200/50 text-[10px] font-mono break-all text-red-800/80 animate-in fade-in slide-in-from-top-1 duration-200">
                      Error ID: <span className="font-bold">{googleReason}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-[#0033ff] text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition-colors disabled:opacity-70"
            >
              {isLoading ? 'Ingresando...' : 'Ingresar al workspace'}
            </button>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
              className="w-full flex justify-center items-center gap-2 bg-white text-slate-700 border border-slate-200 shadow-sm rounded-xl py-3 font-medium hover:bg-slate-50 transition-colors disabled:opacity-70"
            >
              {isGoogleLoading ? (
                'Redirigiendo...'
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
                  Continuar con Google
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 pt-2">
            <Link href="/" className="text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors">
              ← Volver a la pantalla principal
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-surface-page) px-4">
      <div className="rounded-3xl border border-(--color-border-soft) bg-white px-6 py-5 text-sm font-medium text-(--color-ink-700) shadow-(--shadow-card)">
        Cargando acceso...
      </div>
    </div>
  );
}
