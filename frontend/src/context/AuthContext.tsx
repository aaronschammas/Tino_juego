'use client';

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ActiveMembership,
  ActiveOrganization,
  ActiveOrganizationFeatures,
  AuthContextResponse,
  LoginResponse,
  OrganizationMembershipSummary,
  User,
  UserRole,
} from '@/types/user';
import {
  ApiClientError,
  apiGetAuthContext,
  apiPost,
  invalidateApiCache,
  invalidateAuthContextRequest,
  setActiveOrganizationId,
} from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { clearClientSession } from '@/lib/session-cleanup';

interface AuthContextType {
  user: User | null;
  activeOrganization: ActiveOrganization | null;
  activeMembership: ActiveMembership | null;
  memberships: OrganizationMembershipSummary[];
  features: ActiveOrganizationFeatures | null;
  isLoading: boolean;
  isSwitchingOrganization?: boolean;
  organizationSwitchError?: string | null;
  login: (email: string, password: string) => Promise<void>;
  refreshContext: () => Promise<AuthContextResponse | null>;
  switchOrganization: (organizationId: string) => Promise<void>;
  updateUser: (updatedUser: User) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [activeOrganization, setActiveOrganization] = useState<ActiveOrganization | null>(null);
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembershipSummary[]>([]);
  const [features, setFeatures] = useState<ActiveOrganizationFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);
  const [organizationSwitchError, setOrganizationSwitchError] = useState<string | null>(null);
  const operationVersionRef = useRef(0);
  const confirmedContextRef = useRef<AuthContextResponse | null>(null);
  const serverOrganizationIdRef = useRef<string | null>(null);
  const pendingOrganizationRef = useRef<{ organizationId: string; version: number } | null>(null);
  const switchQueuePromiseRef = useRef<Promise<void> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = !pathname || pathname === '/' || pathname === '/login' || pathname === '/register';
  const isSetupPasswordPage = pathname === '/auth/setup-password';
  const requiresInternalPasswordSetup = Boolean(user?.requiresInternalPasswordSetup);
  const hasMissingOrganization = Boolean(user && !activeOrganization);
  const hasMissingPlan = Boolean(
    user &&
      activeOrganization &&
      (!activeOrganization.plan ||
        (typeof activeOrganization.plan === 'string' && activeOrganization.plan === '')),
  );
  const shouldResumeOnboarding = Boolean(
    (hasMissingOrganization || hasMissingPlan) &&
      !isAuthPage &&
      !isSetupPasswordPage &&
      !requiresInternalPasswordSetup,
  );

  const applyContext = useCallback((context: AuthContextResponse | null) => {
    if (!context) {
      setUser(null);
      setActiveOrganization(null);
      setActiveMembership(null);
      setMemberships([]);
      setFeatures(null);
      setActiveOrganizationId(null);
      return;
    }

    const normalizedUser: User = {
      ...context.user,
      role: context.user.role?.trim() as UserRole,
      organizationId: context.activeOrganization?.id,
      organizationPlan: context.activeOrganization?.plan ?? null,
    };

    setUser(normalizedUser);
    setActiveOrganization(context.activeOrganization);
    setActiveMembership(context.activeMembership);
    setMemberships(context.memberships ?? []);
    setFeatures(context.features ?? null);
    setActiveOrganizationId(context.activeOrganization?.id ?? null);
  }, []);

  const commitContext = useCallback(
    (context: AuthContextResponse | null) => {
      confirmedContextRef.current = context;
      serverOrganizationIdRef.current = context?.activeOrganization?.id ?? null;
      applyContext(context);
    },
    [applyContext],
  );

  const invalidateOperations = useCallback(() => {
    operationVersionRef.current += 1;
    return operationVersionRef.current;
  }, []);

  const isCurrentOperation = useCallback(
    (version: number) => operationVersionRef.current === version,
    [],
  );

  const clearTenantCaches = useCallback(() => {
    invalidateApiCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('projects:reset'));
      window.dispatchEvent(new Event('organization:changed'));
    }
  }, []);

  const refreshContext = useCallback(async () => {
    const version = invalidateOperations();

    try {
      const context = await apiGetAuthContext<AuthContextResponse>();
      if (!isCurrentOperation(version)) return null;

      commitContext(context);
      setIsLoading(false);
      return context;
    } catch (error) {
      if (isCurrentOperation(version)) setIsLoading(false);
      throw error;
    }
  }, [commitContext, invalidateOperations, isCurrentOperation]);

  useEffect(() => {
    if (!user || !requiresInternalPasswordSetup || isSetupPasswordPage) return;
    router.replace('/auth/setup-password');
  }, [isSetupPasswordPage, requiresInternalPasswordSetup, router, user]);

  useEffect(() => {
    if (!shouldResumeOnboarding || !user) return;

    if (hasMissingOrganization) {
      router.replace(`/register?step=organization&userId=${encodeURIComponent(user.id)}`);
      return;
    }

    router.replace(`/register?step=plan&userId=${encodeURIComponent(user.id)}`);
  }, [hasMissingOrganization, router, shouldResumeOnboarding, user]);

  useEffect(() => {
    const version = invalidateOperations();
    apiGetAuthContext<AuthContextResponse>()
      .then((context) => {
        if (isCurrentOperation(version)) commitContext(context);
      })
      .catch(() => {
        if (!isCurrentOperation(version)) return;
        clearClientSession();
        commitContext(null);
      })
      .finally(() => {
        if (isCurrentOperation(version)) setIsLoading(false);
      });

    return () => {
      if (isCurrentOperation(version)) invalidateOperations();
    };
  }, [commitContext, invalidateOperations, isCurrentOperation]);

  useEffect(() => {
    const handleUnauthorized = (e: Event) => {
      const { next } = (e as CustomEvent<{ next?: string }>).detail;
      invalidateOperations();
      pendingOrganizationRef.current = null;
      clearClientSession();
      commitContext(null);
      setIsLoading(false);
      setIsSwitchingOrganization(false);
      router.replace(next ? `/login?next=${next}` : '/login');
    };

    const handleAuthCleared = () => {
      invalidateOperations();
      pendingOrganizationRef.current = null;
      commitContext(null);
      setIsLoading(false);
      setIsSwitchingOrganization(false);
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'auth_clear_event') {
        invalidateOperations();
        pendingOrganizationRef.current = null;
        commitContext(null);
        setIsLoading(false);
        setIsSwitchingOrganization(false);
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('auth:cleared', handleAuthCleared);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:cleared', handleAuthCleared);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [commitContext, invalidateOperations, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const version = invalidateOperations();
      try {
        await apiPost<LoginResponse>('/auth/login', { email, password });
        if (!isCurrentOperation(version)) return;
        invalidateAuthContextRequest();
        const context = await apiGetAuthContext<AuthContextResponse>();
        if (isCurrentOperation(version)) {
          commitContext(context);
          setIsLoading(false);
        }
      } catch (error: unknown) {
        if (error instanceof ApiClientError) {
          throw error;
        }
        const message =
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string' &&
          error.message
            ? error.message
            : 'Error al iniciar sesión';
        throw new Error(message);
      }
    },
    [commitContext, invalidateOperations, isCurrentOperation],
  );

  const switchOrganization = useCallback(
    (organizationId: string) => {
      const version = invalidateOperations();
      pendingOrganizationRef.current = { organizationId, version };
      setOrganizationSwitchError(null);
      setIsSwitchingOrganization(true);
      setActiveOrganizationId(null);
      clearTenantCaches();

      if (!switchQueuePromiseRef.current) {
        const drainQueue = async () => {
          while (pendingOrganizationRef.current) {
            const intent = pendingOrganizationRef.current;
            pendingOrganizationRef.current = null;

            try {
              const context = await apiPost<AuthContextResponse>('/auth/switch-organization', {
                organizationId: intent.organizationId,
              });
              serverOrganizationIdRef.current = context.activeOrganization?.id ?? null;

              if (pendingOrganizationRef.current) continue;
              if (!isCurrentOperation(intent.version)) return;

              commitContext(context);
              clearTenantCaches();
              if (/^\/projects\/[^/]+/.test(pathname)) {
                router.replace('/projects');
              }
              setIsSwitchingOrganization(false);
              return;
            } catch (error) {
              if (pendingOrganizationRef.current) continue;
              if (!isCurrentOperation(intent.version)) return;

              const confirmedContext = confirmedContextRef.current;
              const confirmedOrganizationId = confirmedContext?.activeOrganization?.id ?? null;

              // An obsolete successful request may already have changed the server cookie.
              // Restore the last confirmed organization before leaving the transition state.
              if (
                confirmedOrganizationId &&
                serverOrganizationIdRef.current !== confirmedOrganizationId
              ) {
                try {
                  const restoredContext = await apiPost<AuthContextResponse>(
                    '/auth/switch-organization',
                    { organizationId: confirmedOrganizationId },
                  );
                  serverOrganizationIdRef.current =
                    restoredContext.activeOrganization?.id ?? confirmedOrganizationId;
                } catch {
                  if (!pendingOrganizationRef.current && isCurrentOperation(intent.version)) {
                    applyContext(confirmedContext);
                    setOrganizationSwitchError(
                      'No se pudo restaurar la organizacion confirmada en el servidor',
                    );
                    setIsSwitchingOrganization(false);
                  }
                  throw error;
                }
              }

              if (pendingOrganizationRef.current) continue;
              if (!isCurrentOperation(intent.version)) return;

              applyContext(confirmedContext);
              setOrganizationSwitchError(
                error instanceof Error ? error.message : 'No se pudo cambiar de organizacion',
              );
              setIsSwitchingOrganization(false);
              throw error;
            }
          }
        };

        switchQueuePromiseRef.current = drainQueue().finally(() => {
          switchQueuePromiseRef.current = null;
        });
      }

      return switchQueuePromiseRef.current;
    },
    [
      applyContext,
      clearTenantCaches,
      commitContext,
      invalidateOperations,
      isCurrentOperation,
      pathname,
      router,
    ],
  );

  const updateUser = useCallback(
    (updatedUser: User) => {
      setUser({
        ...updatedUser,
        organizationId: activeOrganization?.id ?? updatedUser.organizationId,
        organizationPlan: activeOrganization?.plan ?? updatedUser.organizationPlan,
      });
    },
    [activeOrganization],
  );

  const logout = useCallback(async () => {
    const activeSwitch = switchQueuePromiseRef.current;
    invalidateOperations();
    invalidateAuthContextRequest();
    pendingOrganizationRef.current = null;
    clearClientSession();
    commitContext(null);
    setIsLoading(false);
    setIsSwitchingOrganization(false);
    setOrganizationSwitchError(null);
    router.replace('/login');

    // Keep client invalidation immediate, but send logout after an already-active
    // switch so the logout response is the last one that can modify auth cookies.
    await activeSwitch?.catch(() => undefined);

    try {
      try {
        await apiPost('/time/stop', undefined, {
          skipAuthRedirect: true,
          silent: true,
          suppressStatuses: [401, 404],
        });
      } catch {
        // Safe to ignore if there is no active timer running.
      }
      await apiPost('/auth/logout', undefined, {
        skipAuthRedirect: true,
        silent: true,
        suppressStatuses: [401],
      });
    } catch (error) {
      console.error('Error logging out from server:', error);
    }
  }, [commitContext, invalidateOperations, router]);

  const contextValue = React.useMemo(
    () => ({
      user,
      activeOrganization,
      activeMembership,
      memberships,
      features,
      isLoading,
      isSwitchingOrganization,
      organizationSwitchError,
      login,
      refreshContext,
      switchOrganization,
      updateUser,
      logout,
    }),
    [
      user,
      activeOrganization,
      activeMembership,
      memberships,
      features,
      isLoading,
      isSwitchingOrganization,
      organizationSwitchError,
      login,
      refreshContext,
      switchOrganization,
      updateUser,
      logout,
    ],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
