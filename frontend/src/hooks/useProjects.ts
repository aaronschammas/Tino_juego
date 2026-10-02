'use client';

import { useState, useEffect, useCallback } from 'react';
import { Project, CreateProjectDto, UpdateProjectDto } from '@/types/project';
import { apiGet, apiPost, apiPatch, apiDelete, getActiveOrganizationId } from '@/lib/api';
import { useAuth } from './useAuth';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function normalizeProject(project: Project): Project {
  if (project.taskStats) return project;
  const tasks = project.tasks || [];
  return {
    ...project,
    taskStats: {
      total: tasks.length,
      completed: tasks.filter((task) => task.status === 'DONE').length,
    },
  };
}

// Simple in-memory cache to prevent redundant API calls
const projectsByOrganization = new Map<string, Project[]>();
const projectsFetchedAtByOrganization = new Map<string, number>();
const inflightByOrganization = new Map<string, Promise<Project[]>>();
const PROJECTS_STALE_TIME_MS = 20_000;

function getProjectCacheKey(userOrganizationId?: string | null) {
  return getActiveOrganizationId() ?? userOrganizationId ?? 'no-org';
}

export function resetProjectsStore() {
  projectsByOrganization.clear();
  projectsFetchedAtByOrganization.clear();
  inflightByOrganization.clear();
}

if (typeof window !== 'undefined') {
  window.addEventListener('auth:cleared', resetProjectsStore);
  window.addEventListener('projects:reset', resetProjectsStore);
}

export function useProjects() {
  const { user, isLoading: authLoading } = useAuth();
  const canUseWorkspace = Boolean(user?.organizationId);
  const cacheKey = getProjectCacheKey(user?.organizationId);
  const cachedProjects = projectsByOrganization.get(cacheKey) ?? null;
  const [projects, setProjects] = useState<Project[]>(cachedProjects || []);
  const [isLoading, setIsLoading] = useState(!cachedProjects);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (options?: { force?: boolean; background?: boolean }) => {
    if (authLoading) return [];

    if (!canUseWorkspace) {
      setProjects([]);
      setIsLoading(false);
      setIsFetching(false);
      setError(null);
      return [];
    }

    const force = options?.force ?? false;
    const background = options?.background ?? false;

    const currentCacheKey = getProjectCacheKey(user?.organizationId);
    const cached = projectsByOrganization.get(currentCacheKey) ?? null;
    const fetchedAt = projectsFetchedAtByOrganization.get(currentCacheKey) ?? 0;
    const isFresh = cached && Date.now() - fetchedAt < PROJECTS_STALE_TIME_MS;
    const inflight = inflightByOrganization.get(currentCacheKey) ?? null;

    if (!force && isFresh) {
      setProjects(cached);
      setIsLoading(false);
      return cached;
    }

    if (!inflight || force) {
      const request = apiGet<Project[]>('/projects')
        .then((data) => {
          const normalized = data.map(normalizeProject);
          projectsByOrganization.set(currentCacheKey, normalized);
          projectsFetchedAtByOrganization.set(currentCacheKey, Date.now());
          return normalized;
        })
        .finally(() => {
          inflightByOrganization.delete(currentCacheKey);
        });
      inflightByOrganization.set(currentCacheKey, request);
    }

    try {
      if (!cached && !background) setIsLoading(true);
      setIsFetching(true);
      setError(null);
      const data = await inflightByOrganization.get(currentCacheKey)!;
      setProjects(data);
      return data;
    } catch (err) {
      const errMsg = getErrorMessage(err, 'Error al cargar proyectos');
      setError(errMsg);
      return [];
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [authLoading, canUseWorkspace, user?.organizationId]);

  const refetch = useCallback((options?: { background?: boolean }) => fetchProjects({ force: true, ...options }), [fetchProjects]);

  const createProject = useCallback(async (dto: CreateProjectDto) => {
    try {
      if (!canUseWorkspace) {
        throw new Error('User must belong to an organization');
      }
      setIsLoading(true);
      setError(null);
      const newProject = await apiPost<Project>('/projects', dto);
      const normalized = normalizeProject(newProject);
      
      // Update global cache
      const currentCacheKey = getProjectCacheKey(user?.organizationId);
      const cached = projectsByOrganization.get(currentCacheKey);
      projectsByOrganization.set(currentCacheKey, cached ? [...cached, normalized] : [normalized]);
      projectsFetchedAtByOrganization.set(currentCacheKey, Date.now());
      
      // Update local state for the hook that made the call
      setProjects(prev => [...prev, normalized]);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('projects:updated'));
      }
      return normalized;
    } catch (err) {
      setError(getErrorMessage(err, 'Error al crear proyecto'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [canUseWorkspace, user?.organizationId]);

  const updateProject = useCallback(async (id: string, dto: UpdateProjectDto) => {
    try {
      if (!canUseWorkspace) {
        throw new Error('User must belong to an organization');
      }
      setIsLoading(true);
      setError(null);
      const updated = await apiPatch<Project>(`/projects/${id}`, dto);
      const normalized = normalizeProject(updated);

      // Update global cache
      const currentCacheKey = getProjectCacheKey(user?.organizationId);
      const cached = projectsByOrganization.get(currentCacheKey);
      if (cached) {
        projectsByOrganization.set(currentCacheKey, cached.map(p => p.id === id ? normalized : p));
        projectsFetchedAtByOrganization.set(currentCacheKey, Date.now());
      }

      // Update local state
      setProjects(prev => prev.map(p => p.id === id ? normalized : p));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('projects:updated'));
      }
      return normalized;
    } catch (err) {
      setError(getErrorMessage(err, 'Error al actualizar proyecto'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [canUseWorkspace, user?.organizationId]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      if (!canUseWorkspace) {
        throw new Error('User must belong to an organization');
      }
      setIsLoading(true);
      setError(null);
      await apiDelete(`/projects/${id}`);
      
      // Update global cache
      const currentCacheKey = getProjectCacheKey(user?.organizationId);
      const cached = projectsByOrganization.get(currentCacheKey);
      if (cached) {
        projectsByOrganization.set(currentCacheKey, cached.filter(p => p.id !== id));
        projectsFetchedAtByOrganization.set(currentCacheKey, Date.now());
      }

      // Update local state
      setProjects(prev => prev.filter(p => p.id !== id));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('projects:updated'));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Error al eliminar proyecto'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [canUseWorkspace, user?.organizationId]);

  // Auto-fetch and global event listeners
  useEffect(() => {
    let mounted = true;

    const handleUpdate = () => {
      if (mounted) fetchProjects({ background: true });
    };

    const handleProjectUpdate = () => {
      if (mounted) fetchProjects({ force: true });
    };

    if (!authLoading) {
      fetchProjects();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('projects:updated', handleProjectUpdate);
      window.addEventListener('task:updated', handleUpdate);
    }

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('projects:updated', handleProjectUpdate);
        window.removeEventListener('task:updated', handleUpdate);
      }
    };
  }, [authLoading, fetchProjects]);

  return {
    projects,
    isLoading,
    isFetching,
    error,
    createProject,
    updateProject,
    deleteProject,
    refetch,
    fetchProjects,
  };
}
