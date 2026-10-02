'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useAuth } from './useAuth';
import type { MobileSummaryPeriod, MobileSummaryResponse } from '@/types/mobile-dashboard';

const ZONE = 'America/Argentina/Buenos_Aires';
type Scope = 'self' | 'organization';

export function useMobileSummary() {
  const { user, activeOrganization, activeMembership } = useAuth();
  const organizationId = activeOrganization?.id ?? null;
  const isOwner = activeMembership?.role === 'ORG_OWNER';
  const contextRef = useRef({ organizationId, userId: user?.id ?? null });
  contextRef.current = { organizationId, userId: user?.id ?? null };
  const generation = useRef(0);
  const requestIds = useRef<Record<Scope, number>>({ self: 0, organization: 0 });
  const mounted = useRef(true);
  const [period, setPeriodState] = useState<MobileSummaryPeriod>('week');
  const [self, setSelf] = useState<MobileSummaryResponse | null>(null);
  const [organization, setOrganization] = useState<MobileSummaryResponse | null>(null);
  const [loading, setLoading] = useState<Record<Scope, boolean>>({ self: true, organization: isOwner });
  const [errors, setErrors] = useState<Record<Scope, string | null>>({ self: null, organization: null });

  const clear = useCallback(() => {
    generation.current += 1;
    setSelf(null);
    setOrganization(null);
    setErrors({ self: null, organization: null });
    setLoading({ self: true, organization: isOwner });
  }, [isOwner]);

  const load = useCallback(async (scope: Scope, selectedPeriod = period) => {
    const context = contextRef.current;
    if (!context.organizationId || !context.userId || (scope === 'organization' && !isOwner)) return;
    const requestGeneration = generation.current;
    const requestId = ++requestIds.current[scope];
    setLoading((current) => ({ ...current, [scope]: true }));
    setErrors((current) => ({ ...current, [scope]: null }));
    try {
      const query = new URLSearchParams({ period: selectedPeriod, scope, timezone: ZONE });
      const result = await apiGet<MobileSummaryResponse>(`/analytics/mobile-summary?${query.toString()}`);
      if (!valid()) return;
      if (scope === 'self') setSelf(result);
      else setOrganization(result);
      setLoading((current) => ({ ...current, [scope]: false }));
    } catch (error) {
      if (!valid()) return;
      setErrors((current) => ({ ...current, [scope]: error instanceof Error ? error.message : 'No se pudo cargar el resumen.' }));
      setLoading((current) => ({ ...current, [scope]: false }));
    }

    function valid() {
      return mounted.current && generation.current === requestGeneration &&
        requestIds.current[scope] === requestId &&
        contextRef.current.organizationId === context.organizationId &&
        contextRef.current.userId === context.userId;
    }
  }, [isOwner, period]);

  const setPeriod = useCallback((next: MobileSummaryPeriod) => {
    generation.current += 1;
    setPeriodState(next);
    setSelf(null);
    setOrganization(null);
    setLoading({ self: true, organization: isOwner });
    setErrors({ self: null, organization: null });
  }, [isOwner]);

  useEffect(() => {
    clear();
    if (organizationId && user?.id) {
      void load('self', period);
      if (isOwner) void load('organization', period);
    }
  }, [clear, isOwner, load, organizationId, period, user?.id]);

  useEffect(() => {
    mounted.current = true;
    window.addEventListener('organization:changed', clear);
    window.addEventListener('auth:cleared', clear);
    return () => {
      mounted.current = false;
      generation.current += 1;
      window.removeEventListener('organization:changed', clear);
      window.removeEventListener('auth:cleared', clear);
    };
  }, [clear]);

  return { period, setPeriod, self, organization, isOwner, loading, errors, retry: load, timezone: ZONE };
}
