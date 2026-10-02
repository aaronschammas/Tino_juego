'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

import { User, CreateUserDto, UpdateUserDto } from '@/types/user';
import { apiGetCached, apiPost, apiPatch, invalidateApiCache } from '@/lib/api';
import { useAuth } from './useAuth';

interface UseUsersState {
  users: User[];
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
}

const USERS_STALE_TIME_MS = 45_000;

export function useUsers() {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<UseUsersState>({
    users: [],
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


  const fetchUsers = useCallback(
    async (options?: { force?: boolean; background?: boolean }) => {
      if (authLoading) return;
      
      if (!user?.id || !user.organizationId) {
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            users: [],
            error: null,
            isLoading: false,
            isFetching: false,
          }));
        }
        return;
      }


      const background = options?.background ?? false;

      try {
        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            isLoading: background ? prev.isLoading : prev.users.length === 0,
            isFetching: true,
            error: null,
          }));
        }


        const data = await apiGetCached<User[]>('/users', {
          staleTime: USERS_STALE_TIME_MS,
          force: options?.force,
        });

        if (mounted.current) {
          setState((prev) => ({
            ...prev,
            users: data,
            isLoading: false,
            isFetching: false,
          }));
        }
      } catch (error: any) {
        const message = error?.message || 'Error al cargar usuarios';
        if (mounted.current) {
          setState((prev) => ({ ...prev, error: message, isLoading: false, isFetching: false }));
        }
      }

    },
    [authLoading, user?.id, user?.organizationId],
  );

  const createUser = useCallback(async (dto: CreateUserDto) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const newUser = await apiPost<User>('/users', dto);
      invalidateApiCache('/users');
      setState((prev) => ({
        ...prev,
        users: [newUser, ...prev.users],
      }));
      return newUser;
    } catch (error: any) {
      const message = error?.message || 'Error al crear usuario';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const updateUser = useCallback(async (id: string, dto: UpdateUserDto) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const updated = await apiPatch<User>(`/users/${id}`, dto);
      invalidateApiCache(['/users', '/users/me']);
      setState((prev) => ({
        ...prev,
        users: prev.users.map((currentUser) => (currentUser.id === id ? updated : currentUser)),
      }));
      return updated;
    } catch (error: any) {
      const message = error?.message || 'Error al actualizar usuario';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const activateUser = useCallback(async (id: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const updated = await apiPatch<User>(`/users/${id}/activate`, {});
      invalidateApiCache('/users');
      setState((prev) => ({
        ...prev,
        users: prev.users.map((currentUser) => (currentUser.id === id ? updated : currentUser)),
      }));
      return updated;
    } catch (error: any) {
      const message = error?.message || 'Error al activar usuario';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const deactivateUser = useCallback(async (id: string) => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const updated = await apiPatch<User>(`/users/${id}/deactivate`, {});
      invalidateApiCache('/users');
      setState((prev) => ({
        ...prev,
        users: prev.users.filter((currentUser) => currentUser.id !== id),
      }));
      return updated;
    } catch (error: any) {
      const message = error?.message || 'Error al desactivar usuario';
      setState((prev) => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  useEffect(() => {
    if (user?.id && user.organizationId && !authLoading) {
      fetchUsers({ background: state.users.length > 0 }).catch(() => undefined);
    } else if (!authLoading && (!user?.id || !user.organizationId)) {
      setState((prev) => ({ ...prev, users: [], error: null, isLoading: false, isFetching: false }));
    }
  }, [fetchUsers, user?.id, user?.organizationId, authLoading]);

  return {
    users: state.users,
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    error: state.error,
    refetch: fetchUsers,
    createUser,
    updateUser,
    activateUser,
    deactivateUser,
  };
}
