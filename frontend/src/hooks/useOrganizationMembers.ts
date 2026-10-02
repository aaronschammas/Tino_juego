'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

import { apiGetCached } from '@/lib/api';
import { useAuth } from './useAuth';
import { OrganizationDetail } from '@/types/organization';

interface UseOrganizationMembersState {
  members: OrganizationDetail['members'];
  pendingInvites: OrganizationDetail['pendingInvites'];
  userRole: OrganizationDetail['userRole'] | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
}

const ORG_STALE_TIME_MS = 45_000;

export function useOrganizationMembers() {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<UseOrganizationMembersState>({
    members: [],
    pendingInvites: [],
    userRole: null,
    isLoading: true,
    isFetching: false,
    error: null,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);


  const fetchOrganizationData = useCallback(
    async (options?: { force?: boolean; background?: boolean }) => {
      if (authLoading) return;

      if (!user?.id || !user.organizationId) {
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            members: [],
            pendingInvites: [],
            userRole: null,
            error: null,
            isLoading: false,
            isFetching: false,
          }));
        }
        return;
      }


      try {
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            isLoading: options?.background ? prev.isLoading : prev.members.length === 0,
            isFetching: true,
            error: null,
          }));
        }


        const data = await apiGetCached<OrganizationDetail>('/orgs/me', {
          staleTime: ORG_STALE_TIME_MS,
          force: options?.force,
        });

        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            members: data.members || [],
            pendingInvites: data.pendingInvites || [],
            userRole: data.userRole || null,
            isLoading: false,
            isFetching: false,
          }));
        }
      } catch (error: any) {
        const message = error?.message || 'Error al cargar miembros de la organizacion';
        if (mounted.current) {
          setState((prev) => ({ ...prev, error: message, isLoading: false, isFetching: false }));
        }
      }

    },
    [authLoading, user?.id, user?.organizationId],
  );

  useEffect(() => {
    if (user?.id && user.organizationId && !authLoading) {
      fetchOrganizationData({ background: state.members.length > 0 }).catch(() => undefined);
    } else if (!authLoading && (!user?.id || !user.organizationId)) {
      setState((prev) => ({
        ...prev,
        members: [],
        pendingInvites: [],
        userRole: null,
        error: null,
        isLoading: false,
        isFetching: false,
      }));
    }
  }, [fetchOrganizationData, user?.id, user?.organizationId, authLoading]);

  const refreshMembers = useCallback(
    (options?: { force?: boolean; background?: boolean }) => {
      return fetchOrganizationData(options);
    },
    [fetchOrganizationData],
  );

  return {
    members: state.members,
    pendingInvites: state.pendingInvites,
    userRole: state.userRole,
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    error: state.error,
    refreshMembers,
  };
}
