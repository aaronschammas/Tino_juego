'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Navbar from './Navbar';
import Breadcrumb from './Breadcrumb';
import TimerWidget from '../timer/TimerWidget';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isSwitchingOrganization } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (
      !isLoading &&
      user?.requiresInternalPasswordSetup &&
      pathname !== '/auth/setup-password' &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;
      router.replace('/auth/setup-password');
    }
  }, [isLoading, pathname, router, user]);

  useEffect(() => {
    if (!isLoading && user && !user.organizationId && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(`/register?step=organization&userId=${encodeURIComponent(user.id)}`);
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 text-[13.5px] font-medium text-[var(--color-text-muted)] shadow-[var(--shadow-lg)] animate-pulse">
          Cargando espacio de trabajo...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 text-[13.5px] font-medium text-[var(--color-text-muted)] shadow-[var(--shadow-lg)]">
          No se pudo conectar con Tino. Revisá que el backend esté levantado.
        </div>
      </div>
    );
  }

  if (user.requiresInternalPasswordSetup && pathname !== '/auth/setup-password') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 text-[13.5px] font-medium text-[var(--color-text-muted)] shadow-[var(--shadow-lg)]">
          Redirigiendo...
        </div>
      </div>
    );
  }

  if (!user.organizationId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 text-[13.5px] font-medium text-[var(--color-text-muted)] shadow-[var(--shadow-lg)]">
          Redirigiendo...
        </div>
      </div>
    );
  }

  if (isSwitchingOrganization) {
    return (
      <>
        <Navbar />
        <main className="mx-auto flex min-h-screen max-w-[1600px] items-center justify-center px-3 pt-[var(--header-height)] md:px-8">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 text-[13.5px] font-medium text-[var(--color-text-muted)] shadow-[var(--shadow-lg)] animate-pulse">
            Cambiando espacio de trabajo...
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-[1600px] w-full overflow-x-hidden px-3 md:px-8 pt-[calc(var(--header-height)+1rem)] pb-20 animate-page-enter min-w-0">
        <Breadcrumb />
        {children}
      </main>
      <TimerWidget />
    </>
  );
}
