'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MobileBottomNav from './MobileBottomNav';
import MobileHeader from './MobileHeader';
import MobileInstallPrompt from './MobileInstallPrompt';

function FullScreenState({ children, pulse = false }: { children: React.ReactNode; pulse?: boolean }) {
  return <div className="mobile-fullscreen-state"><p className={pulse ? 'animate-pulse' : ''}>{children}</p></div>;
}

export default function MobileProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, activeOrganization, isLoading, isSwitchingOrganization } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (isLoading || redirected.current) return;
    if (!user) {
      redirected.current = true;
      router.replace('/login?next=%2Fmobile');
    } else if (user.requiresInternalPasswordSetup) {
      redirected.current = true;
      router.replace('/auth/setup-password');
    } else if (!activeOrganization) {
      redirected.current = true;
      router.replace(`/register?step=organization&userId=${encodeURIComponent(user.id)}`);
    } else if (!activeOrganization.plan) {
      redirected.current = true;
      router.replace(`/register?step=plan&userId=${encodeURIComponent(user.id)}`);
    }
  }, [activeOrganization, isLoading, router, user]);

  if (isLoading) return <FullScreenState pulse>Cargando espacio de trabajo...</FullScreenState>;
  if (!user || user.requiresInternalPasswordSetup || !activeOrganization || !activeOrganization.plan) {
    return <FullScreenState>Redirigiendo...</FullScreenState>;
  }
  if (isSwitchingOrganization) return <FullScreenState pulse>Cambiando espacio de trabajo...</FullScreenState>;

  return (
    <div className="mobile-shell">
      <MobileHeader />
      <main className="mobile-content">{children}<MobileInstallPrompt /></main>
      <MobileBottomNav />
    </div>
  );
}
