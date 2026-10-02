'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandMark from '@/components/brand/BrandMark';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { clearClientSession } from '@/lib/session-cleanup';
import { LoginResponse } from '@/types/user';
import { Plan } from '@/types/organization';
import { useOrganizations } from '@/hooks/useOrganizations';


interface GoogleLoginUrlResponse {
  url: string;
}

interface RegisterInitResponse {
  userId: string;
}

interface OrganizationMeResponse {
  id: string;
  name: string;
  plan: string | null;
}

type RegisterStep = 'identity' | 'organization' | 'plan' | 'blocked';


export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading, updateUser, refreshContext } = useAuth();
  const { getPlans } = useOrganizations();
  const [dbPlans, setDbPlans] = useState<Plan[]>([]);
  const [step, setStep] = useState<RegisterStep>('identity');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [plan, setPlan] = useState<string>('free');

  useEffect(() => {
    getPlans().then(setDbPlans).catch(console.error);
  }, [getPlans]);

  const sortedPlans = useMemo(() => {
    const order = ['free', 'pro', 'max'];
    return [...dbPlans].sort((a, b) => {
      const indexA = order.indexOf(a.name.toLowerCase());
      const indexB = order.indexOf(b.name.toLowerCase());
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  }, [dbPlans]);

  const resumeStep = searchParams.get('step');
  const resumeUserId = searchParams.get('userId');
  const isResumingPlanOnboarding = resumeStep === 'plan' && Boolean(resumeUserId) && !user;
  const isResumingOrganizationOnboarding = resumeStep === 'organization' && Boolean(resumeUserId) && !user;
  const googleStatus = searchParams.get('google');
  const googleReason = searchParams.get('reason');

  useEffect(() => {
    let isMounted = true;

    const completeGoogleRegister = async () => {
      if (googleStatus !== 'success') return;

      try {
        setIsGoogleLoading(true);
        setError('');
        const currentUser = await apiGet<LoginResponse['user']>('/users/me');

        updateUser(currentUser);

        if (isMounted) {
          router.replace('/register?step=organization');
        }
      } catch {
        clearClientSession();
        if (isMounted) {
          setError('No se pudo completar el registro con Google.');
          setIsGoogleLoading(false);
        }
      }
    };

    completeGoogleRegister();

    return () => {
      isMounted = false;
    };
  }, [googleStatus, router, updateUser]);

  useEffect(() => {
    if (googleStatus === 'error') {
      setError(
        googleReason === 'account_not_registered'
          ? 'Tu cuenta de Google todavía no tenía un alta previa. Se creó el acceso y podés continuar.'
          : 'No se pudo iniciar el registro con Google.',
      );
      setIsGoogleLoading(false);
    }
  }, [googleReason, googleStatus]);

  useEffect(() => {
    if (authLoading || !user) return;

    if (!user.organizationId) {
      setCreatedUserId(user.id);
      setName(user.name || '');
      setLastname(user.lastname || '');
      setEmail(user.email || '');
      setStep('organization');
      return;
    }

    const planName = typeof user.organizationPlan === 'string' 
      ? user.organizationPlan 
      : user.organizationPlan?.name;

    if (!planName || planName === '') {
      setCreatedUserId(user.id);
      setStep('plan');
      void apiGet<OrganizationMeResponse>('/orgs/me')
        .then((org) => setOrganizationName(org.name))
        .catch(() => undefined);
      return;
    }

    router.replace('/dashboard');
  }, [authLoading, router, user]);

  useEffect(() => {
    if (authLoading || user) return;

    if ((resumeStep === 'organization' || resumeStep === 'plan') && resumeUserId) {
      setCreatedUserId(resumeUserId);
      setStep(resumeStep === 'plan' ? 'plan' : 'organization');
    }
  }, [authLoading, resumeStep, resumeUserId, user]);

  const stepLabels = useMemo(
    () => [
      { value: 'identity' as const, label: 'Datos' },
      { value: 'organization' as const, label: 'Organización' },
      { value: 'plan' as const, label: 'Plan' },
    ],
    [],
  );

  const activeUserId = createdUserId ?? user?.id ?? null;

  const exitOnboarding = async (
    event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    destination: '/' | '/login',
  ) => {
    if (user && !user.organizationId) {
      event.preventDefault();
      try {
        await apiPost('/auth/logout', undefined, {
          skipAuthRedirect: true,
          silent: true,
          suppressStatuses: [401],
        });
      } catch {
        // La sesion puede haber expirado; la limpieza local igual debe avanzar.
      } finally {
        clearClientSession();
        router.replace(destination);
      }
      return;
    }

    clearClientSession();
  };

  const handleGoogleRegister = async () => {
    try {
      setError('');
      setIsGoogleLoading(true);
      const response = await apiGet<GoogleLoginUrlResponse>(
        `/auth/google/register-url?returnTo=${encodeURIComponent('/register?step=organization')}`,
      );
      window.location.href = response.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el registro con Google.');
      setIsGoogleLoading(false);
    }
  };

  const handleIdentitySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiPost<RegisterInitResponse>('/auth/register/init', {
        nombre: name.trim(),
        apellido: lastname.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setCreatedUserId(response.userId);
      setStep('organization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrganizationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeUserId) {
      setError('No se pudo resolver el usuario para continuar el registro.');
      return;
    }

    if (user?.organizationId) {
      setError('Tu usuario ya pertenece a una organización.');
      setStep('blocked');
      return;
    }

    if (!organizationName.trim()) {
      setError('Ingresá el nombre de la organización para continuar.');
      return;
    }

    setError('');
    setStep('plan');
  };

  const handleCompleteRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeUserId) {
      setError('No se pudo resolver el usuario para completar el registro.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (user?.organizationId) {
        await apiPatch<OrganizationMeResponse>('/orgs/plan', {
          plan,
        });

        await refreshContext();
        router.replace('/dashboard');
        return;
      }

      await apiPost<LoginResponse>('/auth/register/complete', {
        userId: activeUserId,
        organizationName: organizationName.trim(),
        plan,
      });
      await refreshContext();
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--color-surface-page) px-4">
        <div className="rounded-3xl border border-(--color-border-soft) bg-white px-6 py-5 text-sm font-medium text-(--color-ink-700) shadow-(--shadow-card)">
          Cargando registro...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-indigo-100 to-white px-4 py-12">
      <div className="bg-white w-full max-w-md rounded-[2rem] p-8 sm:p-10 shadow-2xl relative">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Registro</p>
            <h2 className="text-2xl font-bold text-slate-900">Crea tu acceso y organización</h2>
            <p className="text-sm text-slate-500">
              Completa el onboarding en tres pasos y elige el plan antes de entrar al workspace.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-2">
            {stepLabels.map((item) => {
              const isActive = step === item.value;
              return (
                <div
                  key={item.value}
                  className={[
                    'rounded-lg px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider',
                    isActive
                      ? 'bg-white text-[#0033ff] shadow-sm'
                      : 'text-slate-500',
                  ].join(' ')}
                >
                  {item.label}
                </div>
              );
            })}
          </div>

          {step === 'blocked' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error || 'Tu usuario ya pertenece a una organización. No podés continuar con el registro.'}
              </div>
              <button type="button" className="w-full bg-[#0033ff] text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition-colors" onClick={(event) => { void exitOnboarding(event, '/'); }}> 
                Volver a la pantalla principal
              </button>
            </div>
          ) : step === 'identity' ? (
            <div className="space-y-5">
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={isGoogleLoading || isSubmitting}
                className="w-full flex justify-center items-center gap-2 bg-white text-slate-700 border border-slate-200 shadow-sm rounded-xl py-3 font-medium hover:bg-slate-50 transition-colors disabled:opacity-70"
              >
                {isGoogleLoading ? (
                  'Abriendo Google...'
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)"><path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/><path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/><path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/><path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/></g></svg>
                    Continuar con Google
                  </>
                )}
              </button>
            </div>
          ) : step === 'organization' ? (
            <form onSubmit={handleOrganizationSubmit} className="space-y-5">
              {isResumingOrganizationOnboarding ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Reanudando tu registro desde el login. Completá el nombre de tu organización para continuar.
                </div>
              ) : null}

              {user && !user.organizationId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {user.name} {user.lastname} &lt;{user.email}&gt; listo para crear tu organización.
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="organizationName" className="block text-sm text-slate-600">
                  Nombre de la organización
                </label>
                <input
                  id="organizationName"
                  type="text"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  required
                  className="w-full bg-[#eef2f9] border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0033ff] outline-none"
                  placeholder="Tu empresa"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button type="button" className="flex-1 bg-white text-slate-700 border border-slate-200 rounded-xl py-3 font-medium hover:bg-slate-50 transition-colors" onClick={() => setStep('identity')} disabled={isSubmitting}>
                  Volver
                </button>
                <button type="submit" className="flex-1 bg-[#0033ff] text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition-colors disabled:opacity-70" disabled={isSubmitting || !activeUserId}>
                  Continuar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCompleteRegistration} className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Organización: {organizationName}
              </div>

              {isResumingPlanOnboarding ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Reanudando tu onboarding en el paso de plan.
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Elegí tu plan</p>
                <div className="grid gap-3">
                  {sortedPlans.map((option) => {
                    const isSelected = plan === option.name;
                    const isDisabled = option.name.toLowerCase() !== 'free';
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => !isDisabled && setPlan(option.name)}
                        disabled={isDisabled}
                        className={[
                          'rounded-xl border px-4 py-4 text-left transition-all',
                          isSelected
                            ? 'border-[#0033ff] bg-blue-50/50 ring-2 ring-blue-100'
                            : 'border-slate-200 bg-white hover:bg-slate-50',
                          isDisabled ? 'opacity-50 grayscale-[0.5]' : 'cursor-pointer hover:shadow-md',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{option.title}</p>
                              {isDisabled && (
                                <span className="text-[9px] font-bold uppercase tracking-tight bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">Próximamente</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                            <p className="mt-2 text-sm font-bold text-[#0033ff]">
                              {option.price === 0 ? 'Gratis' : `$${option.price}/mes`}
                            </p>
                          </div>
                          <span className={[
                            'inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold flex-shrink-0 transition-all',
                            isSelected
                              ? 'border-[#0033ff] bg-[#0033ff] text-white'
                              : 'border-slate-300 text-transparent',
                          ].join(' ')}>
                            {isSelected ? '✓' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              ) : null}

              <div className="flex gap-3 pt-2">
                {!user?.organizationId ? (
                  <button type="button" className="flex-1 bg-white text-slate-700 border border-slate-200 rounded-xl py-3 font-medium hover:bg-slate-50 transition-colors" onClick={() => setStep('organization')} disabled={isSubmitting}>
                    Volver
                  </button>
                ) : null}
                <button type="submit" className="flex-1 bg-[#0033ff] text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition-colors disabled:opacity-70" disabled={isSubmitting || !activeUserId}>
                  {isSubmitting
                    ? user?.organizationId
                      ? 'Guardando...'
                      : 'Creando...'
                    : user?.organizationId
                      ? 'Guardar plan'
                      : 'Crear organización'}
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-slate-100 pt-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                <p>¿Ya tenés cuenta?</p>
                <Link
                  href="/login"
                  onClick={(event) => {
                    void exitOnboarding(event, '/login');
                  }}
                  className="font-medium text-[#0033ff] hover:text-blue-700 transition-colors"
                >
                  Volver al login
                </Link>
              </div>
              <div className="flex justify-center">
                <Link
                  href="/"
                  onClick={(event) => {
                    void exitOnboarding(event, '/');
                  }}
                  className="text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors"
                >
                  ← Volver a la pantalla principal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
function RegisterPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-(--color-surface-page) px-4">
      <div className="rounded-3xl border border-(--color-border-soft) bg-white px-6 py-5 text-sm font-medium text-(--color-ink-700) shadow-(--shadow-card)">
        Cargando registro...
      </div>
    </div>
  );
}
