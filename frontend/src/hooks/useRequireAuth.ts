'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';

export function useRequireAuth() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?next=${next}`);
    }
  }, [user, isLoading, router]);

  return { user, isLoading };
}
